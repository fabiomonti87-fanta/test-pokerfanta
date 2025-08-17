'use client';

import React, { useMemo, useRef, useState } from 'react';
import { ClassicRole, Player } from '@/lib/fast/game';
import { parsePlayersFromXLSX } from '@/lib/fast/players';
import { Upload, Trash2, CheckCircle2, Search } from 'lucide-react';

const TARGET = { P: 3, D: 8, C: 8, A: 6 } as const;
const BUDGET = 1000;

type Props = {
  initialPlayers?: Player[];                 // opzionale
  onConfirm: (team: Player[], budgetLeft: number) => void;
};

export default function ClassicBuilder({ initialPlayers = [], onConfirm }: Props) {
  const [players, setPlayers] = useState<Player[]>(initialPlayers);
  const [selected, setSelected] = useState<Player[]>([]);
  const [q, setQ] = useState('');
  const fileRef = useRef<HTMLInputElement | null>(null);

  const budgetUsed = useMemo(() => selected.reduce((s, p) => s + p.price, 0), [selected]);
  const budgetLeft = BUDGET - budgetUsed;
  const [uploadMsg, setUploadMsg] = useState<string>('');

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
      p.name.toLowerCase().includes(s) ||
      p.team.toLowerCase().includes(s)
    );
  }, [players, q]);

const onUpload = async (file: File) => {
  try {
    setUploadMsg('Caricamento…');
    const buf = await file.arrayBuffer();
    const parsed = parsePlayersFromXLSX(buf);
    if (!parsed.length) {
      setPlayers([]);
      setUploadMsg('⚠️ Nessun giocatore riconosciuto. Controlla il file (riga intestazioni Nome/Squadra/Qt.A).');
    } else {
      setPlayers(parsed);
      setUploadMsg(`✅ Caricati ${parsed.length} giocatori dal listone.`);
    }
  } catch (e) {
    console.error(e);
    setUploadMsg('❌ Errore durante la lettura del file.');
  }
};

  const remove = (id: string) => setSelected(sel => sel.filter(s => s.id !== id));

  return (
    <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-[#0b1222] via-[#0f1b33] to-[#0b1222] border border-emerald-500/30 shadow-[0_0_40px_rgba(16,185,129,0.15)]">
      {/* Header */}
      <div className="p-4 md:p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b border-white/10">
        <div>
          <h3 className="text-xl font-bold text-white tracking-wide">Classic • Crea la tua rosa (25)</h3>
          <p className="text-emerald-200/80 text-sm">Budget <span className="font-semibold">1000</span> • 3P/8D/8C/6A • Carica l’Excel “Quotazioni Fantacalcio”.</p>
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
            {uploadMsg && (
  <div className="text-xs text-emerald-200/90 bg-emerald-900/30 border border-emerald-500/30 rounded-md px-2 py-1 ml-2">
    {uploadMsg}
  </div>
)}
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
        </div>
      </div>

      {/* Dashboard budget/contatori */}
      <div className="p-4 grid grid-cols-2 md:grid-cols-6 gap-3 text-white">
        <Stat label="Budget" value={BUDGET} />
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
              Requisiti: 25 giocatori • 3P/8D/8C/6A • budget ≤ 1000
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
