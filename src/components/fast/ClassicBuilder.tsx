// src/components/fast/ClassicBuilder.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { Upload, Search } from 'lucide-react';

export type ClassicRole = 'P' | 'D' | 'C' | 'A';
export type Player = {
  id: string;
  name: string;
  team: string;
  role: ClassicRole;
  price: number; // FVM (colonna L)
};

type FormationKey =
  | '3-4-3'
  | '4-3-3'
  | '3-5-2'
  | '4-4-2'
  | '4-5-1'
  | '5-3-2'
  | '5-4-1';

const ROLE_ORDER: ClassicRole[] = ['P', 'D', 'C', 'A'];
const ROLE_COLORS: Record<ClassicRole, string> = {
  P: 'bg-amber-500',
  D: 'bg-emerald-500',
  C: 'bg-sky-500',
  A: 'bg-rose-500',
};

const REQUIRED_COUNTS: Record<ClassicRole, number> = {
  P: 3,
  D: 8,
  C: 8,
  A: 6,
};

export default function ClassicBuilder({
  budget,
  onConfirm,
}: {
  budget: number;
  onConfirm: (team: Player[], left: number, formation: FormationKey) => void;
}) {
  // -------------------- Stato base --------------------
  const [players, setPlayers] = useState<Player[]>([]);
  const [selected, setSelected] = useState<Player[]>([]);
  const [formation, setFormation] = useState<FormationKey>('3-4-3');

  // UI/filtri
  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | ClassicRole>('all');
  const [teamFilter, setTeamFilter] = useState<'all' | string>('all');

  // Distribuzione crediti (EDITABILE) – default richiesto
  const [pctP, setPctP] = useState<number>(9);
  const [pctD, setPctD] = useState<number>(15);
  const [pctC, setPctC] = useState<number>(30);
  const [pctA, setPctA] = useState<number>(46);

  // Debug (ora dentro il box Distribuzione crediti)
  const [showDebug, setShowDebug] = useState(false);

  // -------------------- Derivati --------------------
  const teams = useMemo(
    () =>
      Array.from(new Set(players.map((p) => p.team))).sort((a, b) =>
        a.localeCompare(b),
      ),
    [players],
  );

  const spent = useMemo(
    () => selected.reduce((s, p) => s + p.price, 0),
    [selected],
  );
  const left = Math.max(0, budget - spent);

  const countByRole = useMemo(() => {
    const m: Record<ClassicRole, number> = { P: 0, D: 0, C: 0, A: 0 };
    selected.forEach((p) => (m[p.role] += 1));
    return m;
  }, [selected]);

  const targets = useMemo(
    () => ({
      P: Math.round((budget * pctP) / 100),
      D: Math.round((budget * pctD) / 100),
      C: Math.round((budget * pctC) / 100),
      A: Math.round((budget * pctA) / 100),
    }),
    [budget, pctP, pctD, pctC, pctA],
  );

  // elenco filtrato (esclude già scelti)
  const filtered = useMemo(() => {
    const used = new Set(selected.map((s) => s.id));
    const term = q.trim().toLowerCase();

    return players.filter((p) => {
      if (used.has(p.id)) return false;
      if (roleFilter !== 'all' && p.role !== roleFilter) return false;
      if (teamFilter !== 'all' && p.team !== teamFilter) return false;
      if (!term) return true;
      return (
        p.name.toLowerCase().includes(term) ||
        p.team.toLowerCase().includes(term)
      );
    });
  }, [players, selected, q, roleFilter, teamFilter]);

  // -------------------- Excel (colonna L = FVM) --------------------
 // utils locali (se non le hai già nello stesso file)
const roleMapToClassic = (r: string): ClassicRole | null => {
  const R = r.toUpperCase();
  if (['P','POR','PORTIERE'].includes(R)) return 'P';
  if (['D','DC','DD','DS','E','B','DEF'].includes(R)) return 'D';
  if (['C','M','T','MED','MID'].includes(R)) return 'C';
  if (['A','W','PC','ATT','FWD'].includes(R)) return 'A';
  return null;
};
const toNumber = (v: any) => {
  if (typeof v === 'number') return v;
  const s = String(v ?? '').replace(',', '.').replace(/\s/g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
};

function parseExcelToPlayers(data: ArrayBuffer) {
  const wb = XLSX.read(data, { type: 'array' });

  // prova prima "Tutti" / "Quot" / "List"
  const orderedSheets = [
    ...wb.SheetNames.filter((n) => /tutti|quot|list/i.test(n)),
    ...wb.SheetNames,
  ];

  for (const sn of orderedSheets) {
    const ws = wb.Sheets[sn];
    if (!ws) continue;

    const rows: any[][] = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      raw: true,
      blankrows: false,
    }) as any[][];

    if (!rows.length) continue;

    // trova riga header (entro le prime 40)
    let hi = -1;
    for (let i = 0; i < Math.min(40, rows.length); i++) {
      const r = rows[i]?.map((x) => String(x ?? '').trim().toLowerCase()) ?? [];
      const hasNome = r.includes('nome') || r.includes('giocatore') || r.includes('calciatore');
      const hasSquadra = r.includes('squadra') || r.includes('team') || r.includes('club');
      const hasR = r.includes('r') || r.includes('ruolo');
      const hasFvm = r.includes('fvm') || r.includes('fvm m') || r.includes('quotazione fvm');
      if (hasNome && hasSquadra && (hasR || r.includes('rm')) && (hasFvm || true)) { hi = i; break; }
    }
    if (hi < 0) continue;

    const header = rows[hi].map((h) => String(h ?? '').trim());
    const H = header.map((h) => h.toLowerCase());

    const idx = (cands: string[], fb?: number) => {
      const i = H.findIndex((h) => cands.includes(h));
      return i >= 0 ? i : (fb ?? -1);
    };

    const idxR  = idx(['r','ruolo']);
    const idxRM = idx(['rm','ruolo mantra','mantra']);
    const idxNome = idx(['nome','giocatore','calciatore']);
    const idxTeam = idx(['squadra','team','club']);
    let idxFVM = idx(['fvm','fvm m','quotazione fvm']);
    if (idxFVM < 0) idxFVM = 11; // fallback: colonna L

    const out: Player[] = [];
    for (let i = hi + 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r) continue;

      const name = String(r[idxNome] ?? '').trim();
      const team = String(r[idxTeam] ?? '').trim();
      const roleRaw = String((idxR >= 0 ? r[idxR] : r[idxRM]) ?? '').trim();
      let role: ClassicRole | null =
        (idxR >= 0 && ['P','D','C','A'].includes(roleRaw.toUpperCase()))
          ? (roleRaw.toUpperCase() as ClassicRole)
          : roleMapToClassic(roleRaw);
      const price = toNumber(r[idxFVM]);

      if (!name || !team || !role || !Number.isFinite(price) || price <= 0) continue;

      out.push({
        id: `${role}-${name}-${team}`.replace(/\s+/g, '_'),
        name,
        team,
        role,
        price: Math.round(price),
      });
    }

    if (out.length) {
      // ordina per prezzo desc per UX migliore
      out.sort((a, b) => b.price - a.price);
      setPlayers(out);
      setSelected([]);
      setQ('');
      setRoleFilter('all');
      setTeamFilter('all');
      return;
    }
  }

  alert(
    'Impossibile leggere il listone.\n' +
    'Controlla che il file abbia le colonne: R/RM, Nome, Squadra e FVM (o FVM in colonna L).'
  );
}

    const idxRole =
      findIdx(['Ruolo', 'R', 'Role']) >= 0
        ? findIdx(['Ruolo', 'R', 'Role'])
        : 0;
    const idxName =
      findIdx(['Nome', 'Giocatore', 'Name']) >= 0
        ? findIdx(['Nome', 'Giocatore', 'Name'])
        : 1;
    const idxTeam =
      findIdx(['Squadra', 'Team', 'Club']) >= 0
        ? findIdx(['Squadra', 'Team', 'Club'])
        : 2;

    // FVM colonna L (indice 11) se non trova "FVM"
    const idxFvm =
      findIdx(['FVM', 'Fvm', 'fvm']) >= 0 ? findIdx(['FVM', 'Fvm', 'fvm']) : 11;

    const out: Player[] = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r) continue;
      const roleRaw = String(r[idxRole] ?? '').trim().toUpperCase();
      const role = (['P', 'D', 'C', 'A'] as const).includes(roleRaw as any)
        ? (roleRaw as ClassicRole)
        : null;
      const name = String(r[idxName] ?? '').trim();
      const team = String(r[idxTeam] ?? '').trim();
      const fvm = Number(r[idxFvm] ?? 0);

      if (!role || !name || !team) continue;
      if (!Number.isFinite(fvm) || fvm <= 0) continue;

      out.push({
        id: `${role}-${name}-${team}`.replace(/\s+/g, '_'),
        name,
        team,
        role,
        price: Math.round(fvm),
      });
    }
    setPlayers(out);
    // reset filtri
    setQ('');
    setRoleFilter('all');
    setTeamFilter('all');
    setSelected([]);
  }

