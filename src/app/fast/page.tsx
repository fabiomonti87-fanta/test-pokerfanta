'use client';
import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Users, Trophy, Filter, PlusCircle, Rocket, Coins, Home, Gamepad2, Sliders } from 'lucide-react';
import { BUY_INS, CAPACITY_STEPS, DEMO_RAKE, Mode, Table, newId, payoutPerc, makeBotName } from '@/lib/fast/game';

type FilterState = {
  mode: Mode;
  buyInMinIdx: number; buyInMaxIdx: number;   // range su BUY_INS
  capMinIdx: number;   capMaxIdx: number;     // range su CAPACITY_STEPS
};

const LOBBY_KEY = 'fast.demo.lobby.tables';

function loadTables(): Table[] { if (typeof window==='undefined') return []; try { return JSON.parse(localStorage.getItem(LOBBY_KEY)||'[]') as Table[]; } catch { return []; } }
function saveTables(t: Table[]) { if (typeof window==='undefined') return; localStorage.setItem(LOBBY_KEY, JSON.stringify(t)); }

function ensureDemoSeed(tables: Table[]): Table[] {
  if (tables.length) return tables;
  const now = Date.now();
  const mk = (mode: Mode, buyIn: number, capacity: number, stack?: number, seats=0): Table => ({
    id: newId('demo'), mode, buyIn, rake: DEMO_RAKE, capacity, budgetStack: stack, status: 'waiting', createdAt: now,
    title: 'Demo', seats: Array.from({length:seats}).map((_,i)=>({name:makeBotName(i), isBot:true}))
  });
  const seed: Table[] = [
    mk('classic', 1, 20, 1000, 6),
    mk('classic', 2, 10, 200, 3),
    mk('classic', 5, 6, 200, 2),
    mk('classic', 10, 4, 1000, 1),
    mk('top100', 5, 10, undefined, 4),
    mk('classic', 20, 20, 1000, 8),
    mk('classic', 50, 2, 200, 1),
  ];
  saveTables(seed); return seed;
}

