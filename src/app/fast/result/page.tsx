'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

type ClassicRole = 'P'|'D'|'C'|'A';
type Player = { id: string; name: string; team: string; role: ClassicRole; price: number };

type Saved = {
  tableId: string;
  kind: string;
  buyIn: number;
  capacity: number;
  stack: number;
  team: Player[];
  left: number;
  ts: number;
};

type Row = { name: string; isYou: boolean; score: number; prize: number };

export default function ResultPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const tableId = sp.get('id') ?? 't0';
  const buyIn = Number(sp.get('buyIn') ?? 1);
  const capacity = Number(sp.get('cap') ?? 20);
  const stack = Number(sp.get('stack') ?? 1000);
  const kind = sp.get('kind') ?? 'classic';

  const [saved, setSaved] = useState<Saved | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('fast:lastRoster');
      if (raw) setSaved(JSON.parse(raw));
    } catch {}
  }, []);

  const { leaderboard, pot, rake, net, payoutDesc } = useMemo(() => {
    // sicurezza
    const your = saved?.team?.length ? saved.team : [];
    // punteggio “demo”: in range 55–95, bonus piccolo se hai speso quasi tutto
    const youScore = Math.round(55 + Math.random()*30 + Math.min(10, Math.max(0, (saved ? (saved.stack - saved.left) : 0)/saved!.stack*10)));

    // genera bot
    const bots: Row[] = [];
    const nBots = Math.max(0, capacity - 1);
    for (let i=0;i<nBots;i++){
      const s = Math.round(55 + Math.random()*40);
      bots.push({ name: `Bot ${i+1}`, isYou:false, score:s, prize:0 });
    }
    let rows: Row[] = [{ name: 'Tu', isYou:true, score: youScore, prize:0 }, ...bots];
    rows.sort((a,b)=> b.score - a.score);

    // montepremi & payout
    const pot = buyIn * capacity;
    const rake = Math.round(pot * 0.10 * 100)/100;
    const net = pot - rake;

    const payout = getPayout(capacity, net);
    const payoutDesc = `Payout: ${payout.map((v,i)=>`#${i+1} €${v.toFixed(2)}`).join(' • ')}`;

    rows = rows.map((r, idx) => ({ ...r, prize: payout[idx] ?? 0 }));

    return { leaderboard: rows, pot, rake, net, payoutDesc };
  }, [saved, buyIn, capacity]);

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
            <button onClick={()=>router.push('/fast')} className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15">Torna alla lobby</button>
            <button onClick={()=>router.push(`/fast/build?id=${tableId}&buyIn=${buyIn}&cap=${capacity}&stack=${stack}&kind=${kind}`)} className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700">Crea un’altra squadra</button>
          </div>
        </header>

        {!saved?.team?.length ? (
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            Nessuna rosa trovata. Torna al builder.
          </div>
        ) : (
          <>
            <section className="bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="text-sm text-white/80 mb-2">
                Montepremi €{pot.toFixed(2)} • Rake 10% €{rake.toFixed(2)} • Netto €{net.toFixed(2)}
              </div>
              <div className="text-xs text-white/70 mb-3">{payoutDesc}</div>

              <table className="w-full text-sm">
                <thead className="text-left">
                  <tr className="text-white/70">
                    <th className="py-2 px-2">#</th>
                    <th className="py-2 px-2">Giocatore</th>
                    <th className="py-2 px-2 text-right">Punteggio</th>
                    <th className="py-2 px-2 text-right">Premio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {leaderboard.map((r, idx) => (
                    <tr key={idx} className={r.isYou ? 'bg-emerald-900/20' : ''}>
                      <td className="py-2 px-2">{idx+1}</td>
                      <td className="py-2 px-2">{r.name}{r.isYou && ' (Tu)'}</td>
                      <td className="py-2 px-2 text-right">{r.score}</td>
                      <td className="py-2 px-2 text-right">{r.prize ? `€${r.prize.toFixed(2)}` : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="bg-white/5 border border-white/10 rounded-xl p-4">
              <h3 className="font-semibold mb-2">La tua rosa</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {saved.team.map((p,i)=>(
                  <div key={`${p.id}-${i}`} className="rounded-lg bg-white/10 border border-white/10 px-3 py-2">
                    <div className="font-semibold">{p.role} • {p.name}</div>
                    <div className="text-xs text-white/70">{p.team}</div>
                    <div className="text-xs text-white/90">FVM {p.price}</div>
                  </div>
                ))}
              </div>
              <div className="text-sm text-white/80 mt-2">
                Crediti non spesi: <span className="font-semibold">{saved.left}</span>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function getPayout(capacity: number, net: number): number[] {
  // Regole demo: 10→top3, 20→top5, 50→top10, 100→top18
  // Percentuali semplici (somma 100%)
  if (capacity <= 10) {
    const perc = [50, 30, 20];
    return perc.map(p => (p/100)*net);
  }
  if (capacity <= 20) {
    const perc = [40, 25, 18, 10, 7];
    return perc.map(p => (p/100)*net);
  }
  if (capacity <= 50) {
    const perc = [20, 15, 12, 10, 8, 7, 6, 5, 4, 3];
    return perc.map(p => (p/100)*net);
  }
  // 100
  const perc = [12,10,9,8,7,6,5,5,4,4,3,3,3,2.5,2.5,2,1.5,1.5];
  return perc.map(p => (p/100)*net);
}
