'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Users, Trophy, Filter, PlusCircle, Rocket, Coins, Home } from 'lucide-react';
import { BUY_INS, CAPACITY_BY_MODE, DEMO_RAKE, Mode, Table, newId, payoutPerc, makeBotName } from '@/lib/fast/game';

type FilterState = {
  mode: Mode;      // classic | top100
  buyIn: number;   // 1 | 5 | 10
  capacity: number; // nominale per UI (20 | 50 | 100) ma in demo usiamo solo 20 per classic, 10 per top100
};

const LOBBY_KEY = 'fast.demo.lobby.tables';

// Per questa demo usiamo localStorage per salvare i tavoli
function loadTables(): Table[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(LOBBY_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw) as Table[]; } catch { return []; }
}
function saveTables(tables: Table[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOBBY_KEY, JSON.stringify(tables));
}

function ensureDemoSeed(tables: Table[], mode: Mode): Table[] {
  if (tables.length > 0) return tables;
  // crea 2-3 tavoli di esempio
  const t1: Table = {
    id: newId('demo'),
    mode: 'classic',
    buyIn: 5,
    rake: DEMO_RAKE,
    capacity: CAPACITY_BY_MODE.classic,
    status: 'waiting',
    createdAt: Date.now(),
    seats: [{ name: 'Guest', isBot: false }],
  };
  const t2: Table = {
    id: newId('demo'),
    mode: 'classic',
    buyIn: 1,
    rake: DEMO_RAKE,
    capacity: CAPACITY_BY_MODE.classic,
    status: 'waiting',
    createdAt: Date.now(),
    seats: Array.from({ length: 6 }).map((_, i) => ({ name: makeBotName(i), isBot: true })),
  };
  const t3: Table = {
    id: newId('demo'),
    mode: 'top100',
    buyIn: 10,
    rake: DEMO_RAKE,
    capacity: CAPACITY_BY_MODE.top100,
    status: 'waiting',
    createdAt: Date.now(),
    seats: Array.from({ length: 3 }).map((_, i) => ({ name: makeBotName(i), isBot: true })),
  };
  const seed = [t1, t2, t3];
  saveTables(seed);
  return seed;
}