function handleExcel(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      parseExcelToPlayers(ev.target?.result as ArrayBuffer);
    } catch (err) {
      console.error(err);
      alert('Errore durante la lettura del file. Assicurati che sia un .xlsx valido.');
    }
  };
  reader.readAsArrayBuffer(file);
  e.currentTarget.value = '';
}

  // -------------------- Add/Remove --------------------
  function canAdd(p: Player) {
    // limite per ruolo
    if ((countByRole[p.role] ?? 0) >= REQUIRED_COUNTS[p.role]) return false;
    // budget
    if (p.price > left) return false;
    // 25 totali
    if (selected.length >= 25) return false;
    return true;
  }
  function add(p: Player) {
    if (!canAdd(p)) return;
    setSelected((prev) => [...prev, p]);
  }
  function remove(id: string) {
    setSelected((prev) => prev.filter((x) => x.id !== id));
  }

  // -------------------- Randomizzatore (rispetta % ruolo) --------------------
  function randomize() {
    if (!players.length) return;

    const targetByRole: Record<ClassicRole, number> = {
      P: Math.round((budget * pctP) / 100),
      D: Math.round((budget * pctD) / 100),
      C: Math.round((budget * pctC) / 100),
      A: Math.round((budget * pctA) / 100),
    };

    const poolByRole: Record<ClassicRole, Player[]> = {
      P: [],
      D: [],
      C: [],
      A: [],
    };
    players.forEach((p) => poolByRole[p.role].push(p));
    (ROLE_ORDER as ClassicRole[]).forEach((r) =>
      poolByRole[r].sort((a, b) => b.price - a.price),
    );

    const pickRole = (r: ClassicRole) => {
      const need = REQUIRED_COUNTS[r];
      const target = targetByRole[r];
      const pool = poolByRole[r];
      if (!pool.length) return [] as Player[];

      // Greedy “fit”: prova a stare sotto target, ma il più vicino possibile
      const out: Player[] = [];
      let spentR = 0;

      // limiti di prezzo plausibili (evita sprecare tutto nel primo pick)
      const avgMax = Math.floor(target / need);

      // 1) primo pass: prendo 1-2 “buoni” (senza sforare)
      for (const p of pool) {
        if (out.length >= Math.min(2, need)) break;
        if (p.price <= Math.max(avgMax + 10, 5) && spentR + p.price <= target)
          if (!out.find((x) => x.id === p.id)) {
            out.push(p);
            spentR += p.price;
          }
      }

      // 2) riempi fino a need scegliendo elementi che tengano media sostenibile
      while (out.length < need) {
        const remain = need - out.length;
        const budgetLeft = target - spentR;
        const maxForThis = Math.max(Math.floor(budgetLeft / remain), 1) + 3;

        const cand =
          pool.find(
            (p) =>
              !out.find((x) => x.id === p.id) &&
              p.price <= maxForThis &&
              spentR + p.price <= target,
          ) ||
          pool
            .slice()
            .reverse()
            .find(
              (p) =>
                !out.find((x) => x.id === p.id) &&
                spentR + p.price <= target + 2, // piccola tolleranza
            );

        if (!cand) break;
        out.push(cand);
        spentR += cand.price;
      }

      // 3) se mancano slot, riempi con i più economici disponibili
      let idx = pool.length - 1;
      while (out.length < need && idx >= 0) {
        const p = pool[idx--];
        if (out.find((x) => x.id === p.id)) continue;
        out.push(p);
        spentR += p.price;
      }

      // 4) se abbiamo sforato parecchio, sostituisci l’elemento più caro con uno più economico
      let guard = 0;
      while (spentR > target + 2 && guard < 40) {
        guard++;
        const maxIdx = out.reduce(
          (mi, x, i) => (x.price > out[mi].price ? i : mi),
          0,
        );
        const cheapest = pool
          .slice()
          .reverse()
          .find(
            (p) =>
              !out.find((x) => x.id === p.id) &&
              spentR - out[maxIdx].price + p.price <= target + 2,
          );
        if (!cheapest) break;
        spentR = spentR - out[maxIdx].price + cheapest.price;
        out[maxIdx] = cheapest;
      }

      return out;
    };

    const teamPicked = [
      ...pickRole('P'),
      ...pickRole('D'),
      ...pickRole('C'),
      ...pickRole('A'),
    ].slice(0, 25);

    setSelected(teamPicked);
  }

  // -------------------- Conferma --------------------
  const canConfirm =
    selected.length === 25 &&
    ROLE_ORDER.every((r) => countByRole[r] === REQUIRED_COUNTS[r]) &&
    spent <= budget;

  function confirmTeam() {
    if (!canConfirm) return;
    onConfirm(selected, left, formation);
  }

  // -------------------- UI --------------------
