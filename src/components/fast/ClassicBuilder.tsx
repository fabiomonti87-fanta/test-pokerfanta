'use client';

import React, { useMemo, useRef, useState } from 'react';
import { Upload, Trash2, CheckCircle2, Search, Wand2 } from 'lucide-react';
import { ClassicRole, Player } from '@/lib/fast/game';
import { parsePlayersFromXLSX } from '@/lib/fast/players';

const TARGET = { P: 3, D: 8, C: 8, A: 6 } as const;

type Dist = { P: number; D: number; C: number; A: number };

type Props = {
  /** Stack/budget del tavolo: es. 1000 (alta) o 200 (bassa) */
  budget: number;
  initialPlayers?: Player[];
  onConfirm: (team: Player[], budgetLeft: number) => void;
};

export default function ClassicBuilder({ budget, initialPlayers = [], onConfirm }: Props) {
  const [players, setPlayers] = useState<Player[]>(initialPlayers);
  const [selected, setSelected] = useState<Player[]>([]);
  const [q, setQ] = useState('');
  const [uploadMsg, setUploadMsg] = useState<string>('');
  const fileRef = useRef<HTMLInputElement | null>(null);

  // UI solo “indicativa” (la random smart usa le sue regole)
  const [dist, setDist] = useState<Dist>({ P: 9, D: 15, C: 30, A: 46 });

  const budgetUsed = useMemo(() => selected.reduce((s, p) => s + p.price, 0), [selected]);
  const budgetLeft = budget - budgetUsed;
  const counts = useMemo(
    () => selected.reduce((m, p) => ((m[p.role] = (m[p.role] || 0) + 1), m), {} as Record<ClassicRole, number>),
    [selected]
  );

  const fullOk =
    selected.length === 25 &&
    (counts.P || 0) === TARGET.P &&
    (counts.D || 0) === TARGET.D &&
    (counts.C || 0) === TARGET.C &&
    (counts.A || 0) === TARGET.A &&
    budgetLeft >= 0;

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = players.slice().sort((a, b) => a.role.localeCompare(b.role) || a.price - b.price);
    if (!s) return list;
    return list.filter((p) => p.name.toLowerCase().includes(s) || p.team.toLowerCase().includes(s));
  }, [players, q]);

  // ---------- Upload listone ----------
  const onUpload = async (file: File) => {
    try {
      setUploadMsg('Caricamento…');
      const buf = await file.arrayBuffer();
      const parsed = parsePlayersFromXLSX(buf);
      if (!parsed.length) {
        setPlayers([]);
        setUploadMsg('⚠️ Nessun giocatore riconosciuto. Intestazioni attese: Nome / Squadra / Ruolo / Qt.A.');
      } else {
        setPlayers(parsed);
        setUploadMsg(`✅ Caricati ${parsed.length} giocatori dal listone.`);
      }
    } catch (e) {
      console.error(e);
      setUploadMsg('❌ Errore durante la lettura del file.');
    }
  };

  // ---------- Randomizzazione SMART (3-4-3, budget quasi pieno) ----------

  function percentile(vals: number[], p: number): number {
    if (!vals.length) return 0;
    const v = [...vals].sort((a, b) => a - b);
    const idx = Math.max(0, Math.min(v.length - 1, Math.floor((p / 100) * (v.length - 1))));
    return v[idx];
  }

  function groupByRole(ps: Player[]) {
    return {
      P: ps.filter((x) => x.role === 'P').sort((a, b) => a.price - b.price),
      D: ps.filter((x) => x.role === 'D').sort((a, b) => a.price - b.price),
      C: ps.filter((x) => x.role === 'C').sort((a, b) => a.price - b.price),
      A: ps.filter((x) => x.role === 'A').sort((a, b) => a.price - b.price),
    } as Record<ClassicRole, Player[]>;
  }

  /** Distribuzione che hai richiesto: P 9% – D 15% – C 30% – A 46%  */
  function roleBudgets(total: number) {
    let P = Math.round(total * 0.09);
    let D = Math.round(total * 0.15);
    let C = Math.round(total * 0.30);
    let A = total - (P + D + C); // chiusura sugli arrotondamenti
    // metto dei minimi soft per evitare buchi alle quote basse (es. budget 200)
    const min = { P: Math.max(12, Math.floor(total * 0.05)), D: Math.max(30, Math.floor(total * 0.10)), C: Math.max(40, Math.floor(total * 0.20)) };
    if (P < min.P) { A -= (min.P - P); P = min.P; }
    if (D < min.D) { A -= (min.D - D); D = min.D; }
    if (C < min.C) { A -= (min.C - C); C = min.C; }
    if (A < 0) A = 0;
    return { P, D, C, A };
  }

  function countsByCategory(): Record<ClassicRole, { top: number; sec: number; rot: number }> {
    return {
      P: { top: 1, sec: 2, rot: 0 },        // 1 semi-top + 2 affidabili
      D: { top: 3, sec: 2, rot: 3 },        // 3-2-3
      C: { top: 2, sec: 3, rot: 3 },        // 2-3-3
      A: { top: 2, sec: 2, rot: 2 },        // 2-2-2
    };
  }

  function categorize(roleList: Player[]) {
    const prices = roleList.map((p) => p.price);
    const p40 = percentile(prices, 40);
    const p80 = percentile(prices, 80);
    const top = roleList.filter((p) => p.price >= p80);
    const sec = roleList.filter((p) => p.price < p80 && p.price >= p40);
    const rot = roleList.filter((p) => p.price < p40);
    return { top, sec, rot, p40, p80 };
  }

  function pickClosestUnder(pool: Player[], target: number, used: Set<string>): Player | null {
    const cand = pool.filter((p) => !used.has(p.id) && p.price <= target);
    if (cand.length) {
      return cand.reduce((a, b) => (Math.abs(b.price - target) < Math.abs(a.price - target) ? b : a));
    }
    const rest = pool.filter((p) => !used.has(p.id));
    return rest.length ? rest[0] : null;
  }

  function tryUpgrade(team: Player[], poolSameRole: Player[], budgetLeft: number): { team: Player[]; spent: number } {
    const used = new Set(team.map((t) => t.id));
    let bestIdx = -1;
    let bestSwap: Player | null = null;
    let bestDelta = 0;

    team.forEach((pl, i) => {
      const better = poolSameRole
        .filter((p) => !used.has(p.id) && p.price > pl.price && p.price - pl.price <= budgetLeft + 0.01)
        .sort((a, b) => b.price - a.price)[0];
      if (better && better.price - pl.price > bestDelta) {
        bestDelta = better.price - pl.price;
        bestSwap = better;
        bestIdx = i;
      }
    });

    if (bestIdx >= 0 && bestSwap) {
      const next = [...team];
      next[bestIdx] = bestSwap;
      const spent = next.reduce((s, p) => s + p.price, 0);
      return { team: next, spent };
    }
    return { team, spent: team.reduce((s, p) => s + p.price, 0) };
  }

  function randomizeSmart() {
    if (!players.length) {
      alert('Carica prima il listone Excel.');
      return;
    }
    const byRole = groupByRole(players);
    const budgets = roleBudgets(budget);
    const cats: Record<ClassicRole, ReturnType<typeof categorize>> = {
      P: categorize(byRole.P),
      D: categorize(byRole.D),
      C: categorize(byRole.C),
      A: categorize(byRole.A),
    };
    const need = countsByCategory();
    const used = new Set<string>();
    const team: Player[] = [];

    // target per slot (in funzione del budget per ruolo)
    function targetsForRole(r: ClassicRole, totalBudgetForRole: number) {
      const tot = TARGET[r];
      const avg = totalBudgetForRole / Math.max(1, tot);
      return {
        top: 1.6 * avg,
        sec: 1.0 * avg,
        rot: 0.6 * avg,
      };
    }

    // ---- Portieri: preferisci tripletta stessa squadra ----
    (function buildGoalkeepers() {
      const { top, sec } = cats.P;
      const tBudget = budgets.P;
      const t = targetsForRole('P', tBudget);

      const byTeam = byRole.P.reduce((m, p) => {
        (m[p.team] = m[p.team] || []).push(p);
        return m;
      }, {} as Record<string, Player[]>);
      const tripleTeam = Object.values(byTeam).find((arr) => arr.length >= 3);

      if (tripleTeam) {
        const sorted = [...tripleTeam].sort((a, b) => b.price - a.price);
        const pick = sorted.slice(0, 3);
        pick.forEach((p) => used.add(p.id));
        team.push(...pick);
        return;
      }

      // 1 semi-top + 2 affidabili
      const p1 = pickClosestUnder(top, t.top, used) || pickClosestUnder(byRole.P, t.top, used);
      if (p1) {
        used.add(p1.id);
        team.push(p1);
      }
      for (let i = 0; i < 2; i++) {
        const p = pickClosestUnder(sec, t.sec, used) || pickClosestUnder(byRole.P, t.sec, used);
        if (p) {
          used.add(p.id);
          team.push(p);
        }
      }
    })();

    // ---- D / C / A ----
    (['D', 'C', 'A'] as ClassicRole[]).forEach((r) => {
      const { top, sec, rot } = cats[r];
      const tBudget = budgets[r];
      const t = targetsForRole(r, tBudget);

      function take(pool: Player[], n: number, target: number) {
        for (let i = 0; i < n; i++) {
          const p =
            pickClosestUnder(pool, target * (1 + Math.random() * 0.15), used) ||
            pickClosestUnder(byRole[r], target, used);
          if (p) {
            used.add(p.id);
            team.push(p);
          }
        }
      }

      take(top, need[r].top, t.top);
      take(sec, need[r].sec, t.sec);
      take(rot, need[r].rot, t.rot);

      // riempi se mancano slot nel ruolo
      const tot = TARGET[r];
      let i = 0;
      while (team.filter((p) => p.role === r).length < tot && i < byRole[r].length) {
        const p = byRole[r][i++];
        if (!used.has(p.id)) {
          used.add(p.id);
          team.push(p);
        }
      }
    });

    // ---- Rifinitura budget globale ----
    const total = (arr: Player[]) => arr.reduce((s, p) => s + p.price, 0);
    let spent = total(team);

    // se sforo, downgrade mirati
    function tryDowngradeOnce(current: Player[]): Player[] {
      const idxMax = current.reduce((imax, _, i, arr) => (arr[i].price > arr[imax].price ? i : imax), 0);
      const victim = current[idxMax];
      const pool = byRole[victim.role].filter((p) => !current.some((x) => x.id === p.id) && p.price < victim.price);
      if (!pool.length) return current;
      const cheaper = pool[0];
      const next = [...current];
      next[idxMax] = cheaper;
      return next;
    }

    let guard = 0;
    while (spent > budget && guard < 300) {
      const next = tryDowngradeOnce(team);
      if (next === team) break;
      team.splice(0, team.length, ...next);
      spent = total(team);
      guard++;
    }

    // se avanza > 2.5%, prova ad upgradare slot finché possibile
    guard = 0;
    while (budget - spent > Math.max(5, budget * 0.025) && guard < 200) {
      (['P', 'D', 'C', 'A'] as ClassicRole[]).forEach((r) => {
        const roleTeamIdx: number[] = [];
        const roleTeam: Player[] = [];
        team.forEach((p, i) => { if (p.role === r) { roleTeamIdx.push(i); roleTeam.push(p); } });
        const res = tryUpgrade(roleTeam, byRole[r], budget - spent);
        if (res.team !== roleTeam) {
          // rimappa nei punti corretti del team globale
          res.team.forEach((p, k) => { team[roleTeamIdx[k]] = p; });
          spent = total(team);
        }
      });
      guard++;
    }

    setSelected(team);
  }

  // ---------- Helpers UI ----------
  const canAdd = (p: Player): boolean => {
    if (selected.find((s) => s.id === p.id)) return false;
    if (budgetLeft - p.price < 0) return false;
    const n = counts[p.role] || 0;
    return n < TARGET[p.role];
  };
  const remove = (id: string) => setSelected((sel) => sel.filter((s) => s.id !== id));
  const applyPreset = () => setDist({ P: 9, D: 15, C: 30, A: 46 });

  // ---------- Render ----------
  return (
    <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-[#0b1222] via-[#0f1b33] to-[#0b1222] border border-emerald-500/30 shadow-[0_0_40px_rgba(16,185,129,0.15)]">
      {/* Header */}
      <div className="p-4 md:p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b border-white/10">
        <div>
          <h3 className="text-xl font-bold text-white tracking-wide">Classic • Crea la tua rosa (25) • Modulo 3-4-3</h3>
          <p className="text-emerald-200/80 text-sm">
            Budget <span className="font-semibold">{budget}</span> • 3P/8D/8C/6A • Carica “Quotazioni Fantacalcio”.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cerca nome o squadra…"
              className="pl-9 pr-3 py-2 rounded-lg bg-white text-black placeholder-gray-500 border border-white/20 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <button onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white">
            <Upload size={16} /> Carica Excel
          </button>
          <input type="file" ref={fileRef} accept=".xlsx,.xls" className="hidden" onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} />
          {uploadMsg && <div className="text-xs text-emerald-200/90 bg-emerald-900/30 border border-emerald-500/30 rounded-md px-2 py-1">{uploadMsg}</div>}
        </div>
      </div>

      {/* Distribuzione crediti & Random */}
      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-white border-b border-white/10">
        {/* Card chiara (più leggibile) */}
        <div className="rounded-lg bg-white text-black p-3 shadow-sm">
          <div className="text-sm font-semibold mb-2">Distribuzione crediti % (visiva)</div>
          <div className="grid grid-cols-4 gap-3">
            {(['P', 'D', 'C', 'A'] as ClassicRole[]).map((r) => (
              <label key={r} className="text-xs">
                <div className="mb-1 text-gray-700">Ruolo {r}</div>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={(dist as any)[r]}
                  onChange={(e) => {
                    const v = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                    setDist((prev) => ({ ...prev, [r]: v }));
                  }}
                  className="w-full rounded-md px-2 py-1 border border-gray-300"
                />
              </label>
            ))}
          </div>
          <div className="mt-2 text-xs text-gray-600">
            Preset consigliato 3-4-3: <button onClick={applyPreset} className="underline">P9 • D15 • C30 • A46</button> (la randomizzazione smart usa regole proprie).
          </div>
        </div>

        <div className="rounded-lg bg-white/5 p-3 flex flex-col justify-between">
          <div className="text-sm font-semibold mb-2 text-white">Randomizzatore (smart)</div>
          <p className="text-sm text-white/80 mb-2">
            Crea una rosa coerente: Top/Sicuri/Rotazione per ruolo, priorità 3-4-3, tripletta portieri se possibile e uso quasi totale del budget.
          </p>
          <div className="flex items-center gap-2">
            <button onClick={randomizeSmart} className="inline-flex items-center gap-2 self-start px-3 py-2 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-700 text-white">
              <Wand2 size={16} /> Randomizza (smart)
            </button>
            <button onClick={() => setSelected([])} className="px-3 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20">
              Svuota rosa
            </button>
          </div>
        </div>
      </div>

      {/* Dashboard budget/contatori */}
      <div className="p-4 grid grid-cols-2 md:grid-cols-7 gap-3 text-white">
        <Stat label="Budget" value={budget} />
        <Stat label="Speso" value={budgetUsed} warn />
        <Stat label="Rimanente" value={budgetLeft} good />
        <Counter label="P" n={counts.P || 0} tot={TARGET.P} />
        <Counter label="D" n={counts.D || 0} tot={TARGET.D} />
        <Counter label="C" n={counts.C || 0} tot={TARGET.C} />
        <Counter label="A" n={counts.A || 0} tot={TARGET.A} />
      </div>

      {/* Liste */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-0 border-t border-white/10">
        {/* Catalogo */}
        <div className="md:col-span-2 p-4 max-h-[60vh] overflow-auto bg-white">
          {players.length === 0 ? (
            <div className="text-gray-700 text-sm">
              Nessun listone caricato. Premi <strong>Carica Excel</strong> e seleziona “Quotazioni_Fantacalcio…xlsx”.
            </div>
          ) : (
            <table className="w-full text-sm text-gray-900">
              <thead className="sticky top-0 bg-gray-100">
                <tr className="text-left">
                  <th className="py-2 px-2">Ruolo</th>
                  <th className="py-2 px-2">Giocatore</th>
                  <th className="py-2 px-2">Squadra</th>
                  <th className="py-2 px-2 text-right">Prezzo</th>
                  <th className="py-2 px-2 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filtered.map((p) => {
                  const disabled = !canAdd(p);
                  return (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="py-2 px-2">{p.role}</td>
                      <td className="py-2 px-2">{p.name}</td>
                      <td className="py-2 px-2 text-gray-600">{p.team}</td>
                      <td className="py-2 px-2 text-right">{p.price}</td>
                      <td className="py-2 px-2 text-right">
                        <button
                          disabled={disabled}
                          onClick={() => setSelected((sel) => [...sel, p])}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                            disabled ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          }`}
                        >
                          Aggiungi
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Rosa selezionata */}
        <div className="p-4 bg-white/10 border-l border-white/10">
          <div className="text-white font-semibold mb-2">La tua rosa ({selected.length}/25)</div>
          <div className="space-y-2 max-h-[50vh] overflow-auto">
            {selected.map((s) => (
              <div key={s.id} className="flex items-center justify-between bg-white/10 rounded-lg px-3 py-2">
                <div>
                  <div className="text-white">
                    {s.role} • {s.name}
                  </div>
                  <div className="text-xs text-white/70">{s.team}</div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-white font-semibold">{s.price}</div>
                  <button onClick={() => remove(s.id)} className="p-1 rounded-md hover:bg-white/10">
                    <Trash2 size={16} className="text-white/80" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button
            disabled={!fullOk}
            onClick={() => onConfirm(selected, budgetLeft)}
            className={`mt-3 w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg ${
              fullOk ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-gray-500/40 text-white/60 cursor-not-allowed'
            }`}
          >
            <CheckCircle2 size={18} /> Conferma rosa
          </button>

          {!fullOk && (
            <ul className="mt-2 text-xs text-white/70 space-y-1">
              <li>• Servono 25 giocatori.</li>
              <li>• Ruoli: 3P / 8D / 8C / 6A.</li>
              <li>• Non superare il budget.</li>
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- UI mini widgets ---------- */

function Stat({ label, value, warn, good }: { label: string; value: number; warn?: boolean; good?: boolean }) {
  const cls = warn ? 'text-rose-300' : good ? 'text-emerald-300' : 'text-white';
  return (
    <div className="rounded-lg bg-white/5 px-3 py-2 border border-white/10">
      <div className="text-xs text-white/70">{label}</div>
      <div className={`text-lg font-semibold ${cls}`}>{Math.max(0, Math.round(value))}</div>
    </div>
  );
}

function Counter({ label, n, tot }: { label: ClassicRole | string; n: number; tot: number }) {
  const ok = n === tot;
  return (
    <div className="rounded-lg px-3 py-2 border border-white/10" style={{ background: ok ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.06)' }}>
      <div className="text-xs text-white/70">Ruolo {label}</div>
      <div className={`text-lg font-semibold ${ok ? 'text-emerald-300' : 'text-white'}`}>
        {n}/{tot}
      </div>
    </div>
  );
}
