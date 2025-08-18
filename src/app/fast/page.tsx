'use client';

import React, { useMemo, useState } from 'react';
import ClassicBuilder from '@/components/fast/ClassicBuilder';
import { Plus, Eye, EyeOff } from 'lucide-react';

type TableStatus = 'filling' | 'running' | 'completed';
type GameKind = 'classic' | 'top100';
type Table = {
  id: string;
  kind: GameKind;
  buyIn: number;
  capacity: 10 | 20 | 50 | 100;
  enrolled: number;
  status: TableStatus;
  stack: number; // crediti per squadra (es. 1000 / 200)
};

export default function Page() {
  // ❗ TUTTE le dichiarazioni di stato DEVONO stare qui, sopra il return (non nel JSX)
  const [showBuilder, setShowBuilder] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [budget, setBudget] = useState<number>(1000);

  const [tables, setTables] = useState<Table[]>([
    { id: 't1', kind: 'classic', buyIn: 1, capacity: 20, enrolled: 12, status: 'filling', stack: 1000 },
    { id: 't2', kind: 'classic', buyIn: 2, capacity: 10, enrolled: 10, status: 'running', stack: 200 },
    { id: 't3', kind: 'classic', buyIn: 5, capacity: 20, enrolled: 20, status: 'completed', stack: 1000 },
  ]);

  const filtered = useMemo(
    () => tables.filter(t => (showCompleted ? true : t.status !== 'completed')),
    [tables, showCompleted]
  );

  function handleCreate(data: Omit<Table, 'id' | 'enrolled' | 'status'>) {
    const id = `t${Math.random().toString(36).slice(2, 8)}`;
    setTables(prev => [{ id, ...data, enrolled: 0, status: 'filling' }, ...prev]);
    setShowCreate(false);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Fast Fanta &amp; Go</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCompleted(v => !v)}
              className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15"
            >
              {showCompleted ? <EyeOff className="inline h-4 w-4 mr-1" /> : <Eye className="inline h-4 w-4 mr-1" />}
              {showCompleted ? 'Nascondi completati' : 'Mostra completati'}
            </button>
            <button
              onClick={() => setShowCreate(v => !v)}
              className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700"
            >
              <Plus className="inline h-4 w-4 mr-1" />
              Crea tavolo
            </button>
          </div>
        </header>

        {/* Pannello creazione tavolo */}
        {showCreate && (
          <CreateTablePanel
            onCancel={() => setShowCreate(false)}
            onCreate={handleCreate}
          />
        )}

        {/* Lista tavoli */}
        <section className="bg-white/5 rounded-xl border border-white/10">
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
            <h2 className="font-semibold">Tavoli disponibili</h2>
          </div>
          <div className="divide-y divide-white/10">
            {filtered.map(t => (
              <TableRow
                key={t.id}
                t={t}
                onJoin={() => {
                  setBudget(t.stack);
                  setShowBuilder(true);
                }}
              />
            ))}
            {filtered.length === 0 && (
              <div className="p-4 text-sm text-white/70">Nessun tavolo da mostrare.</div>
            )}
          </div>
        </section>

        {/* Builder Classic */}
        {showBuilder && (
          <section className="bg-white/5 rounded-xl border border-white/10 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Costruisci squadra (Classic)</h2>
              <div className="flex items-center gap-2">
                <label className="text-sm">
                  Budget:&nbsp;
                  <select
                    value={budget}
                    onChange={(e) => setBudget(Number(e.target.value))}
                    className="bg-white/10 border border-white/20 rounded px-2 py-1"
                  >
                    <option value={1000}>1000</option>
                    <option value={200}>200</option>
                  </select>
                </label>
                <button
                  onClick={() => setShowBuilder(false)}
                  className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15"
                >
                  Chiudi
                </button>
              </div>
            </div>

            <ClassicBuilder
              budget={budget}
              onConfirm={(team, left) => {
                alert(`Rosa confermata: ${team.length} giocatori, crediti rimasti ${left}`);
              }}
            />
          </section>
        )}
      </div>
    </div>
  );
}

/* ---------------------- Componenti di supporto ---------------------- */

function TableRow({ t, onJoin }: { t: Table; onJoin: () => void }) {
  const pct = Math.round((t.enrolled / t.capacity) * 100);
  return (
    <div className="p-4 flex items-center justify-between">
      <div>
        <div className="font-semibold">
          {t.kind === 'classic' ? 'Classic' : 'Top 100'} • {t.capacity} giocatori • Buy-in €{t.buyIn}
        </div>
        <div className="text-xs text-white/70">
          Stack: {t.stack} crediti • Stato: {t.status} • {t.enrolled}/{t.capacity}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="w-40 bg-white/10 h-2 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
        </div>
        <button onClick={onJoin} className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700">
          Entra
        </button>
      </div>
    </div>
  );
}

function CreateTablePanel({
  onCreate,
  onCancel,
}: {
  onCreate: (t: Omit<Table, 'id' | 'enrolled' | 'status'>) => void;
  onCancel: () => void;
}) {
  const [kind, setKind] = useState<GameKind>('classic');
  const [buyIn, setBuyIn] = useState(1);
  const [capacity, setCapacity] = useState<10 | 20 | 50 | 100>(20);
  const [stack, setStack] = useState(1000);

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">Nuovo tavolo</h3>
        <button onClick={onCancel} className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15">
          Annulla
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <label className="text-sm">
          Modalità
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as GameKind)}
            className="mt-1 w-full bg-white/10 border border-white/20 rounded px-2 py-1"
          >
            <option value="classic">Classic</option>
            <option value="top100">Top 100</option>
          </select>
        </label>

        <label className="text-sm">
          Buy-in (€)
          <select
            value={buyIn}
            onChange={(e) => setBuyIn(Number(e.target.value))}
            className="mt-1 w-full bg-white/10 border border-white/20 rounded px-2 py-1"
          >
            {[1, 2, 5, 10, 20, 50].map(v => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          Capienza
          <select
            value={capacity}
            onChange={(e) => setCapacity(Number(e.target.value) as 10 | 20 | 50 | 100)}
            className="mt-1 w-full bg-white/10 border border-white/20 rounded px-2 py-1"
          >
            {[10, 20, 50, 100].map(v => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          Stack (crediti)
          <select
            value={stack}
            onChange={(e) => setStack(Number(e.target.value))}
            className="mt-1 w-full bg-white/10 border border-white/20 rounded px-2 py-1"
          >
            {[200, 1000].map(v => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-3">
        <button
          onClick={() => onCreate({ kind, buyIn, capacity, stack })}
          className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700"
        >
          Crea
        </button>
      </div>
    </div>
  );
}
