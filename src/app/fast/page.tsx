'use client';
import React, { useEffect, useMemo, useState } from 'react';
import ClassicBuilder from '@/components/fast/ClassicBuilder';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import { Roboto } from 'next/font/google';

const roboto = Roboto({ subsets: ['latin'], weight: ['300','400','500','700'] });

// ... (tipi, helpers, payoutsForCapacity, simulateClassicScore) restano uguali

export default function FastPage() {
  const [view, setView] = useState<'lobby'|'builder'|'result'>('lobby');
  const [currentTable, setCurrentTable] = useState<Table | null>(null);
  const [leaderboard, setLeaderboard] = useState<Participant[] | null>(null);
  const [resultInfo, setResultInfo] = useState<{ pot: number; rake: number; pool: number } | null>(null);

  // CRASH REPORTER
  const [fatal, setFatal] = useState<string | null>(null);
  useEffect(() => {
    const onErr = (e: ErrorEvent) => {
      setFatal(e?.error?.message || e.message || 'Errore sconosciuto');
      console.error('[window.onerror]', e);
    };
    const onRej = (e: PromiseRejectionEvent) => {
      // @ts-expect-error
      const msg = e?.reason?.message || String(e.reason) || 'Unhandled rejection';
      setFatal(msg);
      console.error('[unhandledrejection]', e);
    };
    window.addEventListener('error', onErr);
    window.addEventListener('unhandledrejection', onRej);
    return () => {
      window.removeEventListener('error', onErr);
      window.removeEventListener('unhandledrejection', onRej);
    };
  }, []);

  // ... (state dei tavoli, filtri, ecc.) invariato

  function joinTable(t: Table) {
    try {
      if (!t || t.status === 'completed') return;
      setCurrentTable(t);
      setView('builder');
    } catch (e) {
      console.error('[joinTable]', e);
      setFatal((e as Error).message);
    }
  }

  function runResult(table: Table, teamSpent: number) {
    try {
      // ... (identico a prima)
      // classifica + payout come prima
    } catch (e) {
      console.error('[runResult]', e);
      setFatal((e as Error).message);
    }
  }

  return (
    <ErrorBoundary>
      <main className={`${roboto.className} min-h-screen bg-gradient-to-br from-[#0b1222] via-[#0f1b33] to-[#0b1222] text-white p-4`}>
        {fatal && (
          <div className="mb-3 rounded-lg border border-amber-400/40 bg-amber-900/20 p-3">
            <div className="text-sm font-semibold">Errore rilevato</div>
            <div className="text-xs opacity-90 mt-1">{fatal}</div>
            <button onClick={()=> setFatal(null)} className="mt-2 px-2 py-1 rounded bg-white/10 hover:bg-white/15 text-xs">Chiudi</button>
          </div>
        )}
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
  const [showCompleted, setShowCompleted] = useState(false); // default OFF
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

  // “Crea tavolo” collapsible
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

  function runResult(table: Table, teamSpent: number) {
    const youName = 'Tu';
    // riempi il tavolo con bot
    const totalPlayers = table.capacity;
    const enroll = Math.max(table.enrolled, totalPlayers - 1); // garantisco che si riempia in demo
    const participants: Participant[] = [];
    const spentRatio = teamSpent / table.stack;

    // il tuo risultato
    const yourScore = simulateClassicScore(spentRatio);
    participants.push({ name: youName, score: yourScore, prize: 0 });

    // bot
    for (let i = 1; i < totalPlayers; i++) {
      const botSpentRatio = 0.75 + Math.random() * 0.25; // bot decenti
      const sc = simulateClassicScore(botSpentRatio);
      participants.push({ name: `Bot ${i}`, score: sc, prize: 0 });
    }

    // classifica
    participants.sort((a, b) => b.score - a.score);

    // montepremi
    const entrants = totalPlayers; // demo: tavolo pieno
    const pot = entrants * table.buyIn;
    const rake = Math.round(pot * 0.10 * 100) / 100;
    const pool = pot - rake;

    // payout
    const pct = payoutsForCapacity(table.capacity);
    const winners = Math.min(pct.length, participants.length);
    for (let i = 0; i < winners; i++) {
      const share = Math.round((pool * (pct[i] / 100)) * 100) / 100;
      participants[i].prize = share;
    }

    setLeaderboard(participants);
    setResultInfo({ pot, rake, pool });
    setView('result');
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

          {/* Pannello Crea tavolo */}
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
              <p className="text-xs text-white/60 mt-2">Nota: nella demo la rake è fissa al 10%.</p>
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
            onConfirm={(_team, budgetLeft) => {
              const spent = currentTable.stack - budgetLeft;
              runResult(currentTable, spent);
            }}
          />
        </div>
      )}

      {view === 'result' && leaderboard && resultInfo && currentTable && (
        <div className="max-w-4xl mx-auto mt-6">
          <div className="rounded-2xl border border-white/10 bg-[#0f1b33]/80 p-6 shadow-lg">
            <h2 className="text-xl font-semibold mb-2">Risultati tavolo</h2>
            <div className="text-sm text-white/70 mb-4">
              Buy-in <span className="font-semibold text-white">{currentTable.buyIn}€</span> • Capienza {currentTable.capacity} • Stack {currentTable.stack}
            </div>

            {/* Payout info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
              <Info label="Montepremi lordo" value={`${resultInfo.pot.toFixed(2)}€`} />
              <Info label="Rake (10%)" value={`-${resultInfo.rake.toFixed(2)}€`} />
              <Info label="Montepremi netto" value={`${resultInfo.pool.toFixed(2)}€`} accent />
            </div>

            {/* Classifica */}
            <div className="overflow-x-auto rounded-lg border border-white/10">
              <table className="w-full text-sm">
                <thead className="bg-white/5">
                  <tr>
                    <th className="text-left px-3 py-2">#</th>
                    <th className="text-left px-3 py-2">Giocatore</th>
                    <th className="text-right px-3 py-2">Punteggio</th>
                    <th className="text-right px-3 py-2">Premio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {leaderboard.map((p, i) => (
                    <tr key={i} className="hover:bg-white/5">
                      <td className="px-3 py-2">{i+1}</td>
                      <td className="px-3 py-2">{p.name}</td>
                      <td className="px-3 py-2 text-right">{p.score}</td>
                      <td className={`px-3 py-2 text-right ${p.prize>0?'text-emerald-300 font-semibold':'text-white/60'}`}>
                        {p.prize>0 ? `${p.prize.toFixed(2)}€` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 flex gap-2">
              <button onClick={()=> setView('lobby')} className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15">Torna ai tavoli</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function Info({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-lg px-3 py-3 border border-white/10 ${accent ? 'bg-emerald-700/30' : 'bg-white/5'}`}>
      <div className="text-xs text-white/70">{label}</div>
      <div className={`text-lg ${accent ? 'text-emerald-200 font-semibold' : 'text-white'}`}>{value}</div>
    </div>
  );
}
