// src/hooks/useBestLineup.ts
import { useMemo } from 'react';

export type Role = 'Por'|'Dc'|'Dd'|'Ds'|'E'|'M'|'C'|'T'|'W'|'A'|'Pc';
export type FormationKey = '4-3-3'|'4-4-2'|'3-5-2'|'3-4-3'|'4-2-3-1';

export interface Player {
  id?: number | string;
  giocatore: string;
  squadraFantacalcio: string;
  squadraSerieA?: string;
  ruolo?: string;
  tipoContratto?: string;
  dataAcquisto?: string | Date;
  scadenzaIpotizzata?: string | Date;
  tipoAcquisto?: string;
  valAsteriscato?: number | string;
  scambioIngaggio?: number | string;
  valoreAcquisto?: number | string;
  fvm2425?: number | string;
  ultimoFVM?: number | string;
  valoreXMercato?: number | string;
  ingaggio36?: number | string;
  ingaggioReale?: number | string;
}

export interface PlayerMeta extends Player {
  id: number | string;
  _roles: Role[];
  _fvm: number;
}

export interface Slot {
  id: string;
  label: string;
  allowed: Role[];
  x: number; // percentage [0..100]
  y: number; // percentage [0..100] (alto=0, basso=100)
}

export interface AssignedSlot {
  slot: Slot;
  player: PlayerMeta | null;
  chosenRole: Role | null;
}

export interface LineupEvaluation {
  key: FormationKey;
  slots: Slot[];
  assigned: AssignedSlot[];
  filled: number;
  sumFvm: number;
  bench: PlayerMeta[];
}

// Ruoli Mantra canonici
export const ROLE_OPTIONS: Role[] = ['Por','Dc','Dd','Ds','E','M','C','T','W','A','Pc'];

// Normalizzazione: varianti -> canonico
const ROLE_CANON: Record<string, Role> = {
  POR: 'Por', PC: 'Pc', DC: 'Dc', DD: 'Dd', DS: 'Ds',
  E: 'E', M: 'M', C: 'C', T: 'T', W: 'W', A: 'A',
};

export const FORMATION_KEYS: FormationKey[] = ['4-3-3','4-4-2','3-5-2','3-4-3','4-2-3-1'];

const spreadX = (n: number) => Array.from({ length: n }, (_, i) => (100 / (n + 1)) * (i + 1));

function buildSlotsForFormation(key: FormationKey): Slot[] {
  const slots: Slot[] = [];

  // GK
  slots.push({ id: 'GK', label: 'Por', allowed: ['Por'], x: 50, y: 90 });

  const pushLine = (y: number, roleGroups: Role[][]) => {
    const xs = spreadX(roleGroups.length);
    roleGroups.forEach((allowed, i) => {
      slots.push({
        id: `L${y}-${i}`,
        label: allowed.length === 1 ? allowed[0] : (allowed as string[]).join('/'),
        allowed,
        x: xs[i],
        y
      });
    });
  };

  switch (key) {
    case '4-3-3':
      pushLine(72, [['Dd','Dc'], ['Dc'], ['Dc'], ['Ds','Dc']]);
      pushLine(55, [['M','C','T','E'], ['M','C','T','E'], ['M','C','T','E']]);
      pushLine(38, [['W','A'], ['Pc','A'], ['W','A']]);
      break;
    case '4-4-2':
      pushLine(72, [['Dd','Dc'], ['Dc'], ['Dc'], ['Ds','Dc']]);
      pushLine(55, [['E','W','T'], ['M','C','T'], ['M','C','T'], ['E','W','T']]);
      pushLine(38, [['Pc','A','W'], ['Pc','A','W']]);
      break;
    case '3-5-2':
      pushLine(72, [['Dc','Dd','Ds'], ['Dc'], ['Dc','Dd','Ds']]);
      pushLine(57, [['E','W'], ['M','C','T'], ['M','C','T'], ['M','C','T'], ['E','W']]);
      pushLine(38, [['Pc','A','W'], ['Pc','A','W']]);
      break;
    case '3-4-3':
      pushLine(72, [['Dc','Dd','Ds'], ['Dc'], ['Dc','Dd','Ds']]);
      pushLine(55, [['E','W'], ['M','C','T'], ['M','C','T'], ['E','W']]);
      pushLine(38, [['W','A'], ['Pc','A'], ['W','A']]);
      break;
    case '4-2-3-1':
      pushLine(72, [['Dd','Dc'], ['Dc'], ['Dc'], ['Ds','Dc']]);
      pushLine(60, [['M','C'], ['M','C']]);
      pushLine(48, [['W','E','T','A'], ['T','A','W'], ['W','E','T','A']]);
      pushLine(36, [['Pc','A']]);
      break;
  }

  return slots;
}

