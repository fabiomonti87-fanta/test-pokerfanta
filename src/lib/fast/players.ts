// src/lib/fast/players.ts
import * as XLSX from 'xlsx';
import { Player, ClassicRole } from './game';

// mapping “Mantra” -> Classic (fallback)
const MANTRA_TO_CLASSIC: Record<string, ClassicRole> = {
  POR:'P', PC:'A', DC:'D', DD:'D', DS:'D', B:'D',
  E:'C', M:'C', C:'C', T:'C', W:'A', A:'A'
};
function toClassicRole(raw: any): ClassicRole | null {
  if (!raw) return null;
  const s = String(raw).trim().toUpperCase();
  if (['P','D','C','A'].includes(s)) return s as ClassicRole;
  // es. "Por", "Dd/Dc", ecc.
  const tokens = s.split(/[^A-Z]+/).filter(Boolean);
  for (const t of tokens) {
    const m = MANTRA_TO_CLASSIC[t];
    if (m) return m;
  }
  return null;
}

/** Prova a leggere i giocatori dal primo foglio dell’xlsx. */
export function parsePlayersFromXLSX(buf: ArrayBuffer): Player[] {
  const wb = XLSX.read(buf, { type: 'array' });
  const sheetName = wb.SheetNames[0];
  const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1 });
  if (!rows.length) return [];

  // trova header row
  const header = rows[0].map((h: any) => String(h || '').trim().toLowerCase());
  const idxName = header.findIndex(h => ['giocatore','nome','player','calciatore'].includes(h));
  const idxTeam = header.findIndex(h => ['squadra','team','club'].includes(h));
  const idxRole = header.findIndex(h => ['r','ruolo','role'].includes(h));
  const idxPrice = header.findIndex(h => ['qt a','quotazione','valore','prezzo','fvm'].includes(h));

  const out: Player[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i] || [];
    const name = r[idxName] ?? '';
    const team = r[idxTeam] ?? '';
    const role = toClassicRole(r[idxRole]);
    const priceRaw = r[idxPrice];
    const price = Number(priceRaw) || 0;
    if (!name || !role || price <= 0) continue;
    out.push({
      id: `${i}-${String(name).trim()}`,
      name: String(name).trim(),
      team: String(team || '').trim(),
      role,
      price,
    });
  }
  return out;
}
