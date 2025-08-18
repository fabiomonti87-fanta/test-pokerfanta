'use client';

import React, { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { Upload, Shuffle, Trash2, Info } from 'lucide-react';

export type ClassicRole = 'P'|'D'|'C'|'A';
export type Player = { id: string; name: string; team: string; role: ClassicRole; price: number };

const ROLE_LABEL: Record<ClassicRole, string> = { P:'Portieri', D:'Difensori', C:'Centrocampisti', A:'Attaccanti' };

// Percentuali target richieste
const PCT = { P: 0.09, D: 0.15, C: 0.30, A: 0.46 } as const;

// vincoli rosa Classic
const SLOTS = { P: 3, D: 8, C: 8, A: 6 } as const;
const MAX_TOTAL = 25;

// moduli disponibili per step successivi (rimane qui per coerenza API)
export const FORMATIONS = ['3-4-3','4-3-3','3-5-2','4-4-2','4-5-1','5-3-2','5-4-1'] as const;
export type FormationKey = typeof FORMATIONS[number];

type Props = {
  budget: number;
  onConfirm: (team: Player[], left: number, formation: FormationKey) => void;
};

export default function ClassicBuilder({ budget, onConfirm }: Props) {
  // 1) Stato dati
  const [pool, setPool] = useState<Player[]>([]);      // lista da Excel (vuota finché non carichi)
  const [loading, setLoading] = useState(false);

  // 2) Filtri
  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL'|ClassicRole>('ALL');
  const [teamFilter, setTeamFilter] = useState<string>('ALL');

  // 3) Rosa
  const [team, setTeam] = useState<Player[]>([]);      // parte SEMPRE vuota
  const [formation, setFormation] = useState<FormationKey>('3-4-3');

  // 4) Debug (mostrato nel box distribuzione)
  const [showDebug, setShowDebug] = useState(false);

  // ===== Upload Excel (usa colonna L = “Quotazione FVM”) =====
  const handleExcel = async (file: File) => {
    setLoading(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      if (!rows.length) {
        alert('Il file sembra vuoto.');
        return;
      }

      const header = (rows[0] ?? []).map((h: any) => String(h ?? ''));

      const idxRole = findCol(header, ['Ruolo','R','ROLE']);
      const idxName = findCol(header, ['Nome','Giocatore','Name','Calciatore']);
      const idxTeam = findCol(header, ['Squadra','Team','Club']);
      // Colonna L (indice 11) = “Quotazione FVM” (se non trova header, usa 11)
      let idxFvm = findCol(header, ['Quotazione FVM','FVM','Q FVM']);
      if (idxFvm < 0) idxFvm = 11;

      const items: Player[] = [];
      for (let i=1; i<rows.length; i++) {
        const r = rows[i];
        const roleRaw = String(r[idxRole] ?? '').trim().toUpperCase();
        if (!['P','D','C','A'].includes(roleRaw)) continue;
        const name = String(r[idxName] ?? '').trim();
        const team = String(r[idxTeam] ?? '').trim();
        const price = Number(r[idxFvm] ?? 0) || 0;
        if (!name) continue;
        items.push({
          id: `${roleRaw}-${team}-${name}`.replace(/\s+/g, '_'),
          name, team, role: roleRaw as ClassicRole, price
        });
      }
      setPool(items);
      setTeam([]); // ogni nuovo upload resetta la rosa
    } catch (e) {
      console.error(e);
      alert('Errore nella lettura del file.\nAssicurati che la colonna “Quotazione FVM” (L) sia presente.');
    } finally {
      setLoading(false);
    }
  };

  // ===== Demo opzionale (caricamento volontario) =====
  const loadDemo = () => {
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
      // aggiungi qualche low-cost per riempire
      { id:'D-BOL-Lykogiannis', name:'Lykogiannis', team:'Bologna', role:'D', price: 8 },
      { id:'D-ATA-Ruggeri', name:'Ruggeri', team:'Atalanta', role:'D', price: 11 },
      { id:'C-CAG-Makoumbou', name:'Makoumbou', team:'Cagliari', role:'C', price: 10 },
      { id:'C-EMP-Marin', name:'Marin', team:'Empoli', role:'C', price: 9 },
      { id:'A-EMP-Cambiaghi', name:'Cambiaghi', team:'Empoli', role:'A', price: 18 },
      { id:'A-SAS-Pinamonti', name:'Pinamonti', team:'Sassuolo', role:'A', price: 22 },
    ];
    setPool(demo);
    setTeam([]);
  };

  // ===== Filtri =====
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

  // ===== Calcoli top =====
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

  // ===== CRUD giocatori in rosa =====
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

  // ===== Randomizzatore con rispetto P9/D15/C30/A46 e 25 giocatori =====
  function randomize() {
    if (pool.length < 30) {
      alert('Per una randomizzazione credibile carica il listone (Excel) o usa la demo.');
      return;
    }
    // budget per ruolo
    const target: Record<ClassicRole, number> = {
      P: Math.round(budget * PCT.P),
      D: Math.round(budget * PCT.D),
      C: Math.round(budget * PCT.C),
      A: Math.round(budget * PCT.A),
    };
    // per fattibilità: target non può essere < somma dei più economici necessari
    const byRole: Record<ClassicRole, Player[]> = { P:[], D:[], C:[], A:[] };
    pool.forEach(p => byRole[p.role].push(p));
    (['P','D','C','A'] as ClassicRole[]).forEach(r => byRole[r].sort((a,b)=> a.price - b.price));
    const minNeed: Record<ClassicRole, number> = {
      P: sumCheapest(byRole.P, SLOTS.P),
      D: sumCheapest(byRole.D, SLOTS.D),
      C: sumCheapest(byRole.C, SLOTS.C),
      A: sumCheapest(byRole.A, SLOTS.A),
    };
    (['P','D','C','A'] as ClassicRole[]).forEach(r => {
      if (target[r] < minNeed[r]) target[r] = minNeed[r]; // garantisci fattibilità
    });

    // pick ruolo per ruolo con “fit” vicino al target
    const chosen: Player[] = [];
    const used = new Set<string>();

    (['A','C','D','P'] as ClassicRole[]).forEach(r => {
      const picks = pickRoleCloseToBudget(byRole[r], SLOTS[r], target[r], used);
      picks.forEach(p => { chosen.push(p); used.add(p.id); });
    });

    // se eccede il budget totale, scala leggermente (sostituzioni verso low-cost)
    let total = chosen.reduce((s,p)=>s+p.price,0);
    if (total > budget) {
      const over = total - budget;
      downgradeToFit(chosen, byRole, used, over);
      total = chosen.reduce((s,p)=>s+p.price,0);
    }

    // se avanza budget, prova upgrade “morbido”
    if (total < budget) {
      const room = budget - total;
      upgradeToSpend(chosen, byRole, used, room);
    }

    setTeam(chosen.slice(0, MAX_TOTAL));
  }

  // ===== UI =====
  const paletteBox = 'bg-emerald-900/15 border border-emerald-600/30'; // come richiesto: coerente con chip/bottoni

  return (
    <div className="space-y-4">
      {/* Top bar: modulo + upload + demo + azioni */}
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

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2">
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={e => e.target.files?.[0] && handleExcel(e.target.files[0])}
            />
            <span className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 border border-white/20 cursor-pointer">
              <Upload className="h-4 w-4" />
              {loading ? 'Caricamento…' : 'Carica Excel (Quotazioni FVM col. L)'}
            </span>
          </label>
          <button onClick={loadDemo} className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15">
            Carica demo
          </button>
          <button onClick={randomize} className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700">
            <Shuffle className="inline h-4 w-4 mr-1" />
            Randomizza
          </button>
          <button onClick={reset} className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15">
            <Trash2 className="inline h-4 w-4 mr-1" />
            Svuota
          </button>
        </div>
      </div>

      {/* Box budget + distribuzione + DEBUG dentro al box */}
      <div className={`rounded-xl p-4 ${paletteBox}`}>
        <div className="flex flex-wrap items-center gap-4 justify-between">
          <div className="text-sm">
            Budget: <span className="font-semibold">{budget}</span> •
            {' '}Spesi: <span className="font-semibold">{spent}</span> •
            {' '}Rimasti: <span className={`font-semibold ${left<0?'text-red-400':'text-white'}`}>{left}</span> •
            {' '}Rosa: <span className="font-semibold">{team.length}/{MAX_TOTAL}</span>
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
                <div className="flex items-center gap-1 text-white/70 text-xs">
                  <Info className="h-3.5 w-3.5" />
                  {ROLE_LABEL[r]}
                </div>
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
            <div>Percentuali target applicate: P{Math.round(PCT.P*100)} / D{Math.round(PCT.D*100)} / C{Math.round(PCT.C*100)} / A{Math.round(PCT.A*100)}</div>
            <div>Budget target: P≈{Math.round(budget*PCT.P)}, D≈{Math.round(budget*PCT.D)}, C≈{Math.round(budget*PCT.C)}, A≈{Math.round(budget*PCT.A)}</div>
          </div>
        )}
      </div>

      {/* Filtri + Ricerca */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <input
          value={q}
          onChange={e=>setQ(e.target.value)}
          placeholder="Cerca giocatore o squadra…"
          className="w-full px-3 py-2 rounded-lg bg-white/10 text-white placeholder-white/60 border border-white/20"
        />
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
        <select
          value={teamFilter}
          onChange={e=>setTeamFilter(e.target.value)}
          className="w-full px-3 py-2 rounded-lg bg-white/10 text-white border border-white/20"
        >
          {teams.map(t => <option key={t} value={t}>{t === 'ALL' ? 'Tutte le squadre' : t}</option>)}
        </select>
      </div>

      {/* Stato “nessun listone” */}
      {pool.length === 0 && (
        <div className="rounded-xl bg-white/5 border border-white/10 p-4 text-white/80 text-sm">
          Nessun listone caricato. Carica l’Excel delle <strong>Quotazioni FVM</strong> (colonna L)
          oppure clicca <button onClick={loadDemo} className="underline text-emerald-300 hover:text-emerald-200">Carica demo</button> per provare.
        </div>
      )}

      {/* Lista giocatori */}
      {pool.length > 0 && (
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
      )}

      {/* Rosa selezionata */}
      <div className="rounded-xl bg-white/5 border border-white/10 p-3">
        <div className="font-semibold mb-2">Rosa selezionata ({team.length}/{MAX_TOTAL})</div>
        {team.length === 0 ? (
          <div className="text-sm text-white/70">Ancora vuota. Aggiungi dalla lista sopra oppure usa “Randomizza”.</div>
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

/* ================= helpers ================= */

function findCol(header: string[], aliases: string[]) {
  const idx = header.findIndex(h => aliases.some(a => h.toLowerCase().includes(a.toLowerCase())));
  return idx >= 0 ? idx : -1;
}

function sumCheapest(arr: Player[], k: number) {
  if (k <= 0) return 0;
  const copy = arr.slice().sort((a,b)=> a.price - b.price);
  let s = 0;
  for (let i=0;i<Math.min(k, copy.length);i++) s += copy[i].price;
  return s;
}

// Sceglie `need` giocatori del ruolo mirando a stare vicino a `roleBudget`
function pickRoleCloseToBudget(candidatesAsc: Player[], need: number, roleBudget: number, used: Set<string>) {
  const pool = candidatesAsc.filter(p => !used.has(p.id));
  // se il pool è piccolo, prendi i più economici che bastano
  if (pool.length <= need) return pool.slice(0, need);

  // approccio: riempi dai più costosi verso il basso ma controllando di poter ancora coprire i rimanenti
  const poolDesc = pool.slice().sort((a,b)=> b.price - a.price);
  const chosen: Player[] = [];
  let remainBudget = Math.max(roleBudget, sumCheapest(pool, need));

  while (chosen.length < need && poolDesc.length) {
    // quanto minimo serve per i rimanenti slot (prenota i più economici)
    const leftSlots = need - chosen.length - 1;
    const minLeft = sumCheapest(poolDesc.filter(p=>!chosen.find(c=>c.id===p.id)), leftSlots);

    // trova il max prezzo che consenta ancora di coprire i rimanenti
    const pickIdx = poolDesc.findIndex(p =>
      !chosen.find(c=>c.id===p.id) &&
      p.price <= (remainBudget - minLeft)
    );

    let pick: Player | undefined;
    if (pickIdx >= 0) {
      pick = poolDesc.splice(pickIdx,1)[0];
    } else {
      // fallback: prendi il più economico disponibile
      pick = poolDesc.pop();
    }
    if (!pick) break;

    chosen.push(pick);
    remainBudget -= pick.price;
  }

  // se non abbiamo riempito (lista insufficiente?), riempi con i più economici
  if (chosen.length < need) {
    const leftPool = pool.filter(p => !chosen.find(c=>c.id===p.id)).sort((a,b)=> a.price - b.price);
    while (chosen.length < need && leftPool.length) chosen.push(leftPool.shift()!);
  }
  return chosen.slice(0, need);
}

// Se abbiamo speso troppo, sostituisci elementi con alternative più economiche
function downgradeToFit(chosen: Player[], byRole: Record<ClassicRole, Player[]>, used: Set<string>, over: number) {
  let remainOver = over;
  // ordina chosen per costo decrescente (togli prima i più costosi)
  const sorted = chosen.slice().sort((a,b)=> b.price - a.price);
  for (const cur of sorted) {
    if (remainOver <= 0) break;
    const sameRolePool = byRole[cur.role].filter(p => !used.has(p.id) && p.id !== cur.id);
    // trova la migliore sostituzione più economica possibile
    const cheaper = sameRolePool
      .filter(p => p.price < cur.price)
      .sort((a,b)=> b.price - a.price)[0];
    if (cheaper) {
      // swap
      const idx = chosen.findIndex(x => x.id === cur.id);
      if (idx >= 0) {
        used.delete(cur.id);
        used.add(cheaper.id);
        chosen[idx] = cheaper;
        remainOver -= (cur.price - cheaper.price);
      }
    }
  }
}

// Se abbiamo margine, prova qualche upgrade
function upgradeToSpend(chosen: Player[], byRole: Record<ClassicRole, Player[]>, used: Set<string>, room: number) {
  let remain = room;
  // ordina chosen per costo crescente (prova ad alzare quelli economici)
  const sortedIdx = chosen.map((p, i) => [p, i] as const).sort((a,b)=> a[0].price - b[0].price);
  for (const [cur, idx] of sortedIdx) {
    const sameRolePool = byRole[cur.role].filter(p => !used.has(p.id) && p.price > cur.price).sort((a,b)=> a.price - b.price);
    for (const cand of sameRolePool) {
      const delta = cand.price - cur.price;
      if (delta <= remain) {
        used.delete(cur.id);
        used.add(cand.id);
        chosen[idx] = cand;
        remain -= delta;
        break;
      }
    }
    if (remain <= 0) break;
  }
}
