'use client';

import React, { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { Upload, Shuffle, Trash2 } from 'lucide-react';

export type ClassicRole = 'P'|'D'|'C'|'A';
export type Player = { id: string; name: string; team: string; role: ClassicRole; price: number };

const ROLE_LABEL: Record<ClassicRole, string> = { P:'Portieri', D:'Difensori', C:'Centrocampisti', A:'Attaccanti' };

// Distribuzione percentuale richiesta
const PCT = { P: 0.09, D: 0.15, C: 0.30, A: 0.46 } as const;

// vincoli rosa Classic
const SLOTS = { P: 3, D: 8, C: 8, A: 6 } as const;
const MAX_TOTAL = 25;

// moduli disponibili
export const FORMATIONS = ['3-4-3','4-3-3','3-5-2','4-4-2','4-5-1','5-3-2','5-4-1'] as const;
export type FormationKey = typeof FORMATIONS[number];

function parseFormation(key: FormationKey) {
  const [d,c,a] = key.split('-').map(n => Number(n));
  return { D: d, C: c, A: a };
}

type Props = {
  budget: number;
  onConfirm: (team: Player[], left: number, formation: FormationKey) => void;
};

export default function ClassicBuilder({ budget, onConfirm }: Props) {
  // modulo scelto
  const [formation, setFormation] = useState<FormationKey>('3-4-3');

  // dataset roster disponibile (da Excel o fallback)
  const [pool, setPool] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);

  // filtri
  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL'|ClassicRole>('ALL');
  const [teamFilter, setTeamFilter] = useState<string>('ALL');

  // rosa selezionata
  const [team, setTeam] = useState<Player[]>([]);

  // debug dentro il box distribuzione
  const [showDebug, setShowDebug] = useState(false);

  // carica un Excel “Quotazioni” (usa colonna L = “Quotazione FVM”)
  const handleExcel = async (file: File) => {
    setLoading(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      // Prova a trovare intestazioni
      const header = rows[0]?.map(String) ?? [];
      const idxRole  = findCol(header, ['R','Ruolo','ROLE']);
      const idxName  = findCol(header, ['Nome','Giocatore','Name','Calciatore']);
      const idxTeam  = findCol(header, ['Squadra','Team','Club']);
      const idxFvm   = findCol(header, ['Quotazione FVM','FVM','Q FVM','Colonna L']);

      const items: Player[] = [];
      for (let i=1;i<rows.length;i++){
        const r = rows[i];
        const role = String(r[idxRole] ?? '').trim().toUpperCase();
        if (!['P','D','C','A'].includes(role)) continue;
        const name = String(r[idxName] ?? '').trim();
        const team = String(r[idxTeam] ?? '').trim();
        const price = Number(r[idxFvm] ?? 0) || 0;
        if (!name) continue;
        items.push({
          id: `${role}-${team}-${name}`.replace(/\s+/g,'_'),
          name, team, role: role as ClassicRole, price
        });
      }
      setPool(items);
    } catch (e) {
      console.error(e);
      alert('Errore nella lettura del file. Assicurati che la colonna “Quotazione FVM” sia presente.');
    } finally {
      setLoading(false);
    }
  };

  // fallback demo se l’utente non carica l’excel
  useEffect(() => {
    if (pool.length) return;
    const demo: Player[] = [
      { id:'P-ATA-Carnesecchi', name:'Carnesecchi', team:'Atalanta', role:'P', price: 28 },
      { id:'P-FIO-DeGea', name:'De Gea', team:'Fiorentina', role:'P', price: 35 },
      { id:'P-MIL-Sportiello', name:'Sportiello', team:'Milan', role:'P', price: 5 },
      { id:'D-INT-Darmian', name:'Darmian', team:'Inter', role:'D', price: 20 },
      { id:'D-JUV-Cambiaso', name:'Cambiaso', team:'Juventus', role:'D', price: 25 },
      { id:'D-NAP-DiLorenzo', name:'Di Lorenzo', team:'Napoli', role:'D', price: 28 },
      { id:'D-ROM-Spinazzola', name:'Spinazzola', team:'Roma', role:'D', price: 15 },
      { id:'C-INT-Calhanoglu', name:'Calhanoglu', team:'Inter', role:'C', price: 70 },
      { id:'C-ATA-Koopmeiners', name:'Koopmeiners', team:'Atalanta', role:'C', price: 65 },
      { id:'C-FIO-Bonaventura', name:'Bonaventura', team:'Fiorentina', role:'C', price: 22 },
      { id:'C-LAZ-LuisAlberto', name:'Luis Alberto', team:'Lazio', role:'C', price: 30 },
      { id:'A-NAP-Osimhen', name:'Osimhen', team:'Napoli', role:'A', price: 120 },
      { id:'A-INT-Lautaro', name:'Lautaro', team:'Inter', role:'A', price: 130 },
      { id:'A-ROM-Dybala', name:'Dybala', team:'Roma', role:'A', price: 85 },
      { id:'A-MIL-Leao', name:'Leao', team:'Milan', role:'A', price: 95 },
    ];
    setPool(demo);
  }, [pool.length]);

  const teams = useMemo(() => {
    const s = new Set<string>();
    pool.forEach(p => s.add(p.team));
    return ['ALL', ...Array.from(s).sort()];
  }, [pool]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return pool
      .filter(p => roleFilter === 'ALL' ? true : p.role === roleFilter)
      .filter(p => teamFilter === 'ALL' ? true : p.team === teamFilter)
      .filter(p => !s ? true : (p.name.toLowerCase().includes(s) || p.team.toLowerCase().includes(s)));
  }, [pool, q, roleFilter, teamFilter]);

  const spent = useMemo(() => team.reduce((a,b)=>a+b.price,0), [team]);
  const left = budget - spent;

  const countBy = useMemo(() => {
    const map: Record<ClassicRole, number> = { P:0, D:0, C:0, A:0 };
    team.forEach(p => { map[p.role]++; });
    return map;
  }, [team]);

  const withinCap = useMemo(() => {
    return countBy.P <= SLOTS.P && countBy.D <= SLOTS.D && countBy.C <= SLOTS.C && countBy.A <= SLOTS.A && team.length <= MAX_TOTAL && left >= 0;
  }, [countBy, team.length, left]);

  function add(p: Player) {
    if (team.find(t => t.id === p.id)) return;
    const newCount = { ...countBy, [p.role]: countBy[p.role] + 1 };
    if (newCount.P > SLOTS.P || newCount.D > SLOTS.D || newCount.C > SLOTS.C || newCount.A > SLOTS.A) return;
    if (left - p.price < 0) return;
    setTeam(t => [...t, p]);
  }
  function remove(p: Player) {
    setTeam(t => t.filter(x => x.id !== p.id));
  }
  function reset() {
    setTeam([]);
  }

  // Randomizzatore “intelligente”
  function randomize() {
    const budgets: Record<ClassicRole, number> = {
      P: Math.round(budget * PCT.P),
      D: Math.round(budget * PCT.D),
      C: Math.round(budget * PCT.C),
      A: Math.round(budget * PCT.A),
    };

    // limita i portieri al 9% ± 2
    budgets.P = Math.min(budgets.P, Math.round(budget * 0.11));

    const quotas: Record<ClassicRole, number> = { P: SLOTS.P, D: SLOTS.D, C: SLOTS.C, A: SLOTS.A };
    const byRole: Record<ClassicRole, Player[]> = { P:[], D:[], C:[], A:[] };
    pool.forEach(p => { byRole[p.role].push(p); });
    Object.keys(byRole).forEach(r => byRole[r as ClassicRole].sort((a,b)=> b.price - a.price));

    const chosen: Player[] = [];

    (['A','C','D','P'] as ClassicRole[]).forEach(role => {
      let quota = quotas[role];
      let money = budgets[role];
      const candidates = byRole[role].slice();

      while (quota > 0 && candidates.length) {
        // scegli il miglior giocatore che non sfora troppo (lascia ~5% cuscinetto al ruolo)
        const idx = candidates.findIndex(p => p.price <= money * 0.95);
        const pick = idx >= 0 ? candidates.splice(idx,1)[0] : candidates.pop()!;
        chosen.push(pick);
        money -= pick.price;
        quota -= 1;
      }
      // se avanza budget, redistribuiamo su A e C (ruoli ad alto impatto)
      if (money > 0 && (role === 'A' || role === 'C')) {
        let poolAC = byRole[role].filter(p => !chosen.find(c => c.id === p.id));
        poolAC.sort((a,b)=> a.price - b.price);
        for (const p of poolAC) {
          if (money - p.price >= 0 && chosen.filter(c=>c.role===role).length < quotas[role]) {
            chosen.push(p);
            money -= p.price;
          }
        }
      }
    });

    // Se non arriviamo a 25, riempi con low-cost a ruoli con spazio rispettando budget complessivo
    let totalLeft = budget - chosen.reduce((s,p)=>s+p.price,0);
    const space = {
      P: SLOTS.P - chosen.filter(p=>p.role==='P').length,
      D: SLOTS.D - chosen.filter(p=>p.role==='D').length,
      C: SLOTS.C - chosen.filter(p=>p.role==='C').length,
      A: SLOTS.A - chosen.filter(p=>p.role==='A').length,
    };
    const order: ClassicRole[] = ['A','C','D','P'];
    for (const r of order) {
      if (space[r] <= 0) continue;
      const rest = byRole[r].filter(p => !chosen.find(c => c.id === p.id));
      rest.sort((a,b)=> a.price - b.price);
      for (const p of rest) {
        if (space[r] <= 0) break;
        if (totalLeft - p.price < 0) break;
        chosen.push(p);
        totalLeft -= p.price;
        space[r]--;
      }
    }

    setTeam(chosen.slice(0, MAX_TOTAL));
  }

  const budgetBoxColor = 'bg-emerald-900/15 border border-emerald-600/30';

  return (
    <div className="space-y-4">
      {/* Top bar: modulo + upload + azioni */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <label className="text-xs text-white/70">Modulo</label>
          <div>
            <select
              value={formation}
              onChange={e => setFormation(e.target.value as FormationKey)}
              className="px-3 py-2 rounded-lg bg-white/10 text-white border border-white/20"
            >
              {FORMATIONS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
        </div>

        <label className="flex items-center gap-2">
          <input
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={e => e.target.files?.[0] && handleExcel(e.target.files[0])}
          />
          <span className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 border border-white/20 cursor-pointer">
            <Upload className="h-4 w-4" />
            {loading ? 'Caricamento…' : 'Carica Excel (Quotazioni FVM)'}
          </span>
        </label>

        <div className="flex items-center gap-2">
          <button onClick={randomize} className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700">
            <Shuffle className="inline h-4 w-4 mr-1" /> Randomizza
          </button>
          <button onClick={reset} className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15">
            <Trash2 className="inline h-4 w-4 mr-1" /> Svuota
          </button>
        </div>
      </div>

      {/* Box budget + distribuzione + DEBUG */}
      <div className={`rounded-xl p-4 ${budgetBoxColor}`}>
        <div className="flex flex-wrap items-center gap-4 justify-between">
          <div className="text-sm">
            Budget: <span className="font-semibold">{budget}</span> •
            Spesi: <span className="font-semibold">{spent}</span> •
            Rimasti: <span className={`font-semibold ${left<0?'text-red-400':'text-white'}`}>{left}</span> •
            Rosa: <span className="font-semibold">{team.length}/{MAX_TOTAL}</span>
          </div>
          <button
            type="button"
            onClick={() => setShowDebug(s => !s)}
            className="px-2 py-1 rounded-md bg-emerald-600/20 border border-emerald-500/40 text-emerald-200 hover:bg-emerald-600/30 text-xs"
            title="Mostra/Nascondi debug budget per ruolo"
          >
            {showDebug ? 'Nascondi debug' : 'Mostra debug'}
          </button>
        </div>

        <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
          {(['P','D','C','A'] as ClassicRole[]).map(r => {
            const pct = Math.round(PCT[r]*100);
            const spentR = team.filter(p=>p.role===r).reduce((s,p)=>s+p.price,0);
            const target = Math.round(budget * PCT[r]);
            return (
              <div key={r} className="rounded-lg px-3 py-2 bg-white/5 border border-white/10">
                <div className="text-white/70 text-xs">{ROLE_LABEL[r]}</div>
                <div className="font-semibold">
                  {team.filter(p=>p.role===r).length}/{SLOTS[r]}
                  <span className="ml-2 text-white/70">({pct}%)</span>
                </div>
                <div className="text-xs text-white/70">Spesi {spentR} / Target {target}</div>
              </div>
            );
          })}
        </div>

        {showDebug && (
          <div className="mt-3 rounded-lg bg-black/30 border border-emerald-500/30 p-3 text-xs text-emerald-200">
            <div>Controllo percentuali: P{Math.round(PCT.P*100)} / D{Math.round(PCT.D*100)} / C{Math.round(PCT.C*100)} / A{Math.round(PCT.A*100)}</div>
            <div>Budget target: P≈{Math.round(budget*PCT.P)}, D≈{Math.round(budget*PCT.D)}, C≈{Math.round(budget*PCT.C)}, A≈{Math.round(budget*PCT.A)}</div>
          </div>
        )}
      </div>

      {/* Filtri lista */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <div>
          <input
            value={q}
            onChange={e=>setQ(e.target.value)}
            placeholder="Cerca giocatore o squadra…"
            className="w-full px-3 py-2 rounded-lg bg-white/10 text-white placeholder-white/60 border border-white/20"
          />
        </div>
        <div>
          <select
            value={roleFilter}
            onChange={e=>setRoleFilter(e.target.value as any)}
            className="w-full px-3 py-2 rounded-lg bg-white/10 text-white border border-white/20"
          >
            <option value="ALL">Tutti i ruoli</option>
            <option value="P">Portieri</option>
            <option value="D">Difensori</option>
            <option value="C">Centrocampisti</option>
            <option value="A">Attaccanti</option>
          </select>
        </div>
        <div>
          <select
            value={teamFilter}
            onChange={e=>setTeamFilter(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-white/10 text-white border border-white/20"
          >
            {teams.map(t => <option key={t} value={t}>{t === 'ALL' ? 'Tutte le squadre' : t}</option>)}
          </select>
        </div>
      </div>

      {/* Lista giocatori */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {filtered.map(p => {
          const disabled =
            team.find(t => t.id === p.id) ||
            (team.filter(t => t.role===p.role).length >= SLOTS[p.role]) ||
            (left - p.price < 0) ||
            (team.length >= MAX_TOTAL);
          return (
            <button
              key={p.id}
              disabled={!!disabled}
              onClick={()=>add(p)}
              className={`rounded-lg text-left px-3 py-2 border ${
                disabled ? 'bg-white/5 border-white/10 text-white/40 cursor-not-allowed' :
                'bg-white/10 border-white/20 hover:bg-white/15'
              }`}
            >
              <div className="text-xs text-white/60">{p.role} • {p.team}</div>
              <div className="font-semibold">{p.name}</div>
              <div className="text-xs">FVM {p.price}</div>
            </button>
          );
        })}
      </div>

      {/* Rosa */}
      <div className="rounded-xl bg-white/5 border border-white/10 p-3">
        <div className="font-semibold mb-2">Rosa selezionata ({team.length}/{MAX_TOTAL})</div>
        {team.length === 0 ? (
          <div className="text-sm text-white/70">Ancora vuota. Aggiungi dalla lista sopra.</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {team.map(p => (
              <div key={p.id} className="rounded-lg px-3 py-2 bg-emerald-900/20 border border-emerald-700/30">
                <div className="text-xs text-white/70">{p.role} • {p.team}</div>
                <div className="font-semibold">{p.name}</div>
                <div className="text-xs">FVM {p.price}</div>
                <div className="mt-1">
                  <button onClick={()=>remove(p)} className="text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/15">
                    Rimuovi
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Conferma */}
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={() => onConfirm(team, left, formation)}
          disabled={!withinCap || team.length !== MAX_TOTAL}
          className={`px-4 py-2 rounded-lg ${(!withinCap || team.length!==MAX_TOTAL) ? 'bg-white/10 text-white/40 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700'}`}
          title="Conferma rosa e vai alla formazione"
        >
          Conferma rosa
        </button>
      </div>
    </div>
  );
}

function findCol(header: string[], aliases: string[]) {
  const idx = header.findIndex(h => aliases.some(a => h.toLowerCase().includes(a.toLowerCase())));
  return idx >= 0 ? idx : -1;
}
