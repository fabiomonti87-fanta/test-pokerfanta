"use client";

import React, { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { Search, Upload } from "lucide-react";

/* =======================
   Tipi e costanti base
======================= */

type ClassicRole = "P" | "D" | "C" | "A";

type Player = {
  id: string;
  name: string;
  team: string;
  role: ClassicRole;
  price: number; // FVM
};

const ROLE_ORDER: ClassicRole[] = ["P", "D", "C", "A"];
const REQUIRED_COUNTS: Record<ClassicRole, number> = { P: 3, D: 8, C: 8, A: 6 };
const ROLE_COLORS: Record<ClassicRole, string> = {
  P: "bg-cyan-400",
  D: "bg-green-400",
  C: "bg-amber-400",
  A: "bg-fuchsia-400",
};

function normalizeRole(raw: any): ClassicRole | null {
  const s = String(raw ?? "").trim().toLowerCase();
  if (!s) return null;
  if (["p", "por", "portiere"].includes(s)) return "P";
  if (["d", "dif", "difensore"].includes(s)) return "D";
  if (["c", "cen", "centrocampista", "med", "mezzala"].includes(s)) return "C";
  if (["a", "att", "attaccante", "punta", "ala"].includes(s)) return "A";
  return null;
}

function parseNumber(v: any): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const s = v.replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function sum(arr: number[]) {
  return arr.reduce((a, b) => a + b, 0);
}

/* =======================
   Componenti UI semplici
======================= */

function StatBox({
  title,
  value,
  accent = false,
}: {
  title: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl bg-white/5 border border-white/10 p-4">
      <div className="text-sm text-white/70">{title}</div>
      <div className={`text-2xl font-bold ${accent ? "text-emerald-400" : ""}`}>
        {value}
      </div>
    </div>
  );
}

function PercentInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <div className="text-xs text-white/70 mb-1">{label}</div>
      <input
        type="number"
        min={0}
        max={100}
        step={1}
        value={value}
        onChange={(e) => onChange(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
        className="w-full px-3 py-2 rounded-lg bg-white/10 text-white border border-white/20 focus:outline-none focus:ring-2 focus:ring-emerald-500"
      />
    </label>
  );
}

/* =======================
   ClassicBuilder
======================= */

export default function ClassicBuilder({
  budget = 1000,
}: {
  budget?: number;
}) {
  // dataset
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<string[]>([]);

  // filtri
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState<ClassicRole | "all">("all");
  const [teamFilter, setTeamFilter] = useState<string>("all");

  // rosa
  const [selected, setSelected] = useState<Player[]>([]);
  const countByRole = useMemo(() => {
    const m: Record<ClassicRole, number> = { P: 0, D: 0, C: 0, A: 0 };
    for (const p of selected) m[p.role]++;
    return m;
  }, [selected]);

  const spent = useMemo(() => sum(selected.map((p) => p.price)), [selected]);
  const left = budget - spent;

  // percentuali random
  const [pctP, setPctP] = useState(9);
  const [pctD, setPctD] = useState(15);
  const [pctC, setPctC] = useState(30);
  const [pctA, setPctA] = useState(46);

  // debug card
  const [showDebug, setShowDebug] = useState(false);

  // anti-duplicato random
  const [lastRandomKey, setLastRandomKey] = useState("");

  /* ----------------------
     Upload Excel (FVM)
  ----------------------- */
  const handleExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<any>(ws, { defval: "" });

    if (!rows.length) return;

    // prova a rilevare le colonne (nome, squadra, ruolo, FVM)
    const keys = Object.keys(rows[0]).map((k) => k.toString().toLowerCase());

    const findKey = (candidates: string[]) => {
      const hit = keys.find((k) =>
        candidates.some((c) => k.includes(c.toLowerCase()))
      );
      return hit || "";
    };

    const keyName = findKey(["giocatore", "nome", "player"]);
    const keyTeam = findKey(["squadra", "team", "club"]);
    const keyRole = findKey(["ruolo", "r"]);
    // usa *preferibilmente* Quotazione FVM
    const keyFvm = findKey(["quotazione fvm", "fvm", "q fvm", "quot fvm"]);

    const next: Player[] = [];
    rows.forEach((row: any, i: number) => {
      const rawName = keyName ? row[keyName] : row["Nome"] ?? row["Giocatore"];
      const rawTeam = keyTeam ? row[keyTeam] : row["Squadra"];
      const rawRole = keyRole ? row[keyRole] : row["R"] ?? row["Ruolo"];
      // FVM preferito
      let rawFvm: any =
        keyFvm ? row[keyFvm] : row["Quotazione FVM"] ?? row["FVM"] ?? row["Fvm"];
      // fallback se proprio non c'è (es. vecchi listoni)
      if (rawFvm === undefined || rawFvm === "") {
        rawFvm = row["Quotazione"] ?? row["Q"];
      }

      const role = normalizeRole(rawRole);
      const name = String(rawName ?? "").trim();
      const team = String(rawTeam ?? "").trim();
      const price = parseNumber(rawFvm);

      if (!role || !name || !team || !Number.isFinite(price)) return;

      next.push({
        id: `${role}-${name}-${team}-${i}`,
        name,
        team,
        role,
        price,
      });
    });

    next.sort((a, b) => a.name.localeCompare(b.name, "it"));
    setAllPlayers(next);
    setTeams(Array.from(new Set(next.map((p) => p.team))).sort());
    // svuota selezioni se stai ricaricando un file diverso
    setSelected([]);
    setLastRandomKey("");
  };

  /* ----------------------
     Filtrati
  ----------------------- */
  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return allPlayers.filter((p) => {
      if (roleFilter !== "all" && p.role !== roleFilter) return false;
      if (teamFilter !== "all" && p.team !== teamFilter) return false;
      if (!ql) return true;
      return (
        p.name.toLowerCase().includes(ql) ||
        p.team.toLowerCase().includes(ql)
      );
    });
  }, [allPlayers, q, roleFilter, teamFilter]);

  /* ----------------------
     Aggiungi / rimuovi
  ----------------------- */
  const canAdd = (p: Player) => {
    if (selected.some((x) => x.id === p.id)) return false;
    if (left < p.price) return false;
    const limit = REQUIRED_COUNTS[p.role];
    if (countByRole[p.role] >= limit) return false;
    if (selected.length >= 25) return false;
    return true;
  };

  const add = (p: Player) => {
    if (!canAdd(p)) return;
    setSelected((s) => [...s, p]);
  };

  const remove = (id: string) => {
    setSelected((s) => s.filter((p) => p.id !== id));
  };

  const canConfirm =
    selected.length === 25 &&
    ROLE_ORDER.every((r) => countByRole[r] === REQUIRED_COUNTS[r]) &&
    left >= 0;

  /* ----------------------
     Randomizzatore smart
  ----------------------- */

  const randomize = () => {
    if (!allPlayers.length) return;

    const targets: Record<ClassicRole, number> = {
      P: Math.round((pctP / 100) * budget),
      D: Math.round((pctD / 100) * budget),
      C: Math.round((pctC / 100) * budget),
      A: Math.round((pctA / 100) * budget),
    };

    const byRole: Record<ClassicRole, Player[]> = {
      P: [],
      D: [],
      C: [],
      A: [],
    };
    for (const p of allPlayers) byRole[p.role].push(p);
    ROLE_ORDER.forEach((r) => byRole[r].sort((a, b) => b.price - a.price));

    const buildTeamOnce = (): Player[] => {
      const picked: Player[] = [];
      const spendByRole: Record<ClassicRole, number> = { P: 0, D: 0, C: 0, A: 0 };
      const need: Record<ClassicRole, number> = { P: 3, D: 8, C: 8, A: 6 };

      // 1) riempi ruolo per ruolo (mix top / mid / low)
      ROLE_ORDER.forEach((role) => {
        const pool = byRole[role];
        const topEnd = Math.max(1, Math.floor(pool.length * 0.25));
        const midEnd = Math.max(topEnd + 1, Math.floor(pool.length * 0.65));

        for (let i = 0; i < need[role]; i++) {
          let cand: Player | undefined;
          const r = Math.random();
          if (r < 0.4) cand = pool[Math.floor(Math.random() * topEnd)];
          else if (r < 0.8)
            cand =
              pool[topEnd + Math.floor(Math.random() * Math.max(1, midEnd - topEnd))];
          else
            cand =
              pool[
                midEnd + Math.floor(Math.random() * Math.max(1, pool.length - midEnd))
              ];

          if (!cand) {
            i--;
            continue;
          }
          if (picked.some((x) => x.id === cand!.id)) {
            i--;
            continue;
          }
          picked.push(cand);
          spendByRole[role] += cand.price;
        }
      });

      // 2) se sfora budget -> downgrade mirati
      let total = sum(picked.map((p) => p.price));
      if (total > budget) {
        let over = total - budget;
        for (let guard = 0; guard < 200 && over > 0; guard++) {
          // ruolo più sopra al target
          const role = ROLE_ORDER.sort(
            (a, b) => (spendByRole[a] - targets[a]) - (spendByRole[b] - targets[b])
          ).pop() as ClassicRole;

          const inRole = picked
            .filter((p) => p.role === role)
            .sort((a, b) => b.price - a.price);
          const victim = inRole[0];
          if (!victim) break;

          const pool = byRole[role];
          const cheaper = pool
            .slice()
            .reverse()
            .find(
              (q) => q.price < victim.price && !picked.some((x) => x.id === q.id)
            );
          if (!cheaper) break;

          const idx = picked.findIndex((x) => x.id === victim.id);
          picked[idx] = cheaper;
          spendByRole[role] += cheaper.price - victim.price;
          over -= victim.price - cheaper.price;
          total -= victim.price - cheaper.price;
        }
      }

      // 3) se avanza -> upgrade finché possibile (lascia <= 2 crediti)
      let leftLocal = budget - sum(picked.map((p) => p.price));
      for (let guard = 0; guard < 300 && leftLocal > 2; guard++) {
        const role = ROLE_ORDER.sort(
          (a, b) => (targets[a] - spendByRole[a]) - (targets[b] - spendByRole[b])
        )[0];

        const inRole = picked
          .map((p, i) => ({ p, i }))
          .filter((x) => x.p.role === role)
          .sort((a, b) => a.p.price - b.p.price);

        if (!inRole.length) break;
        const idx = inRole[0].i;
        const current = picked[idx];

        const pool = byRole[role];
        const upgrade = pool.find(
          (q) =>
            q.price > current.price &&
            q.price <= current.price + leftLocal &&
            !picked.some((x) => x.id === q.id)
        );
        if (!upgrade) break;

        picked[idx] = upgrade;
        spendByRole[role] += upgrade.price - current.price;
        leftLocal -= upgrade.price - current.price;
      }

      return picked;
    };

    const MAX_TRIES = 8;
    for (let t = 0; t < MAX_TRIES; t++) {
      const team = buildTeamOnce();
      const key = team
        .map((p) => p.id)
        .sort()
        .join("-");
      if (key !== lastRandomKey || t === MAX_TRIES - 1) {
        setSelected(team);
        setLastRandomKey(key);
        return;
      }
    }
  };

  /* ----------------------
     Render
  ----------------------- */

  return (
    <div className="space-y-4">
      {/* Header: ricerca + filtri + upload */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/60" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cerca nome o squadra…"
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-white/10 text-white placeholder-white/60 border border-white/20 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* Ruolo */}
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as any)}
          className="px-3 py-2 rounded-lg bg-white/10 text-white border border-white/20"
        >
          <option value="all">Tutti i ruoli</option>
          <option value="P">P</option>
          <option value="D">D</option>
          <option value="C">C</option>
          <option value="A">A</option>
        </select>

        {/* Squadra */}
        <select
          value={teamFilter}
          onChange={(e) => setTeamFilter(e.target.value)}
          className="px-3 py-2 rounded-lg bg-white/10 text-white border border-white/20"
        >
          <option value="all">Tutte le squadre</option>
          {teams.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        {/* Carica Excel */}
        <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 cursor-pointer">
          <Upload className="h-4 w-4" />
          <span>Carica Excel</span>
          <input
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleExcel}
          />
        </label>
      </div>

      {/* Riga 2: Distribuzione + Random */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Distribuzione crediti (debug interno) */}
        <div className="rounded-xl bg-emerald-700/25 border border-emerald-500/30">
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
            <div className="font-semibold">
              Distribuzione crediti % (vincolante per il random)
            </div>
            <button
              type="button"
              onClick={() => setShowDebug((v) => !v)}
              className="px-2 py-1 rounded-md bg-white/10 text-white hover:bg-white/15 text-xs"
              title="Mostra/Nascondi debug budget per ruolo"
            >
              {showDebug ? "Nascondi debug" : "Mostra debug"}
            </button>
          </div>

          <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <PercentInput label="Ruolo P" value={pctP} onChange={setPctP} />
            <PercentInput label="Ruolo D" value={pctD} onChange={setPctD} />
            <PercentInput label="Ruolo C" value={pctC} onChange={setPctC} />
            <PercentInput label="Ruolo A" value={pctA} onChange={setPctA} />
          </div>

          {showDebug && (
            <div className="px-4 pb-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              {ROLE_ORDER.map((r) => {
                const target =
                  Math.round(
                    ((r === "P" ? pctP : r === "D" ? pctD : r === "C" ? pctC : pctA) /
                      100) *
                      budget
                  ) || 0;
                const spentRole = selected
                  .filter((p) => p.role === r)
                  .reduce((s, p) => s + p.price, 0);
                const pct =
                  Math.round((spentRole / Math.max(1, budget)) * 1000) / 10;
                return (
                  <div
                    key={r}
                    className="rounded-lg bg-white/10 border border-white/10 p-3"
                  >
                    <div className="text-xs text-white/70">Ruolo {r}</div>
                    <div className="text-lg font-semibold">{target}</div>
                    <div className="text-xs">
                      Spesi <span className="font-semibold">{spentRole}</span>{" "}
                      <span className="text-white/60">• ({pct}%)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Randomizzatore */}
        <div className="rounded-xl bg-white/5 border border-white/10 p-4">
          <div className="font-semibold mb-2">Randomizzatore (smart)</div>
          <p className="text-sm text-white/70 mb-3">
            Crea una rosa rispettando le percentuali per ruolo, prova a usare
            quasi tutto il budget (rimasto ≤ 2), e rispetta i limiti 3P/8D/8C/6A.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={randomize}
              className="px-3 py-2 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-700"
            >
              🎲 Randomizza (rispetta % ruolo)
            </button>
            <button
              onClick={() => setSelected([])}
              className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15"
            >
              Svuota rosa
            </button>
          </div>
        </div>
      </div>

      {/* Riepiloghi */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatBox title="Budget" value={budget} />
        <StatBox title="Speso" value={spent} />
        <StatBox title="Rimanente" value={left} accent />
        {ROLE_ORDER.map((r) => (
          <div
            key={r}
            className="rounded-xl bg-white/5 border border-white/10 p-4 flex items-center justify-between"
          >
            <div>
              <div className="text-sm text-white/70">Ruolo {r}</div>
              <div className="text-xl font-semibold">
                {countByRole[r]}/{REQUIRED_COUNTS[r]}
              </div>
            </div>
            <div className={`h-3 w-3 rounded-full ${ROLE_COLORS[r]}`} />
          </div>
        ))}
      </div>

      {/* Elenco + Rosa */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Elenco */}
        <div className="rounded-xl bg-white/5 border border-white/10">
          <div className="px-4 py-3 border-b border-white/10 font-semibold">
            Listone (FVM)
          </div>
          <div className="max-h-[520px] overflow-auto divide-y divide-white/10">
            {filtered.length === 0 ? (
              <div className="p-4 text-sm text-white/70">
                Nessun giocatore trovato. Carica l’Excel o modifica i filtri.
              </div>
            ) : (
              filtered.map((p) => (
                <div
                  key={p.id}
                  className="px-4 py-2 flex items-center justify-between"
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">
                      {p.name} <span className="text-white/60">({p.team})</span>
                    </div>
                    <div className="text-xs text-white/70">
                      Ruolo {p.role} • FVM {p.price}
                    </div>
                  </div>
                  <button
                    disabled={!canAdd(p)}
                    onClick={() => add(p)}
                    className="px-2 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Aggiungi
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Rosa */}
        <div className="rounded-xl bg-white/5 border border-white/10 flex flex-col">
          <div className="px-4 py-3 border-b border-white/10 font-semibold">
            La tua rosa ({selected.length}/25)
          </div>
          <div className="flex-1 max-h-[420px] overflow-auto divide-y divide-white/10">
            {selected.length === 0 ? (
              <div className="p-4 text-sm text-white/70">
                Nessun giocatore selezionato.
              </div>
            ) : (
              selected.map((p) => (
                <div
                  key={p.id}
                  className="px-4 py-2 flex items-center justify-between"
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">
                      {p.role} • {p.name}{" "}
                      <span className="text-white/60">({p.team})</span>
                    </div>
                    <div className="text-xs text-white/70">FVM {p.price}</div>
                  </div>
                  <button
                    onClick={() => remove(p.id)}
                    className="px-2 py-1 rounded-md bg-white/10 hover:bg-white/15"
                  >
                    Rimuovi
                  </button>
                </div>
              ))
            )}
          </div>

          {/* CTA conferma */}
          <div className="p-4 border-t border-white/10">
            <ul className="text-xs text-white/70 mb-2 space-y-1">
              <li>• Servono 25 giocatori.</li>
              <li>• Ruoli: 3P / 8D / 8C / 6A.</li>
              <li>• Non superare il budget.</li>
            </ul>
            <button
              disabled={!canConfirm}
              onClick={() => alert("Rosa confermata (demo).")}
              className="w-full px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Conferma rosa
            </button>
          </div>
        </div>
      </div>

      {/* Footer budget */}
      <div className="flex items-center justify-between pt-2">
        <div className="text-sm text-white/80">
          Budget: <span className="font-semibold">{budget}</span> • Rimasti:{" "}
          <span className="font-semibold text-emerald-400">{left}</span>
        </div>
      </div>
    </div>
  );
}
