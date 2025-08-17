'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { notFound, useParams, useRouter } from 'next/navigation';
import { Table, Mode, CAPACITY_BY_MODE, DEMO_RAKE, newId, simulateClassicScores, simulateTop100Scores, computePayouts } from '@/lib/fast/game';
import { Users, TimerReset, Crown, Home, ArrowLeft, Loader2 } from 'lucide-react';

const KEY = 'fast.demo.lobby.tables';

function loadAll(): Table[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') as Table[]; } catch { return []; }
}
function saveAll(tables: Table[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify(tables));
}

export default function FastTablePage() {
  const { tableId } = useParams<{ tableId: string }>();
  const router = useRouter();
  const [tables, setTables] = useState<Table[]>([]);
  const [you, setYou] = useState<string>('');
  const [loadingSim, setLoadingSim] = useState(false);

  useEffect(() => {
    const all = loadAll();
    setTables(all);
    const savedNick = localStorage.getItem('fast.demo.you') || '';
    setYou(savedNick || `Player_${Math.random().toString(36).slice(2,6)}`);
  }, []);

  const table = useMemo(() => tables.find(t => t.id === tableId), [tables, tableId]);

  // Se l'utente arriva qui senza tavolo, torna in lobby
  useEffect(() => {
    if (!table) return;
    if (table.status === 'waiting') {
      // se per qualche motivo sei qui con tavolo "waiting", portalo in running
      const next = tables.map(t => t.id === table.id ? { ...t, status: 'running' } : t);
      setTables(next); saveAll(next);
    }
  }, [table?.id]);

  if (!tableId) return notFound();
  if (!table) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-2">Tavolo non trovato.</p>
          <Link href="/fast" className="px-3 py-2 rounded-lg bg-gray-900 text-white">Torna alla Lobby</Link>
        </div>
      </div>
    );
  }

  function simulateNow() {
    if (table.status === 'finished') return;
    setLoadingSim(true);
    setTimeout(() => {
      const withScores = table.mode === 'classic'
        ? { ...table, seats: simulateClassicScores(table.seats) }
        : { ...table, seats: simulateTop100Scores(table.seats) };
      const finalized = { ...computePayouts(withScores), status: 'finished' as const };
      const next = tables.map(t => t.id === table.id ? finalized : t);
      setTables(next); saveAll(next);
      setLoadingSim(false);
    }, 1300);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-indigo-50 p-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow p-4 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crown className="text-emerald-600" />
            <div>
              <div className="font-bold text-gray-900">{table.mode === 'classic' ? 'Classic' : 'Top 100'} • €{table.buyIn}</div>
              <div className="text-xs text-gray-600">{table.id}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/fast" className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800">
              <ArrowLeft size={16}/> Lobby
            </Link>
            <Link href="/" className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-lg bg-gray-900 text-white">
              <Home size={16}/> App
            </Link>
          </div>
        </div>

        {/* Stato tavolo */}
        <div className="bg-white rounded-xl shadow p-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="text-gray-700">
              <div className="font-semibold">Stato: <span className={table.status === 'finished' ? 'text-emerald-700' : 'text-blue-700'}>{table.status.toUpperCase()}</span></div>
              <div className="text-sm">Posti: {table.seats.length}/{table.capacity} • Rake: {Math.round(table.rake*100)}%</div>
            </div>
            <div className="flex items-center gap-2">
              {table.status !== 'finished' ? (
                <button
                  onClick={simulateNow}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                  disabled={loadingSim}
                >
                  {loadingSim ? <Loader2 className="animate-spin" size={16}/> : <TimerReset size={16}/>}
                  Simula esito
                </button>
              ) : (
                <div className="text-sm text-emerald-700 font-semibold">Partita conclusa</div>
              )}
            </div>
          </div>
        </div>

        {/* Seats */}
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <div className="px-4 py-3 border-b text-gray-700 flex items-center gap-2">
            <Users size={16}/> Partecipanti
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4">
            {table.seats.map((s, i) => (
              <div key={i} className="border rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{s.name}{s.name === you ? ' (tu)' : ''}</div>
                    <div className="text-xs text-gray-500">{s.isBot ? 'Bot' : 'Umano'}</div>
                  </div>
                  {table.status === 'finished' && (
                    <div className="text-right">
                      <div className="text-sm text-gray-700">Score: <span className="font-semibold">{s.score ?? '-'}</span></div>
                      {typeof s.prize === 'number' && s.prize > 0 && (
                        <div className="text-sm text-emerald-700 font-semibold">€ {s.prize.toFixed(2)}</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Winners */}
          {table.status === 'finished' && table.winners && (
            <div className="border-t p-4">
              <div className="font-semibold text-gray-800 mb-2">Classifica & Payout</div>
              <div className="space-y-2">
                {table.winners.map((w, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Crown className="text-emerald-600" size={18}/>
                      <span className="font-semibold">#{idx+1}</span>
                      <span>{w.name}</span>
                    </div>
                    <div className="text-sm">
                      <span className="mr-4 text-gray-700">Score: <strong>{w.score}</strong></span>
                      <span className="text-emerald-700 font-semibold">€ {(w.prize ?? 0).toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 text-sm text-gray-600">
                Pot netto: <strong>€ {table.pot?.toFixed(2)}</strong> • Rake totale: <strong>€ {table.rakeTotal?.toFixed(2)}</strong>
              </div>
            </div>
          )}
        </div>

        <p className="mt-4 text-xs text-gray-500">
          Questa è una simulazione senza persistenza server. Per un vero multiplayer servono WebSocket/DB.
        </p>
      </div>
    </div>
  );
}
