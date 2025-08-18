// src/components/fast/ClassicBuilder.tsx
'use client';
import React, { useMemo, useState } from 'react';
import { Upload } from 'lucide-react';

// TIPI
export type ClassicRole = 'P'|'D'|'C'|'A';
export type Player = { id: string; name: string; team: string; role: ClassicRole; price: number };
type FormationKey = '3-4-3'|'4-3-3'|'3-5-2'|'4-4-2'|'4-5-1'|'5-3-2'|'5-4-1';

export default function ClassicBuilder({
  budget,
  onConfirm,
}: {
  budget: number;
  // ora ritorna anche il modulo scelto
  onConfirm: (team: Player[], left: number, formation: FormationKey) => void;
}) {
  // === stato base (lascia intatto il resto della tua logica di parsing/filtri) ===
  const [players, setPlayers] = useState<Player[]>([]);     // popolato dall’Excel FVM
  const [selected, setSelected] = useState<Player[]>([]);
  const [showDebug, setShowDebug] = useState(false);

  // NEW: modulo scelto
  const [formation, setFormation] = useState<FormationKey>('3-4-3');

  // percentuali richieste: P9/D15/C30/A46
  const targetPct = { P: 9, D: 15, C: 30, A: 46 } as const;
  const targets = useMemo(() => ({
    P: Math.round(budget * targetPct.P / 100),
    D: Math.round(budget * targetPct.D / 100),
    C: Math.round(budget * targetPct.C / 100),
    A: Math.round(budget * targetPct.A / 100),
  }), [budget]);

  const spentBy = useMemo(() => selected.reduce((acc, p) => {
    acc[p.role] = (acc[p.role] ?? 0) + p.price; return acc;
  }, {} as Record<ClassicRole, number>), [selected]);

  const left = useMemo(() => {
    const spent = selected.reduce((s,p)=> s + p.price, 0);
    return Math.max(0, budget - spent);
  }, [budget, selected]);

  // handler conferma: passa anche il modulo
  const handleConfirm = () => onConfirm(selected, left, formation);

  // === UI ===
  return (
    <div className="space-y-4">
      {/* Barra top: modulo scelto */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="text-sm">
          <label className="text-white/80 mr-2">Modulo</label>
          <select
            value={formation}
            onChange={(e)=> setFormation(e.target.value as FormationKey)}
            className="px-2 py-1 rounded-md bg-emerald-600/15 border border-emerald-500/30 text-white"
          >
            <option value="3-4-3">3-4-3</option>
            <option value="4-3-3">4-3-3</option>
            <option value="3-5-2">3-5-2</option>
            <option value="4-4-2">4-4-2</option>
            <option value="4-5-1">4-5-1</option>
            <option value="5-3-2">5-3-2</option>
            <option value="5-4-1">5-4-1</option>
          </select>
        </div>

        {/* (qui resta tutto il resto della tua barra: caricamento Excel, ricerca, filtri ruolo/squadra, ecc.) */}
      </div>

      {/* Distribuzione crediti (DEBUG dentro il box, al posto del testo preset) */}
      <div className="rounded-xl border border-white/10 bg-white/5">
        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
          <div className="font-semibold">Distribuzione crediti</div>
          <button
            type="button"
            onClick={() => setShowDebug((v)=>!v)}
            className="px-2 py-1 rounded-md bg-white/10 text-white hover:bg-white/15 text-xs"
            title="Mostra/Nascondi debug budget per ruolo"
          >
            {showDebug ? 'Nascondi debug' : 'Mostra debug'}
          </button>
        </div>

        {/* QUI: debug inline (sostituisce la riga “Preset 3-4-3: …”) */}
        {showDebug && (
          <div className="px-4 py-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            {(['P','D','C','A'] as ClassicRole[]).map(r => (
              <div key={r} className="rounded-lg bg-emerald-600/10 border border-emerald-500/30 p-3">
                <div className="text-xs text-white/70">Ruolo {r}</div>
                <div className="text-lg font-semibold">Target {targets[r]}</div>
                <div className="text-xs">
                  Spesi <span className="font-semibold">{spentBy[r] ?? 0}</span>
                  <span className="text-white/60"> • ({targetPct[r]}%)</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* qui sotto lascia invariato il resto del tuo box (sliders percentuali se li avevi, note, etc.) */}
      </div>

      {/* elenco giocatori + pick + riepilogo carrello… (LASCIA INVARIATO il resto) */}

      <div className="flex items-center justify-between pt-2">
        <div className="text-sm text-white/80">
          Budget: <span className="font-semibold">{budget}</span> •
          &nbsp; Rimasti: <span className="font-semibold text-emerald-400">{left}</span>
        </div>
        <button
          onClick={handleConfirm}
          className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700"
        >
          Conferma rosa
        </button>
      </div>
    </div>
  );
}