return (
    <div className="space-y-4">
      {/* Header riga: modulo + ricerca/filtri/carica */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="text-sm">
          <label className="text-white/80 mr-2">Modulo</label>
          <select
            value={formation}
            onChange={(e) => setFormation(e.target.value as FormationKey)}
            className="px-2 py-1 rounded-md bg-emerald-600/15 border border-emerald-500/30 text-white"
        >
            <option value="3-4-3">3-4-3</option>
            <option value="4-3-3">4-3-3</option>
            <option value="3-5-2">3-5-2</option>
            <option value="4-4-2">4-4-2</option>
            <option value="4-5-1">4-5-1</option>
            <option value="5-3-2">5-3-2</option>
            <option value="5-4-1">5-4-1</option>
          </select>
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/60" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cerca nome o squadra…"
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-white/10 text-white placeholder-white/60 border border-white/20 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* Ruolo */}
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as any)}
          className="px-3 py-2 rounded-lg bg-white/10 text-white border border-white/20"
        >
          <option value="all">Tutti i ruoli</option>
          <option value="P">P</option>
          <option value="D">D</option>
          <option value="C">C</option>
          <option value="A">A</option>
        </select>

        {/* Squadra */}
        <select
          value={teamFilter}
          onChange={(e) => setTeamFilter(e.target.value)}
          className="px-3 py-2 rounded-lg bg-white/10 text-white border border-white/20"
        >
          <option value="all">Tutte le squadre</option>
          {teams.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        {/* Carica Excel */}
        <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 cursor-pointer">
          <Upload className="h-4 w-4" />
          <span>Carica Excel</span>
          <input
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleExcel}
          />
        </label>
      </div>

      {/* Riga 2: Distribuzione crediti + Randomizzatore */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Distribuzione crediti (con DEBUG dentro) */}
        <div className="rounded-xl bg-emerald-700/25 border border-emerald-500/30">
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
            <div className="font-semibold">Distribuzione crediti % (vincolante per il random)</div>
            <button
              type="button"
              onClick={() => setShowDebug((v) => !v)}
              className="px-2 py-1 rounded-md bg-white/10 text-white hover:bg-white/15 text-xs"
              title="Mostra/Nascondi debug budget per ruolo"
            >
              {showDebug ? 'Nascondi debug' : 'Mostra debug'}
            </button>
          </div>

          <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* P */}
            <PercentInput
              label="Ruolo P"
              value={pctP}
              onChange={(v) => setPctP(v)}
            />
            {/* D */}
            <PercentInput
              label="Ruolo D"
              value={pctD}
              onChange={(v) => setPctD(v)}
            />
            {/* C */}
            <PercentInput
              label="Ruolo C"
              value={pctC}
              onChange={(v) => setPctC(v)}
            />
            {/* A */}
            <PercentInput
              label="Ruolo A"
              value={pctA}
              onChange={(v) => setPctA(v)}
            />
          </div>

          {showDebug && (
            <div className="px-4 pb-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              {ROLE_ORDER.map((r) => (
                <div
                  key={r}
                  className="rounded-lg bg-white/10 border border-white/10 p-3"
                >
                  <div className="text-xs text-white/70">Ruolo {r}</div>
                  <div className="text-lg font-semibold">{targets[r]}</div>
                  <div className="text-xs">
                    Spesi{' '}
                    <span className="font-semibold">
                      {selected
                        .filter((p) => p.role === r)
                        .reduce((s, p) => s + p.price, 0)}
                    </span>
                    <span className="text-white/60"> • ({getPct(r)}%)</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Randomizzatore */}
        <div className="rounded-xl bg-white/5 border border-white/10 p-4">
          <div className="font-semibold mb-2">Randomizzatore (smart)</div>
          <p className="text-sm text-white/70 mb-3">
            Crea una rosa rispettando le percentuali per ruolo, prova a usare
            quasi tutto il budget, e rispetta i limiti 3P/8D/8C/6A.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={randomize}
              className="px-3 py-2 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-700"
            >
              🎲 Randomizza (rispetta % ruolo)
            </button>
            <button
              onClick={() => setSelected([])}
              className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15"
            >
              Svuota rosa
            </button>
          </div>
        </div>
      </div>

      {/* Stat riquadri */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatBox title="Budget" value={budget} />
        <StatBox title="Speso" value={spent} />
        <StatBox title="Rimanente" value={left} accent />
        {ROLE_ORDER.map((r) => (
          <div
            key={r}
            className="rounded-xl bg-white/5 border border-white/10 p-4 flex items-center justify-between"
          >
            <div>
              <div className="text-sm text-white/70">Ruolo {r}</div>
              <div className="text-xl font-semibold">
                {countByRole[r]}/{REQUIRED_COUNTS[r]}
              </div>
            </div>
            <div className={`h-3 w-3 rounded-full ${ROLE_COLORS[r]}`} />
          </div>
        ))}
      </div>

      {/* Elenco + Rosa */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Elenco */}
        <div className="rounded-xl bg-white/5 border border-white/10">
          <div className="px-4 py-3 border-b border-white/10 font-semibold">
            Listone (FVM)
          </div>
          <div className="max-h-[520px] overflow-auto divide-y divide-white/10">
            {filtered.length === 0 ? (
              <div className="p-4 text-sm text-white/70">
                Nessun giocatore trovato. Carica l’Excel o modifica i filtri.
              </div>
            ) : (
              filtered.map((p) => (
                <div
                  key={p.id}
                  className="px-4 py-2 flex items-center justify-between"
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">
                      {p.name}{' '}
                      <span className="text-white/60">({p.team})</span>
                    </div>
                    <div className="text-xs text-white/70">
                      Ruolo {p.role} • FVM {p.price}
                    </div>
                  </div>
                  <button
                    disabled={!canAdd(p)}
                    onClick={() => add(p)}
                    className="px-2 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Aggiungi
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Rosa */}
        <div className="rounded-xl bg-white/5 border border-white/10 flex flex-col">
          <div className="px-4 py-3 border-b border-white/10 font-semibold">
            La tua rosa ({selected.length}/25)
          </div>
          <div className="flex-1 max-h-[420px] overflow-auto divide-y divide-white/10">
            {selected.length === 0 ? (
              <div className="p-4 text-sm text-white/70">
                Nessun giocatore selezionato.
              </div>
            ) : (
              selected.map((p) => (
                <div
                  key={p.id}
                  className="px-4 py-2 flex items-center justify-between"
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">
                      {p.role} • {p.name}{' '}
                      <span className="text-white/60">({p.team})</span>
                    </div>
                    <div className="text-xs text-white/70">FVM {p.price}</div>
                  </div>
                  <button
                    onClick={() => remove(p.id)}
                    className="px-2 py-1 rounded-md bg-white/10 hover:bg-white/15"
                  >
                    Rimuovi
                  </button>
                </div>
              ))
            )}
          </div>

          {/* CTA conferma */}
          <div className="p-4 border-t border-white/10">
            <ul className="text-xs text-white/70 mb-2 space-y-1">
              <li>• Servono 25 giocatori.</li>
              <li>• Ruoli: 3P / 8D / 8C / 6A.</li>
              <li>• Non superare il budget.</li>
            </ul>
            <button
              disabled={!canConfirm}
              onClick={confirmTeam}
              className="w-full px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Conferma rosa
            </button>
          </div>
        </div>
      </div>

      {/* Footer budget */}
      <div className="flex items-center justify-between pt-2">
        <div className="text-sm text-white/80">
          Budget: <span className="font-semibold">{budget}</span> • Rimasti:{' '}
          <span className="font-semibold text-emerald-400">{left}</span>
        </div>
      </div>
    </div>
 );

  function getPct(r: ClassicRole) {
    return r === 'P' ? pctP : r === 'D' ? pctD : r === 'C' ? pctC : pctA;
  }
}

/* ---------- piccoli componenti UI ---------- */
function StatBox({ title, value, accent = false }: { title: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-xl bg-white/5 border border-white/10 p-4">
      <div className="text-sm text-white/70">{title}</div>
      <div className={`text-2xl font-bold ${accent ? 'text-emerald-400' : ''}`}>{value}</div>
    </div>
  );
}

function PercentInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="rounded-lg bg-white/10 border border-white/10 p-3">
      <div className="text-sm mb-1">{label}</div>
      <input
        type="number"
        min={0}
        max={100}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value || 0))}
        className="w-full px-2 py-1 rounded-md bg-white/90 text-slate-900"
      />
    </div>
  );
}
