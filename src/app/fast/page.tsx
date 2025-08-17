'use client';
import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Users, Trophy, Filter, PlusCircle, Rocket, Coins, Home, Gamepad2 } from 'lucide-react';
import { BUY_INS, CAPACITY_BY_MODE, DEMO_RAKE, Mode, Table, newId, payoutPerc, makeBotName } from '@/lib/fast/game';

type FilterState = { mode: Mode; buyIn: number; capacity: number; };
const LOBBY_KEY = 'fast.demo.lobby.tables';

function loadTables(): Table[] { if (typeof window==='undefined') return []; try { return JSON.parse(localStorage.getItem(LOBBY_KEY)||'[]') as Table[]; } catch { return []; } }
function saveTables(t: Table[]) { if (typeof window==='undefined') return; localStorage.setItem(LOBBY_KEY, JSON.stringify(t)); }
function ensureDemoSeed(tables: Table[]): Table[] {
  if (tables.length) return tables;
  const now = Date.now();
  const seed: Table[] = [
    { id:newId('demo'), mode:'classic', buyIn:5, rake:DEMO_RAKE, capacity:CAPACITY_BY_MODE.classic, status:'waiting', createdAt:now, seats:[{name:'Guest', isBot:false}] },
    { id:newId('demo'), mode:'classic', buyIn:1, rake:DEMO_RAKE, capacity:CAPACITY_BY_MODE.classic, status:'waiting', createdAt:now, seats:Array.from({length:6}).map((_,i)=>({name:makeBotName(i), isBot:true}))},
    { id:newId('demo'), mode:'top100', buyIn:10, rake:DEMO_RAKE, capacity:CAPACITY_BY_MODE.top100, status:'waiting', createdAt:now, seats:Array.from({length:3}).map((_,i)=>({name:makeBotName(i), isBot:true}))},
  ];
  saveTables(seed); return seed;
}

export default function FastLobbyPage() {
  const [tables, setTables] = useState<Table[]>([]);
  const [you, setYou] = useState<string>('');
  const [f, setF] = useState<FilterState>({ mode: 'classic', buyIn: 1, capacity: 20 });

  useEffect(() => {
    setTables(ensureDemoSeed(loadTables()));
    const saved = localStorage.getItem('fast.demo.you') || '';
    setYou(saved || `Player_${Math.random().toString(36).slice(2,6)}`);
  }, []);
  useEffect(() => { if (you) localStorage.setItem('fast.demo.you', you); }, [you]);

  const filtered = useMemo(() =>
    tables.filter(t => t.mode===f.mode && t.buyIn===f.buyIn && (f.mode==='classic' ? [20,50,100].includes(f.capacity) : f.capacity===10))
          .sort((a,b)=>b.createdAt-a.createdAt)
  ,[tables,f]);

  function createTable() {
    const capacity = f.mode==='classic' ? CAPACITY_BY_MODE.classic : CAPACITY_BY_MODE.top100;
    const t: Table = { id:newId('tbl'), mode:f.mode, buyIn:f.buyIn, rake:DEMO_RAKE, capacity, status:'waiting', createdAt:Date.now(), seats:[] };
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

  return (
    <div className="min-h-screen p-4 bg-[url('/fast/bg.jpg')] bg-cover bg-center"
         style={{ backgroundImage: "radial-gradient(ellipse at top, rgba(16,185,129,0.08), rgba(0,0,0,0.85)), url('/fast/bg.jpg')" }}>
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="bg-black/40 backdrop-blur border border-emerald-500/40 rounded-2xl p-4 mb-4 shadow-[0_0_40px_rgba(16,185,129,0.15)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-white">
              <Rocket className="text-emerald-300" />
              <h1 className="text-2xl font-bold tracking-wide">Fast Mode (Demo)</h1>
            </div>
            <Link href="/" className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700">
              <Home size={16}/> App
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-black/40 backdrop-blur border border-emerald-500/40 rounded-2xl p-4 mb-4 text-white">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <div className="text-sm text-white/80">Modalità</div>
                <select value={f.mode} onChange={e=>setF(s=>({...s, mode:e.target.value as Mode}))}
                  className="w-full border border-white/20 bg-white/10 text-white rounded-lg px-3 py-2">
                  <option value="classic">Classic (25 in rosa)</option>
                  <option value="top100">Top 100</option>
                </select>
              </div>
              <div>
                <div className="text-sm text-white/80">Buy-in</div>
                <select value={f.buyIn} onChange={e=>setF(s=>({...s, buyIn:Number(e.target.value)}))}
                  className="w-full border border-white/20 bg-white/10 text-white rounded-lg px-3 py-2">
                  {BUY_INS.map(b => <option key={b} value={b}>€{b}</option>)}
                </select>
              </div>
              <div>
                <div className="text-sm text-white/80">Capienza</div>
                <select value={f.capacity} onChange={e=>setF(s=>({...s, capacity:Number(e.target.value)}))}
                  className="w-full border border-white/20 bg-white/10 text-white rounded-lg px-3 py-2">
                  {f.mode==='classic' ? (<><option value={20}>20 (demo)</option><option value={50}>50 (nom.)</option><option value={100}>100 (nom.)</option></>) : (<option value={10}>10 (demo)</option>)}
                </select>
              </div>
            </div>
            <div className="flex items-end gap-3">
              <div>
                <div className="text-sm text-white/80">Nickname</div>
                <input value={you} onChange={e=>setYou(e.target.value)}
                  className="border border-white/20 bg-white/10 text-white rounded-lg px-3 py-2" />
              </div>
              <button onClick={createTable} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700">
                <PlusCircle size={18}/> Crea tavolo
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

        <p className="mt-4 text-xs text-white/60">Demo: nessuna persistenza server. I posti vengono riempiti da bot e la partita è simulata.</p>
      </div>
    </div>
  );
}
