// src/components/fast/ClassicBuilder.tsx
'use client';

import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { Upload, Search, ChevronUp, ChevronDown } from 'lucide-react';

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

// Mapping numeri di maglia per ruolo e posizione
const JERSEY_NUMBERS: Record<FormationKey, { field: number[], bench: number[] }> = {
  '3-4-3': {
    field: [1, 2, 3, 4, 6, 8, 10, 7, 11, 9],  // 1 P, 3 D, 4 C, 3 A
    bench: [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25]
  },
  '4-3-3': {
    field: [1, 2, 5, 4, 3, 6, 8, 10, 7, 9, 11], // 1 P, 4 D, 3 C, 3 A
    bench: [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25]
  },
  '3-5-2': {
    field: [1, 2, 4, 3, 5, 6, 8, 10, 7, 9, 11], // 1 P, 3 D, 5 C, 2 A
    bench: [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25]
  },
  '4-4-2': {
    field: [1, 2, 5, 4, 3, 6, 8, 7, 11, 9, 10], // 1 P, 4 D, 4 C, 2 A
    bench: [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25]
  },
  '4-5-1': {
    field: [1, 2, 5, 4, 3, 6, 8, 10, 7, 11, 9], // 1 P, 4 D, 5 C, 1 A
    bench: [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25]
  },
  '5-3-2': {
    field: [1, 2, 5, 4, 3, 6, 8, 10, 7, 9, 11], // 1 P, 5 D, 3 C, 2 A
    bench: [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25]
  },
  '5-4-1': {
    field: [1, 2, 5, 4, 3, 6, 8, 10, 7, 11, 9], // 1 P, 5 D, 4 C, 1 A
    bench: [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25]
  },
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
  const [lastRandomizedIds, setLastRandomizedIds] = useState<Set<string>>(new Set());

  // UI/filtri
  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | ClassicRole>('all');
  const [teamFilter, setTeamFilter] = useState<'all' | string>('all');

  // Distribuzione crediti (EDITABILE) — default richiesto
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

  // -------------------- Funzioni Helper --------------------
  function getPct(r: ClassicRole) {
    return r === 'P' ? pctP : r === 'D' ? pctD : r === 'C' ? pctC : pctA;
  }

  // -------------------- Excel (colonna L = FVM) --------------------
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
        if (hasNome && hasSquadra && (hasR || r.includes('rm')) && (hasFvm || true)) { 
          hi = i; 
          break; 
        }
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

  // Funzioni per spostare giocatori nella rosa (per ordinamento panchina)
  function movePlayerUp(index: number) {
    if (index === 0) return;
    setSelected(prev => {
      const newSelected = [...prev];
      [newSelected[index], newSelected[index - 1]] = [newSelected[index - 1], newSelected[index]];
      return newSelected;
    });
  }

  function movePlayerDown(index: number) {
    if (index === selected.length - 1) return;
    setSelected(prev => {
      const newSelected = [...prev];
      [newSelected[index], newSelected[index + 1]] = [newSelected[index + 1], newSelected[index]];
      return newSelected;
    });
  }

  // -------------------- Randomizzatore MIGLIORATO --------------------
  function randomize() {
    if (!players.length) return;

    const targetByRole: Record<ClassicRole, number> = {
      P: Math.round((budget * pctP) / 100),
      D: Math.round((budget * pctD) / 100),
      C: Math.round((budget * pctC) / 100),
      A: Math.round((budget * pctA) / 100),
    };

    // Filtra i giocatori escludendo quelli dell'ultima randomizzazione
    const availablePlayers = players.filter(p => !lastRandomizedIds.has(p.id));
    
    // Se non ci sono abbastanza giocatori disponibili, resetta il set
    if (availablePlayers.length < 25) {
      setLastRandomizedIds(new Set());
    }

    const poolByRole: Record<ClassicRole, Player[]> = {
      P: [],
      D: [],
      C: [],
      A: [],
    };
    
    const playersToUse = availablePlayers.length >= 25 ? availablePlayers : players;
    playersToUse.forEach((p) => poolByRole[p.role].push(p));
    
    // Shuffle arrays per maggiore randomizzazione
    (ROLE_ORDER as ClassicRole[]).forEach((r) => {
      poolByRole[r] = poolByRole[r].sort(() => Math.random() - 0.5);
    });

    const pickRole = (r: ClassicRole, remainingBudget: number, alreadyPicked: Player[]) => {
      const need = REQUIRED_COUNTS[r];
      const target = targetByRole[r];
      const pool = poolByRole[r].filter(p => !alreadyPicked.find(x => x.id === p.id));
      
      if (!pool.length) return [] as Player[];

      const out: Player[] = [];
      let spentR = 0;

      // Strategia: cerca di spendere tutto il budget allocato
      // 1) Ordina per prezzo in modo randomico con bias verso prezzi alti
      const sortedPool = [...pool].sort((a, b) => {
        const randomFactor = Math.random() > 0.3 ? 1 : -1;
        return (b.price - a.price) * randomFactor;
      });

      // 2) Prendi giocatori cercando di avvicinarti al target
      for (let i = 0; i < need; i++) {
        const remaining = need - out.length;
        const budgetLeft = Math.max(1, target - spentR);
        const avgNeeded = Math.floor(budgetLeft / remaining);

        // Cerca un giocatore vicino alla media necessaria
        let bestPlayer = null;
        let bestDiff = Infinity;
        
        for (const p of sortedPool) {
          if (out.find(x => x.id === p.id)) continue;
          
          const wouldSpend = spentR + p.price;
          const remainingAfter = target - wouldSpend;
          const remainingSlots = remaining - 1;
          
          // Se è l'ultimo slot, prendi quello che ci avvicina di più al target
          if (remainingSlots === 0) {
            const diff = Math.abs(target - wouldSpend);
            if (diff < bestDiff && wouldSpend <= remainingBudget) {
              bestPlayer = p;
              bestDiff = diff;
            }
          } else {
            // Altrimenti cerca di mantenere una media sostenibile
            const futureAvg = remainingAfter / remainingSlots;
            if (futureAvg > 0 && futureAvg < 100 && wouldSpend <= remainingBudget) {
              const diff = Math.abs(p.price - avgNeeded);
              if (diff < bestDiff) {
                bestPlayer = p;
                bestDiff = diff;
              }
            }
          }
        }

        if (bestPlayer) {
          out.push(bestPlayer);
          spentR += bestPlayer.price;
        } else {
          // Fallback: prendi il più costoso che possiamo permetterci
          const affordable = sortedPool
            .filter(p => !out.find(x => x.id === p.id) && spentR + p.price <= remainingBudget)
            .sort((a, b) => b.price - a.price)[0];
          
          if (affordable) {
            out.push(affordable);
            spentR += affordable.price;
          }
        }
      }

      // Se mancano ancora slot, riempi con i più economici
      while (out.length < need) {
        const cheapest = pool
          .filter(p => !out.find(x => x.id === p.id))
          .sort((a, b) => a.price - b.price)[0];
        
        if (!cheapest) break;
        out.push(cheapest);
        spentR += cheapest.price;
      }

      return out;
    };

    // Costruisci la squadra ruolo per ruolo
    const teamPicked: Player[] = [];
    let totalSpent = 0;
    
    for (const role of ROLE_ORDER) {
      const remainingBudget = budget - totalSpent;
      const rolePlayers = pickRole(role, remainingBudget, teamPicked);
      teamPicked.push(...rolePlayers);
      totalSpent = teamPicked.reduce((s, p) => s + p.price, 0);
    }

    // Se abbiamo crediti rimasti significativi, ottimizza sostituendo giocatori economici
    const leftover = budget - totalSpent;
    if (leftover > 10 && teamPicked.length === 25) {
      // Trova i giocatori più economici e cerca di sostituirli con più costosi
      const sortedTeam = [...teamPicked].sort((a, b) => a.price - b.price);
      
      for (let i = 0; i < Math.min(5, sortedTeam.length); i++) {
        const cheapPlayer = sortedTeam[i];
        const pool = poolByRole[cheapPlayer.role];
        
        const replacement = pool
          .filter(p => 
            !teamPicked.find(x => x.id === p.id) &&
            p.price > cheapPlayer.price &&
            p.price <= cheapPlayer.price + leftover
          )
          .sort((a, b) => b.price - a.price)[0];
        
        if (replacement) {
          const idx = teamPicked.findIndex(p => p.id === cheapPlayer.id);
          if (idx !== -1) {
            teamPicked[idx] = replacement;
            totalSpent = teamPicked.reduce((s, p) => s + p.price, 0);
          }
        }
      }
    }

    // Salva gli ID per evitare di riproporre la stessa rosa
    const newIds = new Set(teamPicked.map(p => p.id));
    setLastRandomizedIds(newIds);
    
    setSelected(teamPicked.slice(0, 25));
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

  // Separa titolari e panchinari con numeri di maglia
  const { starters, bench } = useMemo(() => {
    const formationCounts = {
      '3-4-3': { P: 1, D: 3, C: 4, A: 3 },
      '4-3-3': { P: 1, D: 4, C: 3, A: 3 },
      '3-5-2': { P: 1, D: 3, C: 5, A: 2 },
      '4-4-2': { P: 1, D: 4, C: 4, A: 2 },
      '4-5-1': { P: 1, D: 4, C: 5, A: 1 },
      '5-3-2': { P: 1, D: 5, C: 3, A: 2 },
      '5-4-1': { P: 1, D: 5, C: 4, A: 1 },
    };

    const counts = formationCounts[formation];
    const starters: (Player & { jersey: number })[] = [];
    const bench: (Player & { jersey: number })[] = [];
    const roleCount = { P: 0, D: 0, C: 0, A: 0 };

    selected.forEach((player, idx) => {
      if (roleCount[player.role] < counts[player.role]) {
        starters.push({ ...player, jersey: JERSEY_NUMBERS[formation].field[starters.length] || idx + 1 });
        roleCount[player.role]++;
      } else {
        bench.push({ ...player, jersey: JERSEY_NUMBERS[formation].bench[bench.length] || idx + 12 });
      }
    });

    return { starters, bench };
  }, [selected, formation]);

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
}
