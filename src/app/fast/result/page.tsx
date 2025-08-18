'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export const dynamic = 'force-dynamic';

type ClassicRole = 'P'|'D'|'C'|'A';
type Player = { id: string; name: string; team: string; role: ClassicRole; price: number };

type SavedRoster = {
  tableId: string;
  kind: string;
  buyIn: number;
  capacity: number;
  stack: number;
  team: Player[];
  left: number;
  formation: string;
  ts: number;
};

type SavedLineup = {
  tableId: string;
  buyIn: number;
  capacity: number;
  stack: number;
  kind: string;
  formation: string;
  xi: Player[];
  bench: Player[];
  ts: number;
};

type Row = { name: string; isYou: boolean; score: number; prize: number };

function getPayout(capacity: number, net: number): number[] {
  if (capacity <= 10) return [50,30,20].map(p => net*p/100);
  if (capacity <= 20) return [40,25,18,10,7].map(p => net*p/100);
  if (capacity <= 50) return [20,15,12,10,8,7,6,5,4,3].map(p => net*p/100);
  const perc = [12,10,9,8,7,6,5,5,4,4,3,3,3,2.5,2.5,2,1.5,1.5];
  return perc.map(p => net*p/100);
}

function Podium({ top3 }: { top3: Row[] }) {
  // ordina 1-2-3
  const [first, second, third] = top3;
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      <div className="rounded-xl bg-white/5 border border-white/10 p-4 text-center order-2 md:order-1">
        <div className="text-amber-500 text-3xl">🥈</div>
        <div className="mt-1 font-semibold">{second?.name ?? '-'}</div>
        <div className="text-sm text-white/80">Score {second?.score ?? '-'}</div>
        <div className="text-emerald-400 font-semibold">{second?.prize ? `€${second.prize.toFixed(2)}` : '-'}</div>
      </div>
      <div className="rounded-xl bg-white/5 border border-yellow-400/30 p-4 text-center order-1 md:order-2">
        <div className="text-yellow-400 text-4xl">🥇</div>
        <div className="mt-1 font-semibold">{first?.name ?? '-'}</div>
        <div className="text-sm text-white/80">Score {first?.score ?? '-'}</div>
        <div className="text-emerald-400 font-semibold">{first?.prize ? `€${first.prize.toFixed(2)}` : '-'}</div>
      </div>
      <div className="rounded-xl bg-white/5 border border-white/10 p-4 text-center order-3 md:order-3">
        <div className="text-orange-400 text-3xl">🥉</div>
        <div className="mt-1 font-semibold">{third?.name ?? '-'}</div>
        <div className="text-sm text-white/80">Score {third?.score ?? '-'}</div>
        <div className="text-emerald-400 font-semibold">{third?.prize ? `€${third.prize.toFixed(2)}` : '-'}</div>
      </div>
    </div>
  );
}

