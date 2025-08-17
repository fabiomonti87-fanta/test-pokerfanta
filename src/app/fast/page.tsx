'use client';

import React, { useMemo, useState } from 'react';
import ClassicBuilder from '@/components/fast/ClassicBuilder';
import { Roboto } from 'next/font/google';
import { ChevronDown, ChevronUp } from 'lucide-react';

const roboto = Roboto({ subsets: ['latin'], weight: ['300','400','500','700'] });

type TableStatus = 'filling' | 'running' | 'completed';
type GameKind = 'classic';
type Table = {
  id: string;
  kind: GameKind;
  buyIn: number;     // €
  capacity: number;  // 2,4,6,10,20,50
  status: TableStatus;
  enrolled: number;
  stack: number;     // budget (1000 o 200)
};

function simulateClassicScore() {
  // segnaposto (soft colors a valle)
  return 60 + Math.round(Math.random() * 50);
}

export default function FastPage() {
  const [view, setView] = useState<'lobby'|'builder'|'result'>('lobby');
  const [currentTable, setCurrentTable] = useState<Table | null>(null);
  const [resultScore, setResultScore] = useState<number | null>(null);

  // DEMO: tavoli base
  const [tables, setTables] = useState<Table[]>([
    { id: 't1', kind: 'classic', buyIn: 1,  capacity: 20, status: 'filling',  enrolled: 12, stack: 1000 },
    { id: 't2', kind: 'classic', buyIn: 2,  capacity: 10, status: 'running',  enrolled: 10, stack: 200  },
    { id: 't3', kind: 'classic', buyIn: 5,  capacity: 20, status: 'completed',enrolled: 20, stack: 1000 },
    { id: 't4', kind: 'classic', buyIn: 10, capacity: 6,  status: 'filling',  enrolled: 5,  stack: 200  },
    { id: 't5', kind: 'classic', buyIn: 20, capacity: 4,  status: 'running',  enrolled: 4,  stack: 1000 },
    { id: 't6', kind: 'classic', buyIn: 50, capacity: 2,  status: 'completed',enrolled: 2,  stack: 1000 },
  ]);

  // Filtri lobby
  const [showCompleted, setShowCompleted] = useState(false); // default OFF (richiesta 2)
  const [buyInRange, setBuyInRange] = useState<[number, number]>([1, 50]);
  const [capRange, setCapRange] = useState<[number, number]>([2, 20]);

  const filteredTables = useMemo(() => {
    return tables.filter(t => {
      if (!showCompleted && t.status === 'completed') return false;
      if (t.buyIn < buyInRange[0] || t.buyIn > buyInRange[1]) return false;
      if (t.capacity < capRange[0] || t.capacity > capRange[1]) return false;
      return true;
    }).sort((a,b) => a.buyIn - b.buyIn || a.capacity - b.capacity);
  }, [tables, showCompleted, buyInRange, capRange]);

  // “Crea tavolo” collapsible (richiesta 1)
  const [showCreate, setShowCreate] = useState(false);
  const [newBuyIn, setNewBuyIn] = useState(5);
  const [newCap, setNewCap] = useState(10);
  const [newStack, setNewStack] = useState<1000|200>(1000);

  function createTable() {
    const id = `t${Date.now()}`;
    const t: Table = { id, kind: 'classic', buyIn: newBuyIn, capacity: newCap, status: 'filling', enrolled: 0, stack: newStack };
    setTables(prev => [t, ...prev]);
    setShowCreate(false);
  }

  function joinTable(t: Table) {
    setCurrentTable(t);
    setView('builder');
  }

  return (
    <main className={`${roboto.className} min-h-screen bg-gradient-to-br from-[#0b1222] via-[#0f1b33] to-[#0b1222] text-white p-4`}>
      {view === 'lobby' && (
        <div className="max-w-6xl mx-auto space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Fast Fanta &amp; Go</h1>
            <button
              onClick={() => setShowCreate(s => !s)}
              className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700"
            >
              {showCreate ? 'Chiudi pannello' : 'Crea tavolo'}
            </button>
          </div>

          {/* Pannello Crea tavolo (collassabile) */}
          {showCreate && (
            <div className="rounded-xl border border-emerald-400/30 bg-white/5 p-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs text-white/70">Buy-in (€)</label>
                  <input
                    type="range" min={1} max={50} step={1}
                    value={newBuyIn}
                    onChange={(e)=> setNewBuyIn(Number(e.target.value))}
                    className="w-full"
                  />
                  <div className="text-sm mt-1">{newBuyIn}€</div>
                </div>
                <div>
                  <label className="text-xs text-white/70">Capienza giocatori</label>
                  <input
                    type="range" min={2} max={20} step={2}
                    value={newCap}
                    onChange={(e)=> setNewCap(Number(e.target.value))}
                    className="w-full"
                  />
                  <div className="text-sm mt-1">{newCap} giocatori</div>
                </div>
                <div>
                  <label className="text-xs text-white/70">Stack/Budget</label>
                  <div className="flex gap-2 mt-1">
                    <button
                      onClick={()=> setNewStack(1000)}
                      className={`px-3 py-2 rounded-lg ${newStack===1000?'bg-emerald-600':'bg-white/10 hover:bg-white/15'}`}
                    >1000</button>
                    <button
                      onClick={()=> setNewStack(200)}
                      className={`px-3 py-2 rounded-lg ${newStack===200?'bg-emerald-600':'bg-white/10 hover:bg-white/15'}`}
                    >200</button>
                  </div>
                </div>
                <div className="flex items-end">
                  <button onClick={createTable} className="w-full px-3 py-2 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-700">Crea</button>
                </div>
              </div>
              <p className="text-xs text-white/60 mt-2">Nota: nella demo la rake non viene applicata realmente, è solo un placeholder.</p>
            </div>
          )}

          {/* Filtri lobby */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-white/70">Filtra buy-in (€)</label>
                <div className="flex items-center gap-3">
                  <input type="range" min={1} max={50} step={1} value={buyInRange[0]} onChange={(e)=> setBuyInRange([Number(e.target.value), buyInRange[1]])} className="w-full" />
                  <input type="range" min={1} max={50} step={1} value={buyInRange[1]} onChange={(e)=> setBuyInRange([buyInRange[0], Number(e.target.value)])} className="w-full" />
                </div>
                <div className="text-sm mt-1">{buyInRange[0]}€ — {buyInRange[1]}€</div>
              </div>
              <div>
                <label className="text-xs text-white/70">Filtra capienza</label>
                <div className="flex items-center gap-3">
                  <input type="range" min={2} max={20} step={2} value={capRange[0]} onChange={(e)=> setCapRange([Number(e.target.value), capRange[1]])} className="w-full" />
                  <input type="range" min={2} max={20} step={2} value={capRange[1]} onChange={(e)=> setCapRange([capRange[0], Number(e.target.value)])} className="w-full" />
                </div>
                <div className="text-sm mt-1">{capRange[0]} — {capRange[1]} gioc.</div>
              </div>
              <div className="flex items-end">
                <button
                  onClick={()=> setShowCompleted(s=> !s)}
                  className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15"
                >
                  {showCompleted ? 'Nascondi completati' : 'Mostra completati'}
                </button>
              </div>
            </div>
          </div>

          {/* Lista tavoli */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredTables.map(t => (
              <div key={t.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm text-white/70">Classic • stack {t.stack}</div>
                  <span className={`text-xs px-2 py-1 rounded-full ${t.status==='completed'?'bg-gray-600/40':t.status==='running'?'bg-emerald-700/50':'bg-amber-700/50'}`}>
                    {t.status}
                  </span>
                </div>
                <div className="text-2xl font-bold">{t.buyIn}€</div>
                <div className="text-sm text-white/80 mb-3">{t.enrolled}/{t.capacity} iscritti</div>
                <button
                  onClick={()=> joinTable(t)}
                  className="w-full px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-500/40"
                  disabled={t.status==='completed'}
                >
                  {t.status==='completed' ? 'Chiuso' : 'Entra'}
                </button>
              </div>
            ))}
            {filteredTables.length===0 && (
              <div className="col-span-full text-white/70 text-sm">Nessun tavolo con i filtri correnti.</div>
            )}
          </div>
        </div>
      )}

      {view === 'builder' && currentTable && (
        <div className="max-w-6xl mx-auto space-y-4">
          <button onClick={()=> setView('lobby')} className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15">← Torna alla lobby</button>
          <ClassicBuilder
            budget={currentTable.stack}
            onConfirm={(team) => {
              const score = simulateClassicScore();
              setResultScore(score);
              setView('result');
            }}
          />
        </div>
      )}

      {view === 'result' && (
        <div className="max-w-3xl mx-auto mt-6">
          <div className="rounded-2xl border border-white/10 bg-[#0f1b33]/80 p-6 shadow-lg">
            <h2 className="text-xl font-semibold mb-2">Simulazione completata</h2>
            <p className="text-white/80 mb-4">Punteggio squadra (demo):</p>
            <div className="text-5xl font-bold text-emerald-300">{resultScore}</div>
            <p className="text-sm text-white/60 mt-3">Colori ridotti per massima leggibilità. Nella demo il calcolo è fittizio.</p>
            <div className="mt-6 flex gap-2">
              <button onClick={()=> setView('lobby')} className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15">Torna ai tavoli</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