export default function FastLobbyPage() {
  const [tables, setTables] = useState<Table[]>([]);
  const [you, setYou] = useState<string>('');
  const [f, setF] = useState<FilterState>({ mode: 'classic', buyIn: 1, capacity: 20 });

  useEffect(() => {
    const init = loadTables();
    setTables(ensureDemoSeed(init, f.mode));
    // nickname locale
    const saved = localStorage.getItem('fast.demo.you') || '';
    setYou(saved || `Player_${Math.random().toString(36).slice(2,6)}`);
  }, []);

  useEffect(() => {
    if (you) localStorage.setItem('fast.demo.you', you);
  }, [you]);

  const filtered = useMemo(() => {
    return tables.filter(t =>
      t.mode === f.mode &&
      t.buyIn === f.buyIn &&
      (f.mode === 'classic' ? [20,50,100].includes(f.capacity) : f.capacity === 10)
    ).sort((a, b) => b.createdAt - a.createdAt);
  }, [tables, f]);

  function createTable() {
    const capacity = f.mode === 'classic' ? CAPACITY_BY_MODE.classic : CAPACITY_BY_MODE.top100;
    const t: Table = {
      id: newId('tbl'),
      mode: f.mode,
      buyIn: f.buyIn,
      rake: DEMO_RAKE,
      capacity,
      status: 'waiting',
      createdAt: Date.now(),
      seats: [],
    };
    const next = [t, ...tables];
    setTables(next);
    saveTables(next);
  }

  function joinTable(id: string) {
    const next = tables.map(t => {
      if (t.id !== id) return t;
      if (t.status !== 'waiting') return t;
      if (t.seats.some(s => s.name === you)) return t;
      if (t.seats.length >= t.capacity) return t;
      return { ...t, seats: [...t.seats, { name: you || 'Guest', isBot: false }] };
    });
    setTables(next);
    saveTables(next);
  }

  // Per la demo: riempiamo di bot e partiamo
  function fillAndStart(id: string) {
    const next = tables.map(t => {
      if (t.id !== id) return t;
      if (t.status !== 'waiting') return t;
      let seats = [...t.seats];
      for (let i = seats.length; i < t.capacity; i++) {
        seats.push({ name: makeBotName(i), isBot: true });
      }
      return {
        ...t,
        seats,
        status: 'running',
      };
    });
    setTables(next);
    saveTables(next);
    // si va alla pagina tavolo
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-emerald-50 p-4">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="bg-white rounded-xl shadow p-4 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Rocket className="text-emerald-600" />
            <h1 className="text-2xl font-bold text-gray-800">Fast Mode (Demo)</h1>
          </div>
          <Link href="/" className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-lg bg-gray-900 text-white hover:bg-black">
            <Home size={16}/> Torna all’App
          </Link>
        </div>

        {/* Pannello filtri/creazione */}
        <div className="bg-white rounded-xl shadow p-4 mb-4">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-sm text-gray-600">Modalità</label>
                <select
                  value={f.mode}
                  onChange={e => setF(s => ({ ...s, mode: e.target.value as Mode }))}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="classic">Classic (25 in rosa)</option>
                  <option value="top100">Top 100 (stile poker)</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-600">Buy-in</label>
                <select
                  value={f.buyIn}
                  onChange={e => setF(s => ({ ...s, buyIn: Number(e.target.value) }))}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  {BUY_INS.map(b => <option key={b} value={b}>€{b}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-600">Capienza</label>
                <select
                  value={f.capacity}
                  onChange={e => setF(s => ({ ...s, capacity: Number(e.target.value) }))}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  {f.mode === 'classic' ? (
                    <>
                      <option value={20}>20 (demo)</option>
                      <option value={50}>50 (nominale)</option>
                      <option value={100}>100 (nominale)</option>
                    </>
                  ) : (
                    <option value={10}>10 (demo)</option>
                  )}
                </select>
              </div>
            </div>

            <div className="flex items-end gap-3">
              <div>
                <label className="text-sm text-gray-600">Il tuo nickname</label>
                <input
                  value={you}
                  onChange={e => setYou(e.target.value)}
                  className="border rounded-lg px-3 py-2"
                  placeholder="Es. Splash"
                />
              </div>
              <button onClick={createTable} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700">
                <PlusCircle size={18}/> Crea tavolo
              </button>
            </div>
          </div>
        </div>

        {/* Lista tavoli */}
        <div className="bg-white rounded-xl shadow">
          <div className="px-4 py-3 border-b flex items-center gap-2 text-gray-700">
            <Filter size={16}/> Tavoli disponibili
          </div>

          {filtered.length === 0 ? (
            <div className="p-6 text-gray-500">Nessun tavolo. Crea il primo!</div>
          ) : (
            <div className="divide-y">
              {filtered.map(t => {
                const joined = t.seats.length;
                const perc = payoutPerc(t.capacity);
                return (
                  <div key={t.id} className="p-4 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-emerald-50 flex items-center justify-center">
                      <Trophy className="text-emerald-600"/>
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900">
                        {t.mode === 'classic' ? 'Classic' : 'Top 100'} • €{t.buyIn} • {joined}/{t.capacity} posti
                      </div>
                      <div className="text-sm text-gray-600">
                        Rake {Math.round(t.rake * 100)}% • Payout: {perc.length} posizioni
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="text-sm text-gray-700 flex items-center gap-1">
                        <Coins size={16}/> Buy-in: <span className="font-semibold">€{t.buyIn}</span>
                      </div>
                      <button
                        onClick={() => joinTable(t.id)}
                        disabled={t.status !== 'waiting' || t.seats.some(s => s.name === you)}
                        className={`px-3 py-2 rounded-lg text-white ${t.status === 'waiting' && !t.seats.some(s => s.name === you) ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-300 cursor-not-allowed'}`}
                        title={t.status !== 'waiting' ? 'Tavolo non in attesa' : t.seats.some(s => s.name === you) ? 'Hai già aderito' : 'Unisciti'}
                      >
                        Unisciti
                      </button>
                      <Link
                        href={`/fast/table/${t.id}`}
                        onClick={() => fillAndStart(t.id)}
                        className="px-3 py-2 rounded-lg bg-gray-900 text-white hover:bg-black"
                      >
                        Entra
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Nota demo */}
        <p className="mt-4 text-xs text-gray-500">
          Demo: i posti vengono riempiti da bot e la partita viene simulata al volo. Nessuna persistenza server-side.
        </p>
      </div>
    </div>
  );
}
