// src/lib/fast/game.ts
export type Mode = 'classic' | 'top100';
export type TableStatus = 'waiting' | 'running' | 'finished';

export interface Seat {
  name: string;       // “utente” o bot
  isBot: boolean;
  score?: number;     // riempito a fine simulazione
  prize?: number;     // payout ricevuto (€)
}

export interface Table {
  id: string;
  mode: Mode;
  buyIn: number;          // 1, 5, 10
  rake: number;           // 0.10 (10%)
  capacity: number;       // classic: 20 (demo); top100: 10
  status: TableStatus;
  createdAt: number;
  seats: Seat[];
  winners?: Seat[];       // ordinati per rank (a fine simulazione)
  pot?: number;           // pot netto (dopo rake)
  rakeTotal?: number;     // rake totale
}

export const BUY_INS = [1, 5, 10] as const;
export const DEMO_RAKE = 0.10;

// Per la demo: capacity fissa per modalità
export const CAPACITY_BY_MODE: Record<Mode, number> = {
  classic: 20, // in demo usiamo solo 20 (50/100 solo come filtro "nominale")
  top100: 10,
};

// Payout (percentuale del pot) per capacity standard
// Somma = 90% (pot netto, perché 10% è rake)
const PAYOUTS: Record<number, number[]> = {
  20: [40, 25, 15, 6, 4],                                 // top 5
  50: [20, 15, 12, 10, 8, 7, 6, 5, 4, 3],                 // top 10
  100: [16, 13, 10, 8, 7, 6, 6, 5, 4, 4, 3.5, 3, 2.5, 2, 1.5, 1, 1, 1], // top 18
  10: [50, 30, 10],                                       // top 3 (Top100)
};

export function payoutPerc(capacity: number): number[] {
  return PAYOUTS[capacity] ?? [];
}

export function euros(n: number): number {
  return Math.round(n * 100) / 100;
}

export function newId(prefix = 'tbl'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

export function makeBotName(i: number): string {
  const pool = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Lima', 'Kilo', 'Sierra', 'Tango', 'Zeta', 'Omega'];
  const nick = pool[i % pool.length];
  return `Bot ${nick}${i > pool.length ? `-${Math.floor(i / pool.length)}` : ''}`;
}

// ------------ Simulazioni punteggio ------------
// Nota: sono RNG differenti per dare "feeling" diverso tra Classic e Top100
function randNormal(mu: number, sigma: number): number {
  // Box-Muller: due uniformi (0,1) -> normale
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return mu + z * sigma;
}

export function simulateClassicScores(seats: Seat[]): Seat[] {
  // Punteggio medio 70, varianza discreta
  return seats.map(s => ({
    ...s,
    score: Math.max(10, Math.round(randNormal(70, 15))),
  }));
}

export function simulateTop100Scores(seats: Seat[]): Seat[] {
  // Punteggi più "swingy"
  return seats.map(s => ({
    ...s,
    score: Math.max(5, Math.round(randNormal(65, 22))),
  }));
}

export function computePayouts(table: Table): Table {
  const capacity = table.capacity;
  const perc = payoutPerc(capacity);
  const totalEntries = table.seats.length;
  const gross = table.buyIn * totalEntries;
  const rakeTotal = euros(gross * table.rake);
  const pot = euros(gross - rakeTotal);

  // Ordina per score desc
  const sorted = [...table.seats].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const winnersCount = Math.min(perc.length, sorted.length);

  for (let i = 0; i < winnersCount; i++) {
    const prize = euros((perc[i] / 100) * pot);
    sorted[i].prize = prize;
  }

  return {
    ...table,
    winners: sorted.slice(0, winnersCount),
    pot,
    rakeTotal,
  };
}
