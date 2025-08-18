'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Player, FormationKey } from '@/components/fast/ClassicBuilder';

export const dynamic = 'force-dynamic';

type Slot = { id: string; x: number; y: number; role: 'P'|'D'|'C'|'A'; assigned?: Player };

function makeSlots(formation: FormationKey): Slot[] {
  const { D, C, A } = parseFormation(formation);
  const slots: Slot[] = [];

  // GK in basso
  slots.push({ id: 'P1', role: 'P', x: 50, y: 90 });

  const spread = (n: number) => Array.from({length:n}, (_,i)=> (100/(n+1))*(i+1));

  // linee difesa-centrocampo-attacco (dal basso verso l’alto)
  spread(D).forEach((x,i)=> slots.push({ id: `D${i+1}`, role:'D', x, y: 70 }));
  spread(C).forEach((x,i)=> slots.push({ id: `C${i+1}`, role:'C', x, y: 50 }));
  spread(A).forEach((x,i)=> slots.push({ id: `A${i+1}`, role:'A', x, y: 30 }));

  return slots;
}

function parseFormation(key: FormationKey) {
  const [d,c,a] = key.split('-').map(n => Number(n));
  return { D: d, C: c, A: a };
}

function LineupContent() {
  const router = useRouter();
  const sp = useSearchParams();

  const tableId = sp.get('id') ?? 't0';
  const buyIn = Number(sp.get('buyIn') ?? 1);
  const capacity = Number(sp.get('cap') ?? 20);
  const stack = Number(sp.get('stack') ?? 1000);
  const kind = sp.get('kind') ?? 'classic';

  const [roster, setRoster] = useState<{ team: Player[]; formation: FormationKey } | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('fast:lastRoster');
      if (raw) {
        const j = JSON.parse(raw);
        setRoster({ team: j.team as Player[], formation: j.formation as FormationKey });
      }
    } catch {}
  }, []);

  const [formation, setFormation] = useState<FormationKey>('3-4-3');
  const [activeRole, setActiveRole] = useState<'P'|'D'|'C'|'A'>('A');

  useEffect(() => {
    if (roster?.formation) setFormation(roster.formation);
  }, [roster?.formation]);

  const slots = useMemo(() => makeSlots(formation), [formation]);

  const [assignments, setAssignments] = useState<Record<string, Player|undefined>>({});

  const assignedIds = useMemo(() => new Set(Object.values(assignments).filter(Boolean).map(p => (p as Player).id)), [assignments]);
  const remaining = useMemo(() => (roster?.team ?? []).filter(p => !assignedIds.has(p.id)), [roster?.team, assignedIds]);

  const needCount = useMemo(() => {
    return {
      P: slots.filter(s=>s.role==='P').length - (Object.values(assignments).filter(p=>p && (p as Player).role==='P').length),
      D: slots.filter(s=>s.role==='D').length - (Object.values(assignments).filter(p=>p && (p as Player).role==='D').length),
      C: slots.filter(s=>s.role==='C').length - (Object.values(assignments).filter(p=>p && (p as Player).role==='C').length),
      A: slots.filter(s=>s.role==='A').length - (Object.values(assignments).filter(p=>p && (p as Player).role==='A').length),
    };
  }, [slots, assignments]);

  const bench = useMemo(() => remaining, [remaining]);

  const allAssigned = useMemo(() => {
    return slots.every(s => assignments[s.id]);
  }, [slots, assignments]);

  function putInSlot(slotId: string, p: Player) {
    const slot = slots.find(s => s.id === slotId)!;
    if (slot.role !== p.role) return;
    if (assignedIds.has(p.id)) return;
    setAssignments(prev => ({ ...prev, [slotId]: p }));
  }

  function clearSlot(slotId: string) {
    setAssignments(prev => {
      const n = { ...prev };
      delete n[slotId];
      return n;
    });
  }

  function confirmLineup() {
    const xi: Player[] = slots.map(s => assignments[s.id]!).filter(Boolean) as Player[];
    const payload = {
      tableId, buyIn, capacity, stack, kind,
      formation,
      xi,
      bench,
      ts: Date.now(),
    };
    try { localStorage.setItem('fast:lastLineup', JSON.stringify(payload)); } catch {}
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white p-4">
      <div className="max-w-6xl mx-auto space-y-4">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Formazione titolari</h1>
            <div className="text-sm text-white/80">
              Tavolo {tableId} • Modalità {kind} • Buy-in €{buyIn} • Capienza {capacity} • Stack {stack}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={formation}
              onChange={e => setFormation(e.target.value as FormationKey)}
              className="px-3 py-2 rounded-lg bg-white/10 text-white border border-white/20"
              title="Cambia modulo"
            >
              {['3-4-3','4-3-3','3-5-2','4-4-2','4-5-1','5-3-2','5-4-1'].map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <button onClick={()=>router.push('/fast/build?'+new URLSearchParams({id:tableId, buyIn:String(buyIn), cap:String(capacity), stack:String(stack), kind}))}
              className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15">Modifica rosa</button>
          </div>
        </header>

        {/* Campo stilizzato */}
        <section className="rounded-xl border border-white/10 p-4 bg-[radial-gradient(ellipse_at_center,_rgba(16,185,129,0.12),_rgba(2,6,23,0.2))]">
          <div className="relative w-full" style={{ paddingTop: '56%' }}>
            {/* bordo campo */}
            <div className="absolute inset-2 rounded-xl border-2 border-white/30" />
            <div className="absolute left-1/2 top-2 bottom-2 w-px bg-white/20 -translate-x-1/2" />
            {/* area rigore top/bottom */}
            <div className="absolute left-[20%] top-2 w-[60%] h-[20%] border-b-2 border-white/20" />
            <div className="absolute left-[20%] bottom-2 w-[60%] h-[20%] border-t-2 border-white/20" />

            {/* Slots */}
            {slots.map(s => {
              const p = assignments[s.id];
              return (
                <div
                  key={s.id}
                  className="absolute -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${s.x}%`, top: `${s.y}%` }}
                >
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center border ${p ? 'bg-emerald-500 text-slate-900 border-emerald-300' : 'bg-white/10 text-white border-white/30'}`}>
                    <span className="font-bold">{s.role}</span>
                  </div>
                  <div className="mt-1 text-center text-xs">
                    {p ? p.name : <span className="text-white/60">vuoto</span>}
                  </div>
                  {p && (
                    <div className="text-center mt-1">
                      <button onClick={()=>clearSlot(s.id)} className="text-[11px] px-2 py-0.5 rounded bg-white/10 hover:bg-white/15">Togli</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Selettore giocatori per ruolo attivo */}
        <section className="rounded-xl bg-white/5 border border-white/10 p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm">Scegli ruolo: </span>
            {(['A','C','D','P'] as const).map(r => (
              <button
                key={r}
                onClick={()=>setActiveRole(r)}
                className={`px-3 py-1.5 rounded-lg border ${activeRole===r ? 'bg-emerald-600 border-emerald-400' : 'bg-white/10 border-white/20 hover:bg-white/15'}`}
              >
                {r}
                {needCount[r] > 0 && <span className="ml-1 text-xs text-white/80">({needCount[r]} da assegnare)</span>}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {(roster?.team ?? [])
              .filter(p => p.role === activeRole)
              .filter(p => !assignedIds.has(p.id))
              .map(p => (
                <button
                  key={p.id}
                  onClick={() => {
                    // metti nel primo slot libero di quel ruolo
                    const slot = slots.find(s => s.role === p.role && !assignments[s.id]);
                    if (slot) putInSlot(slot.id, p);
                  }}
                  className="rounded-lg text-left px-3 py-2 bg-white/10 border border-white/20 hover:bg-white/15"
                >
                  <div className="text-xs text-white/60">{p.role} • {p.team}</div>
                  <div className="font-semibold">{p.name}</div>
                  <div className="text-xs">FVM {p.price}</div>
                </button>
              ))}
          </div>
        </section>

        {/* Bench + azioni */}
        <section className="rounded-xl bg-white/5 border border-white/10 p-4">
          <div className="font-semibold mb-2">Panchina ({bench.length})</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {bench.map(p => (
              <div key={p.id} className="rounded-lg px-3 py-2 bg-white/10 border border-white/20">
                <div className="text-xs text-white/60">{p.role} • {p.team}</div>
                <div className="font-semibold">{p.name}</div>
                <div className="text-xs">FVM {p.price}</div>
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              onClick={()=>{
                setAssignments({});
              }}
              className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15"
            >
              Reset XI
            </button>
            <button
              onClick={()=>{
                confirmLineup();
                const params = new URLSearchParams({ id: tableId, buyIn: String(buyIn), cap: String(capacity), stack: String(stack), kind });
                router.push(`/fast/result?${params.toString()}`);
              }}
              disabled={!allAssigned}
              className={`px-4 py-2 rounded-lg ${!allAssigned ? 'bg-white/10 text-white/40 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700'}`}
            >
              Simula partita
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

export default function LineupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen grid place-items-center bg-slate-900 text-white">Caricamento…</div>}>
      <LineupContent />
    </Suspense>
  );
}