function ResultContent() {
  const router = useRouter();
  const sp = useSearchParams();

  const tableId = sp.get('id') ?? 't0';
  const buyIn = Number(sp.get('buyIn') ?? 1);
  const capacity = Number(sp.get('cap') ?? 20);
  const stack = Number(sp.get('stack') ?? 1000);
  const kind = sp.get('kind') ?? 'classic';

  const [saved, setSaved] = useState<SavedRoster | null>(null);
  const [lineup, setLineup] = useState<SavedLineup | null>(null);

  useEffect(() => {
    try {
      const rosterRaw = localStorage.getItem('fast:lastRoster');
      if (rosterRaw) setSaved(JSON.parse(rosterRaw));
    } catch {}
    try {
      const lineupRaw = localStorage.getItem('fast:lastLineup');
      if (lineupRaw) setLineup(JSON.parse(lineupRaw));
    } catch {}
  }, []);

  const { leaderboard, pot, rake, net, payoutDesc } = useMemo(() => {
    // punteggio base + piccolo bonus qualità XI
    const xi = lineup?.xi ?? [];
    const avgXI = xi.length ? xi.reduce((s,p)=>s+p.price,0)/xi.length : 0;
    const qualityBonus = Math.min(12, Math.max(0, (avgXI/25))); // bonus “soft”
    const youScore = Math.round(55 + Math.random()*25 + qualityBonus);

    const bots: Row[] = [];
    const nBots = Math.max(0, capacity - 1);
    for (let i=0;i<nBots;i++){
      const s = Math.round(55 + Math.random()*40);
      bots.push({ name: `Bot ${i+1}`, isYou:false, score:s, prize:0 });
    }
    let rows: Row[] = [{ name: 'Tu', isYou:true, score: youScore, prize:0 }, ...bots];
    rows.sort((a,b)=> b.score - a.score);

    const pot = buyIn * capacity;
    const rake = Math.round(pot * 0.10 * 100)/100;
    const net = pot - rake;

    const payout = getPayout(capacity, net);
    const payoutDesc = `Payout: ${payout.map((v,i)=>`#${i+1} €${v.toFixed(2)}`).join(' • ')}`;
    rows = rows.map((r, idx) => ({ ...r, prize: payout[idx] ?? 0 }));

    return { leaderboard: rows, pot, rake, net, payoutDesc };
  }, [buyIn, capacity, lineup?.xi]);

  const top3 = leaderboard.slice(0,3);
  const rest = leaderboard.slice(3);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white p-4">
      <div className="max-w-5xl mx-auto space-y-4">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Risultati</h1>
            <div className="text-sm text-white/80">
              Tavolo {tableId} • Modalità {kind} • Buy-in €{buyIn} • Capienza {capacity} • Stack {stack}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => router.push('/fast')} className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15">Torna alla lobby</button>
            <button onClick={() => router.push(`/fast/build?${new URLSearchParams({ id: tableId, buyIn: String(buyIn), cap: String(capacity), stack: String(stack), kind })}`)} className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700">Crea un’altra squadra</button>
          </div>
        </header>

        <section className="rounded-xl bg-white/5 border border-white/10 p-4">
          <div className="text-sm text-white/80 mb-2">
            Montepremi €{pot.toFixed(2)} • Rake 10% €{rake.toFixed(2)} • Netto €{net.toFixed(2)}
          </div>
          <div className="text-xs text-white/70 mb-3">{payoutDesc}</div>

          <Podium top3={top3} />

          <div className="mt-4 rounded-xl overflow-hidden border border-white/10">
            <table className="w-full text-sm">
              <thead className="text-left bg-white/5">
                <tr className="text-white/70">
                  <th className="py-2 px-2">#</th>
                  <th className="py-2 px-2">Giocatore</th>
                  <th className="py-2 px-2 text-right">Punteggio</th>
                  <th className="py-2 px-2 text-right">Premio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {rest.map((r, i) => (
                  <tr key={i} className={r.isYou ? 'bg-emerald-900/20' : ''}>
                    <td className="py-2 px-2">{i+4}</td>
                    <td className="py-2 px-2">{r.name}{r.isYou && ' (Tu)'}</td>
                    <td className="py-2 px-2 text-right">{r.score}</td>
                    <td className="py-2 px-2 text-right">{r.prize ? `€${r.prize.toFixed(2)}` : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {lineup?.xi?.length ? (
          <section className="rounded-xl bg-white/5 border border-white/10 p-4">
            <h3 className="font-semibold mb-2">La tua formazione ({lineup.formation})</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {lineup.xi.map((p,i)=>(
                <div key={`${p.id}-${i}`} className="rounded-lg bg-white/10 border border-white/10 px-3 py-2">
                  <div className="font-semibold">{p.role} • {p.name}</div>
                  <div className="text-xs text-white/70">{p.team}</div>
                  <div className="text-xs text-white/90">FVM {p.price}</div>
                </div>
              ))}
            </div>
            <div className="text-xs text-white/60 mt-2">Panchina: {lineup.bench.length} giocatori</div>
          </section>
        ) : saved?.team?.length ? (
          <section className="rounded-xl bg-white/5 border border-white/10 p-4">
            <div className="text-sm">Non è stata salvata una formazione. Mostro la rosa completa ({saved.team.length}).</div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

export default function ResultPage() {
  return (
    <Suspense fallback={<div className="min-h-screen grid place-items-center bg-slate-900 text-white">Caricamento…</div>}>
      <ResultContent />
    </Suspense>
  );
}