export const parseRoles = (ruolo?: string): Role[] => {
  if (!ruolo || ruolo === '#N/A') return [];
  const tokens = String(ruolo).split(/[^A-Za-z0-9]+/).filter(Boolean);
  const canon = tokens
    .map(t => ROLE_CANON[t.toUpperCase()])
    .filter(Boolean) as Role[];
  return Array.from(new Set(canon));
};

export const getFVM = (p: Player): number => {
  const v1 = Number(p.valoreXMercato);
  if (!Number.isNaN(v1) && v1 > 0) return v1;
  const v2 = Number(p.ultimoFVM);
  if (!Number.isNaN(v2) && v2 > 0) return v2;
  const v3 = Number(p.fvm2425);
  return Number.isNaN(v3) ? 0 : v3;
};

const assignLineupGreedy = (slots: Slot[], players: PlayerMeta[]): AssignedSlot[] => {
  const assigned: AssignedSlot[] = [];
  const used = new Set<number | string>();

  // per ogni slot prepariamo i candidati eleggibili ordinati per FVM
  const elig = slots.map((s, idx) => {
    const list = players
      .filter(p => !used.has(p.id) && p._roles.some(r => s.allowed.includes(r)))
      .sort((a,b) => b._fvm - a._fvm);
    return { idx, slot: s, list };
  });

  // ordina per scarsità (meno eleggibili prima)
  elig.sort((a,b) => a.list.length - b.list.length);

  for (const e of elig) {
    const candidate = e.list.find(p => !used.has(p.id));
    if (candidate) {
      used.add(candidate.id);
      const chosenRole = (e.slot.allowed.find(r => candidate._roles.includes(r)) || e.slot.allowed[0]) as Role;
      assigned[e.idx] = { slot: e.slot, player: candidate, chosenRole };
    } else {
      assigned[e.idx] = { slot: e.slot, player: null, chosenRole: null };
    }
  }

  // ripristina l’ordine originale degli slot
  return assigned.map((a, i) => a ?? { slot: slots[i], player: null, chosenRole: null });
};

export function useBestLineup(
  organicoPlayers: Player[],
  formationChoice: 'auto' | FormationKey
): LineupEvaluation | null {
  return useMemo(() => {
    if (!organicoPlayers?.length) return null;

    // normalizza -> PlayerMeta
    const meta: PlayerMeta[] = organicoPlayers
      .map((p, idx) => ({
        ...p,
        id: p.id ?? idx,
        _roles: parseRoles(p.ruolo),
        _fvm: getFVM(p),
      }))
      .filter(p => p._fvm > 0)
      .sort((a,b) => b._fvm - a._fvm);

    if (!meta.length) return null;

    const keys: FormationKey[] =
      formationChoice === 'auto'
        ? ['4-3-3','4-4-2','3-5-2','3-4-3','4-2-3-1']
        : [formationChoice];

    let best: LineupEvaluation | null = null;

    for (const k of keys) {
      const slots = buildSlotsForFormation(k);
      const assigned = assignLineupGreedy(slots, meta);
      const filled = assigned.filter(a => a.player).length;
      const sumFvm = assigned.reduce((s, a) => s + (a.player ? a.player._fvm : 0), 0);
      const bench = meta.filter(p => !assigned.some(a => a.player && a.player.id === p.id));
      const ev: LineupEvaluation = { key: k, slots, assigned, filled, sumFvm, bench };

      if (!best) best = ev;
      else if (ev.filled > best.filled || (ev.filled === best.filled && ev.sumFvm > best.sumFvm)) best = ev;
    }

    return best!;
  }, [organicoPlayers, formationChoice]);
}