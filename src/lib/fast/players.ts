// src/lib/fast/players.ts
import * as XLSX from 'xlsx';
import { Player, ClassicRole } from './game';

// Mappa (Mantra -> Classic)
const MANTRA_TO_CLASSIC: Record<string, ClassicRole> = {
  POR: 'P', PC: 'A',
  DC: 'D', DD: 'D', DS: 'D', B: 'D',
  E: 'C', M: 'C', C: 'C', T: 'C',
  W: 'A', A: 'A',
};

function toClassicRole(raw: unknown): ClassicRole | null {
  if (!raw) return null;
  const s = String(raw).trim();
  const up = s.toUpperCase();
  if (['P','D','C','A'].includes(up)) return up as ClassicRole; // colonna "R"
  const tokens = up.split(/[^A-Z]+/).filter(Boolean);           // colonna "RM" (Mantra)
  for (const t of tokens) {
    const m = MANTRA_TO_CLASSIC[t];
    if (m) return m;
  }
  return null;
}

function norm(s: unknown): string {
  return String(s ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
function looksLikeHeader(cells: any[]): boolean {
  const L = cells.map(norm);
  const hasNome    = L.some(v => v === 'nome' || v.includes('giocatore'));
  const hasSquadra = L.some(v => v === 'squadra' || v === 'team' || v === 'club');
  const hasPrezzo  = L.some(v => /^(qt\.?\s*a|quotazione|fvm|qt)$/.test(v));
  const hasRuolo   = L.some(v => v === 'r' || v === 'ruolo' || v === 'role' || v === 'pos');
  return hasNome && hasSquadra && hasPrezzo && hasRuolo;
}

/** Parser generico: trova la riga di header corretta e legge il listone. */
function parseSheet(ws: XLSX.WorkSheet): Player[] {
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false }) as any[][];
  if (!rows.length) return [];

  // cerca l’header nelle prime 10 righe
  let headerRow = 0;
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    if (looksLikeHeader(rows[i] || [])) { headerRow = i; break; }
  }
  const header = (rows[headerRow] || []).map(norm);

  // indici colonne
  const idxName  = header.findIndex(h => h === 'nome' || h.includes('giocatore'));
  const idxTeam  = header.findIndex(h => h === 'squadra' || h === 'team' || h === 'club');
  const idxRoleR = header.findIndex(h => h === 'r' || h === 'ruolo' || h === 'role' || h === 'pos');
  const idxRoleM = header.findIndex(h => h === 'rm'); // opzionale colonna Mantra
  const idxPrice = header.findIndex(h => /^(qt\.?\s*a|quotazione|fvm|qt)$/.test(h));

  if (idxName < 0 || idxTeam < 0 || (idxRoleR < 0 && idxRoleM < 0) || idxPrice < 0) {
    return []; // header non trovato
  }

  const out: Player[] = [];
  for (let i = headerRow + 1; i < rows.length; i++) {
    const r = rows[i] || [];
    const name = r[idxName];
    const team = r[idxTeam];
    const roleRaw = idxRoleR >= 0 ? r[idxRoleR] : r[idxRoleM];
    const price = Number(r[idxPrice]) || 0;

    const role = toClassicRole(roleRaw);
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

export function parsePlayersFromXLSX(buf: ArrayBuffer): Player[] {
  const wb = XLSX.read(buf, { type: 'array' });

  // Se esiste il foglio "Tutti", usalo (il tuo file lo ha)
  const hasTutti = wb.SheetNames.includes('Tutti');
  if (hasTutti) {
    const p = parseSheet(wb.Sheets['Tutti']);
    if (p.length) return p;
  }

  // fallback: prova tutti i fogli finché trovi qualcosa
  for (const name of wb.SheetNames) {
    const p = parseSheet(wb.Sheets[name]);
    if (p.length) return p;
  }
  return [];
}