export default function FastLobbyPage() {
  const [tables, setTables] = useState<Table[]>([]);
  const [you, setYou] = useState<string>('');
  const [createBuyIn, setCreateBuyIn] = useState<number>(5);
  const [createCapacity, setCreateCapacity] = useState<number>(20);
  const [createStack, setCreateStack] = useState<number>(1000); // 1000 o 200
  const [f, setF] = useState<FilterState>({
    mode: 'classic',
    buyInMinIdx: 0, buyInMaxIdx: BUY_INS.length-1,
    capMinIdx: 0, capMaxIdx: 4, // fino a 20 di default
  });

  useEffect(() => {
    setTables(ensureDemoSeed(loadTables()));
    const saved = localStorage.getItem('fast.demo.you') || '';
    setYou(saved || `Player_${Math.random().toString(36).slice(2,6)}`);
  }, []);
  useEffect(() => { if (you) localStorage.setItem('fast.demo.you', you); }, [you]);

  const buyInMin = BUY_INS[f.buyInMinIdx];
  const buyInMax = BUY_INS[f.buyInMaxIdx];
  const capMin = CAPACITY_STEPS[f.capMinIdx];
  const capMax = CAPACITY_STEPS[f.capMaxIdx];

  const filtered = useMemo(() =>
    tables
      .filter(t => t.mode === f.mode)
      .filter(t => t.buyIn >= buyInMin && t.buyIn <= buyInMax)
      .filter(t => t.capacity >= capMin && t.capacity <= capMax)
      .sort((a,b)=>b.createdAt-a.createdAt)
  ,[tables,f, buyInMin, buyInMax, capMin, capMax]);

  function createTable() {
    const t: Table = {
      id: newId('tbl'),
      mode: f.mode,
      buyIn: createBuyIn,
      rake: DEMO_RAKE,
      capacity: createCapacity,
      budgetStack: f.mode === 'classic' ? createStack : undefined,
      status: 'waiting',
      createdAt: Date.now(),
      seats: [],
      title: 'Custom',
    };
    const next = [t, ...tables]; setTables(next); saveTables(next);
  }

  function joinTable(id: string) {
    const next = tables.map(t => {
      if (t.id!==id || t.status!=='waiting' || t.seats.length>=t.capacity || t.seats.some(s=>s.name===you)) return t;
      return { ...t, seats:[...t.seats, { name: you || 'Guest', isBot:false }] };
    });
    setTables(next); saveTables(next);
  }

  function fillAndStart(id: string) {
    const next = tables.map(t => {
      if (t.id!==id || t.status!=='waiting') return t;
      let seats=[...t.seats];
      for (let i=seats.length;i<t.capacity;i++) seats.push({ name: `Bot ${i+1}`, isBot:true });
      return { ...t, seats, status:'running' as const };
    });
    setTables(next); saveTables(next);
  }

  // helpers marks
  const marks = (arr: readonly number[]) => arr.map((v,i)=><span key={i} className="text-xs text-white/70">{v}</span>);

  return (
    <div className="min-h-screen p-4"
         style={{ backgroundImage: "radial-gradient(ellipse at top, rgba(16,185,129,0.08), rgba(0,0,0,0.85)), url('/fast/bg.jpg')", backgroundSize:'cover', backgroundPosition:'center' }}>
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="bg-black/40 backdrop-blur border border-emerald-500/40 rounded-2xl p-4 mb-4 shadow-[0_0_40px_rgba(16,185,129,0.15)]">
          <div className="flex items-center justify-between text-white">
            <div className="flex items-center gap-3">
              <Rocket className="text-emerald-300" />
              <h1 className="text-2xl font-bold tracking-wide">Fast Fanta &amp; Go — Lobby (Demo)</h1>
            </div>
            <Link href="/" className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700">
              <Home size={16}/> App
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-black/40 backdrop-blur border border-emerald-500/40 rounded-2xl p-4 mb-4 text-white">
          <div className="flex items-center gap-2 mb-3"><Sliders size={16}/> Filtri</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* modalità */}
            <div>
              <div className="text-sm text-white/80 mb-1">Modalità</div>
              <div className="flex gap-2">
                {(['classic','top100'] as Mode[]).map(m => (
                  <button key={m}
                    onClick={()=>setF(s=>({...s, mode:m}))}
                    className={`px-3 py-2 rounded-lg ${f.mode===m?'bg-emerald-600':'bg-white/10 hover:bg-white/20'} text-white`}>
                    {m==='classic' ? 'Classic (25)' : 'Top 100'}
                  </button>
                ))}
              </div>
            </div>

            {/* buy-in range */}
            <div>
              <div className="text-sm text-white/80 mb-2">Buy-in (da {buyInMin}€ a {buyInMax}€)</div>
              <div className="px-1">
                <input type="range" min={0} max={BUY_INS.length-1} step={1}
                       value={f.buyInMinIdx}
                       onChange={e=>setF(s=>({...s, buyInMinIdx: Math.min(Number(e.target.value), s.buyInMaxIdx)}))}
                       className="w-full"/>
                <input type="range" min={0} max={BUY_INS.length-1} step={1}
                       value={f.buyInMaxIdx}
                       onChange={e=>setF(s=>({...s, buyInMaxIdx: Math.max(Number(e.target.value), s.buyInMinIdx)}))}
                       className="w-full -mt-2"/>
                <div className="mt-1 flex justify-between">{marks(BUY_INS)}</div>
              </div>
            </div>

            {/* capienza range */}
            <div>
              <div className="text-sm text-white/80 mb-2">Giocatori (da {capMin} a {capMax})</div>
              <div className="px-1">
                <input type="range" min={0} max={CAPACITY_STEPS.length-1} step={1}
                       value={f.capMinIdx}
                       onChange={e=>setF(s=>({...s, capMinIdx: Math.min(Number(e.target.value), s.capMaxIdx)}))}
                       className="w-full"/>
                <input type="range" min={0} max={CAPACITY_STEPS.length-1} step={1}
                       value={f.capMaxIdx}
                       onChange={e=>setF(s=>({...s, capMaxIdx: Math.max(Number(e.target.value), s.capMinIdx)}))}
                       className="w-full -mt-2"/>
                <div className="mt-1 flex justify-between">{marks(CAPACITY_STEPS)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Creator */}
        <div className="bg-black/40 backdrop-blur border border-emerald-500/40 rounded-2xl p-4 mb-4 text-white">
          <div className="flex items-center gap-2 mb-3"><PlusCircle size={16}/> Crea un tavolo</div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* buy-in selector (segmenti) */}
            <div>
              <div className="text-sm text-white/80 mb-1">Buy-in</div>
              <div className="flex flex-wrap gap-2">
                {BUY_INS.map(v=>(
                  <button key={v} onClick={()=>setCreateBuyIn(v)}
                    className={`px-3 py-2 rounded-lg ${createBuyIn===v?'bg-emerald-600':'bg-white/10 hover:bg-white/20'} text-white`}>
                    €{v}
                  </button>
                ))}
              </div>
            </div>

            {/* capacity selector */}
            <div>
              <div className="text-sm text-white/80 mb-1">Giocatori</div>
              <div className="flex flex-wrap gap-2">
                {[2,4,6,10,20,50].map(v=>(
                  <button key={v} onClick={()=>setCreateCapacity(v)}
                    className={`px-3 py-2 rounded-lg ${createCapacity===v?'bg-emerald-600':'bg-white/10 hover:bg-white/20'} text-white`}>
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {/* stack (solo classic) */}
            <div>
              <div className="text-sm text-white/80 mb-1">Stack (budget rosa)</div>
              <div className="flex flex-wrap gap-2">
                {[200,1000].map(v=>(
                  <button key={v} onClick={()=>setCreateStack(v)}
                    className={`px-3 py-2 rounded-lg ${createStack===v?'bg-emerald-600':'bg-white/10 hover:bg-white/20'} text-white`}>
                    {v}
                  </button>
                ))}
              </div>
              <div className="text-xs text-white/60 mt-1">Usato solo per Classic.</div>
            </div>

            {/* create */}
            <div className="flex items-end">
              <button onClick={createTable} className="w-full px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700">
                Crea tavolo
              </button>
            </div>
          </div>
        </div>

        {/* Tables */}
        <div className="bg-black/40 backdrop-blur border border-emerald-500/40 rounded-2xl overflow-hidden text-white">
          <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
            <Filter size={16}/> Tavoli disponibili
          </div>
          {filtered.length===0 ? (
            <div className="p-6 text-white/70">Nessun tavolo. Crea il primo!</div>
          ) : (
            <div className="divide-y divide-white/10">
              {filtered.map(t => {
                const joined = t.seats.length;
                const perc = payoutPerc(t.capacity);
                return (
                  <div key={t.id} className="p-4 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-emerald-900/40 border border-emerald-500/30 flex items-center justify-center">
                      <Gamepad2 className="text-emerald-300"/>
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold">
                        {t.mode==='classic' ? 'Classic' : 'Top 100'} • €{t.buyIn} • {joined}/{t.capacity} posti
                        {t.mode==='classic' && <span className="ml-2 text-white/70">Stack {t.budgetStack ?? 1000}</span>}
                      </div>
                      <div className="text-sm text-white/70">
                        Rake {Math.round(t.rake*100)}% • Payout: {perc.length} posizioni
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-sm flex items-center gap-1">
                        <Coins size={16}/> Buy-in: <span className="font-semibold">€{t.buyIn}</span>
                      </div>
                      <button
                        onClick={()=>joinTable(t.id)}
                        disabled={t.status!=='waiting' || t.seats.some(s=>s.name===you)}
                        className={`px-3 py-2 rounded-lg ${t.status==='waiting' && !t.seats.some(s=>s.name===you) ? 'bg-blue-600 hover:bg-blue-700' : 'bg-white/20 cursor-not-allowed'} text-white`}
                      >
                        Unisciti
                      </button>
                      <Link href={`/fast/table/${t.id}`} onClick={()=>fillAndStart(t.id)}
                        className="px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700">
                        Entra
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <p className="mt-4 text-xs text-white/60">
          Demo: nessuna persistenza server. I posti vengono riempiti da bot e la partita è simulata.
        </p>
      </div>
    </div>
  );
}
