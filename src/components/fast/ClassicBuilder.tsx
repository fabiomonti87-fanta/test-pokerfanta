'use client';

import React, { useMemo, useRef, useState } from 'react';
import { ClassicRole, Player } from '@/lib/fast/game';
import { parsePlayersFromXLSX } from '@/lib/fast/players';
import { Upload, Trash2, CheckCircle2, Search, Shuffle } from 'lucide-react';

const TARGET = { P: 3, D: 8, C: 8, A: 6 } as const;

type Props = {
  budget: number;                         // 1000 o 200
  initialPlayers?: Player[];
  onConfirm: (team: Player[], budgetLeft: number) => void;
};

export default function ClassicBuilder({ budget, initialPlayers = [], onConfirm }: Props) {
  const [players, setPlayers] = useState<Player[]>(initialPlayers);
  const [selected, setSelected] = useState<Player[]>([]);
  const [q, setQ] = useState('');
  const [uploadMsg, setUploadMsg] = useState<string>('');
  const fileRef = useRef<HTMLInputElement | null>(null);

  // distribuzione percentuale P/D/C/A (consigliata 10/16/23/51)
  const [dist, setDist] = useState<{P:number;D:number;C:number;A:number}>({ P:10, D:16, C:23, A:51 });

  const budgetUsed = useMemo(() => selected.reduce((s, p) => s + p.price, 0), [selected]);
  const budgetLeft = budget - budgetUsed;

  const counts = useMemo(() => {
    return selected.reduce((acc, p) => {
      acc[p.role] = (acc[p.role] || 0) + 1;
      return acc;
    }, {} as Record<ClassicRole, number>);
  }, [selected]);

  const canAdd = (p: Player): boolean => {
    if (selected.find(s => s.id === p.id)) return false;
    if (budgetLeft - p.price < 0) return false;
    const n = counts[p.role] || 0;
    const cap = TARGET[p.role];
    return n < cap;
  };

  const fullOk = selected.length === 25
    && (counts.P || 0) === TARGET.P
    && (counts.D || 0) === TARGET.D
    && (counts.C || 0) === TARGET.C
    && (counts.A || 0) === TARGET.A
    && budgetLeft >= 0;

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = players.slice().sort((a,b) => a.role.localeCompare(b.role) || a.price - b.price);
    if (!s) return list;
    return list.filter(p =>
      p.name.toLowerCase().includes(s) || p.team.toLowerCase().includes(s)
    );
  }, [players, q]);

  const onUpload = async (file: File) => {
    try {
      setUploadMsg('Caricamento…');
      const buf = await file.arrayBuffer();
      const parsed = parsePlayersFromXLSX(buf);
      if (!parsed.length) {
        setPlayers([]);
        setUploadMsg('⚠️ Nessun giocatore riconosciuto. Controlla intestazioni (Nome/Squadra/R/Qt.A).');
      } else {
        setPlayers(parsed);
        setUploadMsg(`✅ Caricati ${parsed.length} giocatori dal listone.`);
      }
    } catch (e) {
      console.error(e);
      setUploadMsg('❌ Errore durante la lettura del file.');
    }
  };

  // ---------- RANDOMIZZATORE ----------
  function randomizeTeam() {
    if (!players.length) {
      alert('Carica prima il listone (Excel).');
      return;
    }
    // gruppi per ruolo
    const byRole: Record<ClassicRole, Player[]> = {
      P: players.filter(p => p.role === 'P').sort((a,b)=>a.price-b.price),
      D: players.filter(p => p.role === 'D').sort((a,b)=>a.price-b.price),
      C: players.filter(p => p.role === 'C').sort((a,b)=>a.price-b.price),
      A: players.filter(p => p.role === 'A').sort((a,b)=>a.price-b.price),
    };

    // budget "per ruolo" in base alla distribuzione
    const roleBudget: Record<ClassicRole, number> = {
      P: Math.floor((dist.P/100) * budget),
      D: Math.floor((dist.D/100) * budget),
      C: Math.floor((dist.C/100) * budget),
      A: Math.floor((dist.A/100) * budget),
    };

    // selezione: prendi a caso tra i più economici compatibili col budget/ruolo
    function pick(role: ClassicRole, need: number): Player[] {
      const pool = byRole[role];
      if (pool.length < need) return [];
      // soglia prezzo media desiderata
      const avg = roleBudget[role] / need;
      let factor = 1.25;
      let candidates = pool.filter(p => p.price <= avg * factor);
      while (candidates.length < need && factor < 2.2) {
        factor += 0.2;
        candidates = pool.filter(p => p.price <= avg * factor);
      }
      if (candidates.length < need) candidates = pool.slice(0, Math.max(need*4, 30));

      const chosen: Player[] = [];
      const used = new Set<string>();
      const cand = candidates.slice();
      for (let i = 0; i < need && cand.length; i++) {
        const idx = Math.floor(Math.random()*cand.length);
        const p = cand.splice(idx,1)[0];
        if (used.has(p.id)) { i--; continue; }
        chosen.push(p); used.add(p.id);
      }
      // se per qualsiasi motivo non ho raggiunto need, riempi con i più economici non usati
      let j = 0;
      while (chosen.length < need && j < pool.length) {
        const p = pool[j++]; if (used.has(p.id)) continue; chosen.push(p); used.add(p.id);
      }
      return chosen.slice(0, need);
    }

    let team: Player[] = [
      ...pick('P', TARGET.P),
      ...pick('D', TARGET.D),
      ...pick('C', TARGET.C),
      ...pick('A', TARGET.A),
    ];

    // se sfora il budget, sostituisci i più costosi con alternative economiche
    const total = (arr: Player[]) => arr.reduce((s,p)=>s+p.price,0);
    if (total(team) > budget) {
      const byRoleAll: Record<ClassicRole, Player[]> = {
        P: byRole.P, D: byRole.D, C: byRole.C, A: byRole.A
      };
      const used = new Set(team.map(t=>t.id));
      function cheaper(r: ClassicRole, currentPrice: number, exclude: Set<string>): Player | null {
        const list = byRoleAll[r].filter(p => !exclude.has(p.id) && p.price < currentPrice);
        return list.length ? list[0] : null;
        // (lista già ordinata ascendente)
      }
      let guard = 0;
      while (total(team) > budget && guard < 200) {
        guard++;
        // trova il più caro
        let idxMax = 0;
        for (let i = 1; i < team.length; i++) if (team[i].price > team[idxMax].price) idxMax = i;
        const victim = team[idxMax];
        const role = victim.role;
        const swap = cheaper(role, victim.price, used);
        if (!swap) break;
        used.delete(victim.id);
        used.add(swap.id);
        team[idxMax] = swap;
      }
    }

    // se ancora sfora… fallback: prendi i più economici per ruolo
    if (team.reduce((s,p)=>s+p.price,0) > budget) {
      team = [
        ...byRole.P.slice(0, TARGET.P),
        ...byRole.D.slice(0, TARGET.D),
        ...byRole.C.slice(0, TARGET.C),
        ...byRole.A.slice(0, TARGET.A),
      ];
    }

    setSelected(team);
  }
  // ---------- /RANDOMIZZATORE ----------

  const remove = (id: string) => setSelected(sel => sel.filter(s => s.id !== id));

  return (
    <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-[#0b1222] via-[#0f1b33] to-[#0b1222] border border-emerald-500/30 shadow-[0_0_40px_rgba(16,185,129,0.15)]">
      {/* Header */}
      <div className="p-4 md:p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b border-white/10">
        <div>
          <h3 className="text-xl font-bold text-white tracking-wide">Classic • Crea la tua rosa (25)</h3>
          <p className="text-emerald-200/80 text-sm">
            Budget <span className="font-semibold">{budget}</span> • 3P/8D/8C/6A • Carica l’Excel “Quotazioni Fantacalcio”.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Cerca nome o squadra…"
              className="pl-9 pr-3 py-2 rounded-lg bg-white/10 text-white placeholder-gray-300 border border-white/20 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Upload size={16}/> Carica Excel
          </button>
          <input
            type="file" ref={fileRef} accept=".xlsx,.xls"
            className="hidden" onChange={e => e.target.files?.[0] && onUpload(e.target.files[0])}
          />
          {uploadMsg && (
            <div className="text-xs text-emerald-200/90 bg-emerald-900/30 border border-emerald-500/30 rounded-md px-2 py-1">
              {uploadMsg}
            </div>
          )}
        </div>
      </div>

      {/* pannello distribuzione / random */}
      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-white border-b border-white/10">
        <div className="rounded-lg bg-white/5 p-3">
          <div className="text-sm font-semibold mb-2">Distribuzione crediti %</div>
          <div className="grid grid-cols-4 gap-3">
            {(['P','D','C','A'] as ClassicRole[]).map(r => (
              <label key={r} className="text-xs">
                <div className="mb-1 text-white/80">Ruolo {r}</div>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={(dist as any)[r]}
                  onChange={e => {
                    const v = Math.max(0, Math.min(100, Number(e.target.value)||0));
                    setDist(prev => ({ ...prev, [r]: v }));
                  }}
                  className="w-full text-black rounded-md px-2 py-1"
                />
              </label>
            ))}
          </div>
          <div className="mt-2 text-xs text-white/70">Consiglio: P10 • D16 • C23 • A51 (somma 100).</div>
        </div>
        <div className="rounded-lg bg-white/5 p-3 flex flex-col justify-between">
          <div className="text-sm font-semibold mb-2">Randomizzatore</div>
          <p className="text-sm text-white/80 mb-2">Crea una rosa casuale rispettando budget e ruoli. Poi puoi rifinire a mano.</p>
          <button
            onClick={randomizeTeam}
            className="inline-flex items-center gap-2 self-start px-3 py-2 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-700 text-white"
          >
            <Shuffle size={16}/> Randomizza rosa
          </button>
        </div>
      </div>

      {/* Dashboard budget/contatori */}
      <div className="p-4 grid grid-cols-2 md:grid-cols-7 gap-3 text-white">
        <Stat label="Budget" value={budget} />
        <Stat label="Speso" value={budgetUsed} warn />
        <Stat label="Rimanente" value={budgetLeft} good />
        <Counter label="P" n={counts.P||0} tot={TARGET.P} />
        <Counter label="D" n={counts.D||0} tot={TARGET.D} />
        <Counter label="C" n={counts.C||0} tot={TARGET.C} />
        <Counter label="A" n={counts.A||0} tot={TARGET.A} />
      </div>

      {/* Liste */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-0 border-t border-white/10">
        {/* Catalogo */}
        <div className="md:col-span-2 p-4 max-h-[60vh] overflow-auto bg-white/5">
          {players.length === 0 ? (
            <div className="text-gray-300 text-sm">
              Nessun listone caricato. Premi <strong>Carica Excel</strong> e seleziona “Quotazioni_Fantacalcio…xlsx”.
            </div>
          ) : (
            <table className="w-full text-sm text-white/90">
              <thead className="sticky top-0 bg-[#0f1b33]">
                <tr className="text-left">
                  <th className="py-2 px-2">Ruolo</th>
                  <th className="py-2 px-2">Giocatore</th>
                  <th className="py-2 px-2">Squadra</th>
                  <th className="py-2 px-2 text-right">Prezzo</th>
                  <th className="py-2 px-2 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {filtered.map(p => {
                  const disabled = !canAdd(p);
                  return (
                    <tr key={p.id} className="hover:bg-white/5">
                      <td className="py-2 px-2">{p.role}</td>
                      <td className="py-2 px-2">{p.name}</td>
                      <td className="py-2 px-2 text-white/70">{p.team}</td>
                      <td className="py-2 px-2 text-right">{p.price}</td>
                      <td className="py-2 px-2 text-right">
                        <button
                          disabled={disabled}
                          onClick={() => setSelected(sel => [...sel, p])}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${disabled ? 'bg-gray-500/40 text-white/60 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}
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
            {selected.map(s => (
              <div key={s.id} className="flex items-center justify-between bg-white/10 rounded-lg px-3 py-2">
                <div>
                  <div className="text-white">{s.role} • {s.name}</div>
                  <div className="text-xs text-white/70">{s.team}</div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-white font-semibold">{s.price}</div>
                  <button onClick={() => remove(s.id)} className="p-1 rounded-md hover:bg-white/10">
                    <Trash2 size={16} className="text-white/80"/>
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button
            disabled={!fullOk}
            onClick={() => onConfirm(selected, budgetLeft)}
            className={`mt-3 w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg ${fullOk ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-gray-500/40 text-white/60 cursor-not-allowed'}`}
          >
            <CheckCircle2 size={18}/> Conferma rosa
          </button>
          {!fullOk && (
            <div className="mt-2 text-xs text-amber-300">
              Requisiti: 25 giocatori • 3P/8D/8C/6A • budget ≤ {budget}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({label, value, warn, good}:{label:string; value:number; warn?:boolean; good?:boolean}) {
  return (
    <div className="rounded-lg bg-white/10 p-3">
      <div className="text-xs text-white/70">{label}</div>
      <div className={`text-xl font-bold ${good ? 'text-emerald-300' : warn ? 'text-amber-300' : 'text-white'}`}>{value}</div>
    </div>
  );
}
function Counter({label, n, tot}:{label:string; n:number; tot:number}) {
  const ok = n === tot;
  const cls = ok ? 'text-emerald-300' : n > tot ? 'text-rose-300' : 'text-white';
  return (
    <div className="rounded-lg bg-white/10 p-3">
      <div className="text-xs text-white/70">Ruolo {label}</div>
      <div className={`text-xl font-bold ${cls}`}>{n}/{tot}</div>
    </div>
  );
}
