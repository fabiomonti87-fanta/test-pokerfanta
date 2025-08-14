// src/components/FantacalcioManager.tsx
import React, { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Users, FileText, Calendar, ChevronDown, Upload, CheckCircle,
  CreditCard, TrendingUp, Home, Baby, X, Search, ChevronRight, Eye
} from 'lucide-react';

import {
  useBestLineup, ROLE_OPTIONS, FormationKey, Player,
  getFVM as getFvmHook, parseRoles
} from '../hooks/useBestLineup';

// Per compatibilita con window.fs opzionale
declare global {
  interface Window {
    fs?: { readFile: (name: string) => Promise<ArrayBuffer> }
  }
}

const FORMATION_KEYS: FormationKey[] = ['4-3-3','4-4-2','3-5-2','3-4-3','4-2-3-1'];

const FantacalcioManager: React.FC = () => {
  const [allData, setAllData] = useState<Player[]>([]);
  const [filteredData, setFilteredData] = useState<Player[]>([]);
  const [squadre, setSquadre] = useState<string[]>([]);
  const [creditiSquadre, setCreditiSquadre] = useState<Record<string, number>>({});
  const [selectedSquadra, setSelectedSquadra] = useState<string>('');
  const [filterType, setFilterType] = useState<'tutti'|'scadenza'|'organico'|'riconferme'|'nonInListone'|'vivaio'>('tutti');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string|null>(null);
  const [fileLoaded, setFileLoaded] = useState<boolean>(false);
  const [currentView, setCurrentView] = useState<'squadra'|'riepilogo'>('squadra');

  // Ricerca & filtri ruoli (OR)
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set());

  // Home search
  const [homeQuery, setHomeQuery] = useState<string>('');

  // Formazione + Campo (hidden by default)
  const [formationChoice, setFormationChoice] = useState<'auto'|FormationKey>('auto');
  const [showPitch, setShowPitch] = useState<boolean>(false);

  // Tipi di acquisto validi
  const tipiAcquistoDefault = [
    'Acquistato tit definitivo', 'Asta', 'Asta riparazione',
    'Ceduto in prestito', 'Vivaio', 'Promosso da vivaio'
  ];

  useEffect(() => {
    // Autoload da window.fs se presente
    if (typeof window !== 'undefined' && window.fs?.readFile) {
      (async () => {
        try {
          setLoading(true);
          for (const name of ['GESTIONALE_UFFICIALE 2.xlsx', 'GESTIONALE_UFFICIALE 1.xlsx', 'GESTIONALE_UFFICIALE.xlsx']) {
            try {
              const buf = await window.fs.readFile(name);
              processExcelData(buf);
              return;
            } catch { /* tenta il successivo */ }
          }
          setLoading(false);
        } catch {
          setLoading(false);
        }
      })();
    }
  }, []);

  const handleFileUpload: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true); setError(null);
    const reader = new FileReader();
    reader.onload = ev => {
      try { processExcelData(ev.target?.result as ArrayBuffer); }
      catch { setError('Errore nel processamento del file.'); setLoading(false); }
    };
    reader.onerror = () => { setError('Errore nella lettura del file.'); setLoading(false); };
    reader.readAsArrayBuffer(file);
  };

  const loadDemoData = () => {
    const demo: (string | number)[][] = [
      [1,'Mario Rossi','Dinamo Splash','JUV','Pc','Diritto 2 anni','2024-09-01','2026-07-01','Asta','', '', 50, 18, 18, '', 120, 5.0, 3.0],
      [2,'Luca Bianchi','Dinamo Splash','INT','W','Standard 1 anno','2024-09-01','2025-07-01','Acquistato tit definitivo','', '', 20, 12, 12, '', 30, 3.0, 2.0],
      [3,'Gianni Verdi','Dinamo Splash','NAP','M','Diritto 1 anno','2024-09-01','2026-08-01','Asta riparazione','', '', 15, 10, 10, '', 60, 2.0, 1.5],
      [7,'Nonno Gigi','Dinamo Splash','PAR','Por','Standard 2 anni','2024-09-01','2026-07-01','Asta','', '', 0, 0, 0, '', 0, 0.8, 0.4],
      [9,'Terzino Destro','Dinamo Splash','SAM','Dd','-','2024-09-01','2027-07-01','Asta','', '', 0, 0, 0, '', 20, 1.5, 1.0],
      [10,'Centrale 1','Dinamo Splash','LAZ','Dc','-','2024-09-01','2027-07-01','Asta','', '', 0, 0, 0, '', 25, 1.7, 1.2],
      [11,'Centrale 2','Dinamo Splash','TOR','Dc','-','2024-09-01','2027-07-01','Asta','', '', 0, 0, 0, '', 24, 1.6, 1.1],
      [12,'Terzino Sinistro','Dinamo Splash','SAS','Ds','-','2024-09-01','2027-07-01','Asta','', '', 0, 0, 0, '', 19, 1.4, 0.9],
      [13,'Esterno','Dinamo Splash','FIO','E','-','2024-09-01','2027-07-01','Asta','', '', 0, 0, 0, '', 28, 1.8, 1.3],
      [14,'Mezzala','Dinamo Splash','BOL','C','-','2024-09-01','2027-07-01','Asta','', '', 0, 0, 0, '', 26, 1.6, 1.2],
      [15,'Trequartista','Dinamo Splash','ATA','T','-','2024-09-01','2027-07-01','Asta','', '', 0, 0, 0, '', 35, 2.0, 1.5],
      [16,'Ala','Dinamo Splash','ROM','W','-','2024-09-01','2027-07-01','Asta','', '', 0, 0, 0, '', 34, 2.1, 1.5],
      [17,'Seconda Punta','Dinamo Splash','NAP','A','-','2024-09-01','2027-07-01','Asta','', '', 0, 0, 0, '', 40, 2.4, 1.6],
    ];
    const processed: Player[] = demo.map(row => ({
      id: row[0] as number, 
      giocatore: row[1] as string, 
      squadraFantacalcio: row[2] as string, 
      squadraSerieA: row[3] as string,
      ruolo: row[4] as string, 
      tipoContratto: row[5] as string, 
      dataAcquisto: row[6] as string, 
      scadenzaIpotizzata: row[7] as string,
      tipoAcquisto: row[8] as string, 
      valAsteriscato: row[9] as string, 
      scambioIngaggio: row[10] as string, 
      valoreAcquisto: row[11] as number,
      fvm2425: row[12] as number, 
      ultimoFVM: row[13] as number, 
      valoreXMercato: row[15] as number, 
      ingaggio36: row[16] as number, 
      ingaggioReale: row[17] as number
    }));
    setAllData(processed);
    const uniq = [...new Set(processed.map(p => p.squadraFantacalcio))].sort();
    setSquadre(uniq);
    setSelectedSquadra(uniq[0] || '');
    setCreditiSquadre({ 'Dinamo Splash': 100 });
    setFileLoaded(true); setLoading(false); setError(null);
  };

  const processExcelData = (data: ArrayBuffer) => {
    try {
      const wb = XLSX.read(data, { type: 'array', cellStyles: true, cellFormulas: true, cellDates: true, cellNF: true, sheetStubs: true });
      if (!wb.Sheets['Gestionale']) { setError('Il file non contiene il foglio "Gestionale".'); setLoading(false); return; }
      const raw: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets['Gestionale'], { header: 1 }) as unknown[][];
      const rows: Player[] = [];
      for (let i = 1; i < raw.length; i++) {
        const r = raw[i] as unknown[];
        if (r && r[1] && r[1] !== '#N/A') {
          rows.push({
            id: r[0] as number, 
            giocatore: r[1] as string, 
            squadraFantacalcio: r[2] as string, 
            squadraSerieA: r[3] as string, 
            ruolo: r[4] as string,
            tipoContratto: r[5] as string, 
            dataAcquisto: r[6] as string, 
            scadenzaIpotizzata: r[7] as string, 
            tipoAcquisto: r[8] as string,
            valAsteriscato: r[9] as string, 
            scambioIngaggio: r[10] as string, 
            valoreAcquisto: r[11] as number, 
            fvm2425: r[12] as number,
            ultimoFVM: r[13] as number, 
            valoreXMercato: r[15] as number, 
            ingaggio36: r[16] as number, 
            ingaggioReale: r[17] as number
          });
        }
      }
      if (!rows.length) { setError('Nessun dato valido trovato nel file.'); setLoading(false); return; }
      setAllData(rows);

      const uniq = [...new Set(rows.map(p => p.squadraFantacalcio).filter(s => s && s !== '#N/A'))].sort() as string[];
      setSquadre(uniq);

      if (wb.Sheets['Sintesi Squadre']) {
        const sintesi: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets['Sintesi Squadre'], { header: 1 }) as unknown[][];
        const cred: Record<string, number> = {};
        for (let i = 18; i < sintesi.length; i++) {
          const r = sintesi[i] as unknown[];
          if (r && r[0]) cred[r[0] as string] = parseFloat(r[1] as string) || 0;
        }
        setCreditiSquadre(cred);
      }

      if (uniq.length) setSelectedSquadra(uniq[0]);
      setFileLoaded(true); setLoading(false);
    } catch {
      setError('Errore nel processamento del file.'); setLoading(false);
    }
  };

  // Helpers di formattazione
  const formatDate = (v?: string | Date) => {
    if (!v || v === '#N/A') return '-';
    try { return new Date(v).toLocaleDateString('it-IT'); } catch { return '-'; }
  };
  const formatRuolo = (v?: string) => (!v || v === '#N/A') ? '-' : v;
  const formatFVM = (v?: string | number) => (!v || v === '#N/A') ? '-' : v;
  const formatIngaggio = (v?: string | number) => {
    if (!v || v === '#N/A') return '-';
    const n = parseFloat(String(v)); return isNaN(n) ? '-' : n.toFixed(1);
  };

  // Calcoli riepilogo
  const calculateValoreInScadenza = (squadra: string) => allData
    .filter(p => p.squadraFantacalcio === squadra
      && tipiAcquistoDefault.includes(String(p.tipoAcquisto))
      && p.scadenzaIpotizzata && p.scadenzaIpotizzata !== '#N/A'
      && new Date(p.scadenzaIpotizzata).getDate() === 1
      && new Date(p.scadenzaIpotizzata).getMonth() === 6
      && new Date(p.scadenzaIpotizzata).getFullYear() === 2025)
    .reduce((s, p) => s + (parseFloat(String(p.valoreXMercato)) || 0), 0);

  const calculatePossibiliCrediti = (squadra: string) =>
    (creditiSquadre[squadra] || 0) + calculateValoreInScadenza(squadra);

  const calculateTotaleIngaggi = (squadra: string) => allData
    .filter(p => p.squadraFantacalcio === squadra && tipiAcquistoDefault.includes(String(p.tipoAcquisto)))
    .reduce((s, p) => s + (parseFloat(String(p.ingaggioReale)) || 0), 0);

  const calculateContrattiPluriennali = (squadra: string) => allData
    .filter(p => {
      if (p.squadraFantacalcio !== squadra) return false;
      const organico = tipiAcquistoDefault.filter(t => t !== 'Vivaio');
      if (!organico.includes(String(p.tipoAcquisto))) return false;
      if (!p.scadenzaIpotizzata || p.scadenzaIpotizzata === '#N/A') return false;
      const scad = new Date(p.scadenzaIpotizzata);
      if (!(scad > new Date('2025-07-01'))) return false;
      const hasFVM = p.ultimoFVM && p.ultimoFVM !== '#N/A' && p.ultimoFVM !== '#N/D' && p.ultimoFVM !== '';
      return !!hasFVM;
    }).length;

  // Filtri principali + ricerca + ruoli (OR)
  const normalizedQuery = useMemo(() => searchQuery.trim().toLowerCase(), [searchQuery]);
  useEffect(() => {
    if (!selectedSquadra || !allData.length) { setFilteredData([]); return; }
    const res = allData.filter(p => {
      if (p.squadraFantacalcio !== selectedSquadra) return false;

      if (filterType === 'vivaio' && !(p.tipoAcquisto === 'Vivaio' || p.tipoAcquisto === 'Promosso da vivaio')) return false;

      const tipi = filterType === 'organico' ? tipiAcquistoDefault.filter(t => t !== 'Vivaio') : tipiAcquistoDefault;
      if (!tipi.includes(String(p.tipoAcquisto))) return false;

      if (filterType === 'nonInListone') {
        const noList = !p.ultimoFVM || p.ultimoFVM === '#N/A' || p.ultimoFVM === '#N/D' || p.ultimoFVM === '';
        if (!noList) return false;
      }

      if (p.scadenzaIpotizzata && p.scadenzaIpotizzata !== '#N/A') {
        const scad = new Date(p.scadenzaIpotizzata);
        const isScad2025 = scad.getDate() === 1 && scad.getMonth() === 6 && scad.getFullYear() === 2025;
        const dopo = scad > new Date('2025-07-01');
        if (filterType === 'scadenza' && !isScad2025) return false;
        if (filterType === 'organico' && !dopo) return false;
        if (filterType === 'riconferme') {
          const tc = String(p.tipoContratto || '').toLowerCase();
          const hasDiritto = tc.includes('diritto') && !tc.includes('standard');
          if (!(hasDiritto && dopo)) return false;
        }
      } else {
        if (!['tutti', 'vivaio', 'nonInListone'].includes(filterType)) return false;
      }

      if (normalizedQuery) {
        const name = String(p.giocatore || '').toLowerCase();
        if (!name.includes(normalizedQuery)) return false;
      }

      if (selectedRoles.size > 0) {
        const rolesCanon = parseRoles(p.ruolo);
        const matches = rolesCanon.some(r => selectedRoles.has(r));
        if (!matches) return false;
      }

      return true;
    });
    setFilteredData(res);
  }, [selectedSquadra, filterType, allData, normalizedQuery, selectedRoles, tipiAcquistoDefault]);

  const toggleRole = (r: string) => setSelectedRoles(prev => {
    const n = new Set(prev); n.has(r) ? n.delete(r) : n.add(r); return n;
  });

  // Home: squadre filtrate
  const squadreFiltrate = useMemo(() => {
    const q = homeQuery.trim().toLowerCase();
    if (!q) return squadre;
    return squadre.filter(s => s.toLowerCase().includes(q));
  }, [homeQuery, squadre]);

  // Organico per XI: scadenza > 01/07/2025, esclusi Vivaio/Promosso, FVM valido
  const organicoPlayers = useMemo(() => {
    if (!selectedSquadra) return [] as Player[];
    return allData
      .filter(p => p.squadraFantacalcio === selectedSquadra)
      .filter(p => {
        const organicoTypes = tipiAcquistoDefault.filter(t => t !== 'Vivaio');
        if (!organicoTypes.includes(String(p.tipoAcquisto))) return false;
        if (!p.scadenzaIpotizzata || p.scadenzaIpotizzata === '#N/A') return false;
        const scad = new Date(p.scadenzaIpotizzata);
        if (!(scad > new Date('2025-07-01'))) return false;
        return getFvmHook(p) > 0;
      });
  }, [allData, selectedSquadra, tipiAcquistoDefault]);

  const bestLineup = useBestLineup(organicoPlayers, formationChoice);

  // ------------------- RENDER -------------------

  if (!fileLoaded) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-3">
        <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
          <div className="text-center">
            <div className="mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-3">
              <Upload className="h-10 w-10 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-1">Gestionale Fantacalcio</h2>
            <p className="text-gray-600 mb-4 text-sm">Carica il file Excel <span className="font-semibold">GESTIONALE_UFFICIALE.xlsx</span> per iniziare</p>

            {loading ? (
              <div className="text-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600 mx-auto mb-3"></div>
                <p className="text-gray-600 text-sm">Elaborazione del file in corso...</p>
              </div>
            ) : (
              <>
                <label className="block w-full">
                  <div className="flex items-center justify-center w-full h-28 px-4 transition bg-white border-2 border-gray-200 border-dashed rounded-lg cursor-pointer hover:border-green-400">
                    <div className="flex flex-col items-center space-y-1">
                      <Upload className="w-8 h-8 text-gray-400" />
                      <span className="font-medium text-gray-700 text-sm">Tocca per selezionare il file</span>
                      <span className="text-[11px] text-gray-500">Oppure trascina qui</span>
                    </div>
                  </div>
                  <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} className="hidden" />
                </label>

                {error && <div className="mt-3 p-2 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs">{error}</div>}

                <div className="mt-3 flex items-center justify-center gap-2">
                  <button onClick={loadDemoData} className="px-3 py-2 rounded-lg text-sm bg-gray-900 text-white hover:bg-black">
                    Carica dati demo
                  </button>
                </div>

                <div className="mt-4 p-3 bg-blue-50 rounded-lg text-left">
                  <p className="text-[11px] text-blue-800 font-semibold mb-1">Requisiti del file</p>
                  <ul className="text-[11px] text-blue-700 space-y-1">
                    <li>• Foglio obbligatorio: &quot;Gestionale&quot;</li>
                    <li>• Colonne: Giocatore, Squadra, Ruolo, ecc.</li>
                    <li>• Formato: .xlsx o .xls</li>
                  </ul>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Caricamento dati...</p>
        </div>
      </div>
    );
  }

  // ===== HOME =====
  if (currentView === 'riepilogo') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-3 md:p-4">
        <div className="max-w-5xl mx-auto">
          <div className="bg-white rounded-xl shadow-lg p-4 md:p-6 mb-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-800 flex items-center gap-2">
                <Home className="text-green-600" /> Home - Riepilogo Squadre
              </h1>
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                <input
                  value={homeQuery}
                  onChange={e => setHomeQuery(e.target.value)}
                  placeholder="Cerca squadra..."
                  className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
                {homeQuery && (
                  <button
                    onClick={() => setHomeQuery('')}
                    className="absolute right-2 top-2 h-7 w-7 rounded-md hover:bg-gray-100 flex items-center justify-center"
                    aria-label="Pulisci ricerca squadre"
                  >
                    <X className="h-4 w-4 text-gray-500" />
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg overflow-hidden relative">
            <div className="overflow-x-auto">
              <table className="min-w-[720px] w-full text-sm">
                <thead className="bg-gradient-to-r from-green-600 to-green-700">
                  <tr>
                    <th className="px-4 md:px-6 py-3 md:py-4 text-left text-white font-semibold">Squadra</th>
                    <th className="px-4 md:px-6 py-3 text-center text-white font-semibold">Crediti</th>
                    <th className="px-4 md:px-6 py-3 text-center text-white font-semibold">Contratti Pluriennali</th>
                    <th className="px-4 md:px-6 py-3 text-center text-white font-semibold">Totale Ingaggi</th>
                    <th className="px-4 md:px-6 py-3 text-center text-white font-semibold">Possibili Crediti</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {squadreFiltrate.length === 0 && (
                    <tr><td colSpan={5} className="px-6 py-6 text-center text-gray-500">Nessuna squadra trovata</td></tr>
                  )}
                  {squadreFiltrate
                    .map(squadra => ({
                      squadra,
                      creditiAttuali: creditiSquadre[squadra] || 0,
                      possibiliCrediti: calculatePossibiliCrediti(squadra),
                      totaleIngaggi: calculateTotaleIngaggi(squadra),
                      contrattiPluriennali: calculateContrattiPluriennali(squadra)
                    }))
                    .sort((a, b) => b.possibiliCrediti - a.possibiliCrediti)
                    .map((item, idx) => (
                      <tr
                        key={item.squadra}
                        className={(idx % 2 === 0 ? 'bg-gray-50' : 'bg-white') + ' hover:bg-green-50 cursor-pointer'}
                        tabIndex={0}
                        onClick={() => { setSelectedSquadra(item.squadra); setCurrentView('squadra'); }}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setSelectedSquadra(item.squadra); setCurrentView('squadra'); } }}
                        aria-label={`Vai al dettaglio di ${item.squadra}`}
                      >
                        <td className="px-6 py-4 font-medium text-gray-900">
                          <div className="flex items-center gap-2">
                            <span>{item.squadra}</span>
                            <ChevronRight className="h-4 w-4 text-gray-400" />
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-base font-semibold text-blue-600">{item.creditiAttuali}</span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-base font-semibold text-purple-600">{item.contrattiPluriennali}</span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-base font-semibold text-orange-600">{item.totaleIngaggi.toFixed(1)}</span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-base font-semibold text-green-600">{item.possibiliCrediti.toFixed(0)}</span>
                          <span className="text-[11px] text-gray-500 ml-2">(+{(item.possibiliCrediti - item.creditiAttuali).toFixed(0)})</span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            <div className="p-3 md:p-4 bg-gray-50 border-t text-[12px] md:text-xs text-gray-600">
              <p className="mb-1"><strong>Legenda:</strong></p>
              <ul className="space-y-1">
                <li>• <strong>Contratti Pluriennali:</strong> in organico (scadenza &gt; 01/07/2025) presenti nel listone</li>
                <li>• <strong>Possibili Crediti:</strong> crediti attuali + valore dei giocatori in scadenza al 01/07/2025</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ===== DETTAGLIO =====
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
              <Users className="text-green-600" /> Gestionale Fantacalcio
            </h1>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setCurrentView('riepilogo')}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Home className="h-4 w-4" /> Home
              </button>
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle className="h-5 w-5" />
                <span>File caricato</span>
              </div>
            </div>
          </div>
        </div>

        {/* Cards riepilogo rapidi */}
        {selectedSquadra && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Crediti Rimanenti</p>
                  <p className="text-2xl font-bold text-blue-600">{creditiSquadre[selectedSquadra] || 0}</p>
                </div>
                <CreditCard className="h-8 w-8 text-blue-500" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Totale Ingaggi</p>
                  <p className="text-2xl font-bold text-orange-600">{calculateTotaleIngaggi(selectedSquadra).toFixed(1)}</p>
                  <p className="text-xs text-gray-500">(ingaggio di competenza)</p>
                </div>
                <Users className="h-8 w-8 text-orange-500" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Possibili Crediti Totali</p>
                  <p className="text-2xl font-bold text-green-600">{calculatePossibiliCrediti(selectedSquadra).toFixed(0)}</p>
                  <p className="text-xs text-gray-500">(crediti + valore in scadenza)</p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-500" />
              </div>
            </div>
          </div>
        )}

        {/* Controlli + Search ruoli */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Squadra */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Seleziona Squadra</label>
              <div className="relative">
                <select
                  value={selectedSquadra}
                  onChange={(e) => setSelectedSquadra(e.target.value)}
                  className="w-full px-4 py-2 pr-8 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white"
                >
                  {squadre.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <ChevronDown className="absolute right-2 top-3 h-5 w-5 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Filtri base */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Filtro Giocatori</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { key: 'tutti', label: 'Tutti', cls: 'bg-green-600' },
                  { key: 'scadenza', label: 'In Scadenza', cls: 'bg-red-600' },
                  { key: 'organico', label: 'In Organico', cls: 'bg-blue-600' },
                  { key: 'riconferme', label: 'Riconferme', cls: 'bg-purple-600' },
                  { key: 'nonInListone', label: 'Non in Lista', cls: 'bg-orange-600' },
                  { key: 'vivaio', label: <><Baby className="h-4 w-4 inline mr-1" />Vivaio</>, cls: 'bg-emerald-600' },
                ].map(({ key, label, cls }) => (
                  <button
                    key={key}
                    onClick={() => setFilterType(key as typeof filterType)}
                    className={`px-3 py-2 rounded-lg font-medium text-sm transition-colors ${filterType === key ? `${cls} text-white` : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Search + Toggle ruoli + Bottone mostra campo */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            {/* Search */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Cerca nella rosa</label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder={`Cerca nella rosa di ${selectedSquadra || 'squadra'}...`}
                  className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-2 h-7 w-7 rounded-md hover:bg-gray-100 flex items-center justify-center"
                    aria-label="Pulisci ricerca"
                  >
                    <X className="h-4 w-4 text-gray-500" />
                  </button>
                )}
              </div>
              <p className="mt-1 text-xs text-gray-500">La ricerca e limitata alla squadra selezionata.</p>
            </div>

            {/* Toggle Ruoli (OR) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Filtra per ruolo (OR)</label>
              <div className="flex flex-wrap gap-2">
                {ROLE_OPTIONS.map(r => {
                  const active = selectedRoles.has(r);
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => toggleRole(r)}
                      aria-pressed={active}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium border transition ${
                        active ? 'bg-green-600 text-white border-green-600' : 'bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100'
                      }`}
                    >
                      {r}
                    </button>
                  );
                })}
                {selectedRoles.size > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedRoles(new Set())}
                    className="px-3 py-1.5 rounded-full text-sm font-medium border bg-white text-gray-700 hover:bg-gray-50"
                  >
                    Azzera
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Bottone per mostrare/nascondere il campo */}
          <div className="mt-4">
            <button
              onClick={() => setShowPitch(v => !v)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
            >
              <Eye className="h-4 w-4" />
              {showPitch ? 'Nascondi campo' : 'Oggi giocherebbero cosi'}
            </button>
          </div>
        </div>

        {/* ---------- BLOCCO XI (visibile solo dopo click) ---------- */}
        {showPitch && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">Oggi giocherebbero cosi</h3>
                <p className="text-sm text-gray-500">Scelta basata sull&apos;organico (scadenza &gt; 01/07/2025) e FVM piu alto, nel rispetto dei ruoli Mantra.</p>
              </div>
              <div className="w-full md:w-64">
                <label className="block text-sm font-medium text-gray-700 mb-1">Formazione</label>
                <select
                  value={formationChoice}
                  onChange={(e) => setFormationChoice(e.target.value as typeof formationChoice)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white"
                >
                  <option value="auto">Selezione automatica (migliore)</option>
                  {FORMATION_KEYS.map(k => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>
            </div>

            {/* Campo stilizzato */}
            <div className="mt-4 overflow-x-auto">
              <div className="min-w-[640px]">
                <div
                  className="relative w-full rounded-xl border"
                  style={{
                    paddingTop: '62%',
                    backgroundImage:
                      'repeating-linear-gradient(90deg, rgba(16,122,57,0.95) 0, rgba(16,122,57,0.95) 6%, rgba(13,102,48,0.95) 6%, rgba(13,102,48,0.95) 12%)',
                    backgroundColor: '#0d6630',
                    boxShadow: 'inset 0 0 0 3px #fff, inset 0 0 0 6px rgba(255,255,255,0.4)'
                  }}
                >
                  {/* linee principali */}
                  <div className="absolute left-1/2 top-0 -translate-x-1/2 w-px h-full bg-white/70" />
                  <div className="absolute left-1/2 top-[31%] -translate-x-1/2 w-[18%] h-[32%] rounded-full border border-white/70" />
                  <div className="absolute left-[20%] bottom-0 w-[60%] h-[22%] border-t border-white/70" />
                  <div className="absolute left-[20%] top-0 w-[60%] h-[22%] border-b border-white/70" />

                  {/* giocatori */}
                  {bestLineup && bestLineup.assigned.map((a, i) => {
                    const p = a.player;
                    const left = `${a.slot.x}%`;
                    const top = `${a.slot.y}%`;
                    const label = p ? (p.giocatore.length > 14 ? p.giocatore.slice(0, 13) + '...' : p.giocatore) : '—';
                    const initials = p
                      ? (p.giocatore.split(' ')[0]?.[0] || '') + (p.giocatore.split(' ')[1]?.[0] || '')
                      : '-';
                    return (
                      <div key={`pos-${i}`} style={{ left, top, transform: 'translate(-50%, -50%)' }} className="absolute text-center">
                        <div className={`mx-auto h-10 w-10 rounded-full flex items-center justify-center border ${p ? 'bg-white/95 text-gray-900' : 'bg-white/30 text-white'} shadow`}>
                          <span className="text-[11px] font-semibold">{initials.toUpperCase()}</span>
                        </div>
                        <div className="mt-1 text-[11px] font-medium text-white drop-shadow">{label}</div>
                        <div className="text-[10px] text-white/80">
                          {p ? `${a.chosenRole} • FVM ${p._fvm.toFixed(0)}` : a.slot.label}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* riepilogo XI */}
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-gray-700">
              {bestLineup ? (
                <>
                  <span><strong>Formazione:</strong> {formationChoice === 'auto' ? `${bestLineup.key} (migliore)` : bestLineup.key}</span>
                  <span>•</span>
                  <span><strong>Titolari:</strong> {bestLineup.filled}/11</span>
                  <span>•</span>
                  <span><strong>Somma FVM XI:</strong> {bestLineup.sumFvm.toFixed(0)}</span>
                  {bestLineup.filled < 11 && (
                    <>
                      <span>•</span>
                      <span className="text-amber-700">XI incompleto: non ci sono abbastanza giocatori/ruoli in organico.</span>
                    </>
                  )}
                </>
              ) : (
                <span className="text-gray-600">Nessun giocatore in organico disponibile per calcolare l&apos;XI.</span>
              )}
            </div>

            {/* panchina */}
            {bestLineup && bestLineup.bench.length > 0 && (
              <div className="mt-4">
                <div className="text-sm font-semibold text-gray-800 mb-1">Panchina (migliori esclusi)</div>
                <div className="flex flex-wrap gap-2">
                  {bestLineup.bench.slice(0, 12).map(b => (
                    <span key={String(b.id)} className="px-2 py-1 rounded-full bg-gray-100 border text-xs text-gray-800">
                      {b.giocatore} <span className="text-gray-500">({parseRoles(b.ruolo).join('/')})</span> • FVM {getFvmHook(b).toFixed(0)}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        {/* ---------- fine XI ---------- */}

        {/* Statistiche tabella */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Totale Giocatori</p>
                <p className="text-2xl font-bold text-gray-800">{filteredData.length}</p>
              </div>
              <Users className="h-8 w-8 text-green-500" />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">In Scadenza</p>
                <p className="text-2xl font-bold text-red-600">
                  {filteredData.filter(p => {
                    if (!p.scadenzaIpotizzata || p.scadenzaIpotizzata === '#N/A') return false;
                    const s = new Date(p.scadenzaIpotizzata);
                    return s.getDate() === 1 && s.getMonth() === 6 && s.getFullYear() === 2025;
                  }).length}
                </p>
              </div>
              <Calendar className="h-8 w-8 text-red-500" />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Riconferme</p>
                <p className="text-2xl font-bold text-purple-600">
                  {filteredData.filter(p => {
                    if (!p.scadenzaIpotizzata || p.scadenzaIpotizzata === '#N/A') return false;
                    const scad = new Date(p.scadenzaIpotizzata);
                    const dopo = scad > new Date('2025-07-01');
                    const tc = String(p.tipoContratto || '').toLowerCase();
                    const hasDiritto = tc.includes('diritto') && !tc.includes('standard');
                    return hasDiritto && dopo;
                  }).length}
                </p>
              </div>
              <FileText className="h-8 w-8 text-purple-500" />
            </div>
          </div>
        </div>

        {/* Tabella rosa */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-green-600 to-green-700">
            <h2 className="text-xl font-semibold text-white">Rosa {selectedSquadra}</h2>
          </div>
          <div className="overflow-x-auto relative">
            <table className="w-full min-w-[900px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Giocatore</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ruolo</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo Contratto</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Valore Mercato 25/26</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ingaggio</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Scadenza</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredData.length ? filteredData.map((p, i) => {
                  const scad = p.scadenzaIpotizzata && p.scadenzaIpotizzata !== '#N/A' ? new Date(p.scadenzaIpotizzata) : null;
                  const inScadenza = !!(scad && scad.getDate() === 1 && scad.getMonth() === 6 && scad.getFullYear() === 2025);
                  let rowBg = '';
                  if (p.tipoAcquisto === 'Vivaio') rowBg = 'bg-green-50';
                  else if (p.tipoAcquisto === 'Promosso da vivaio') rowBg = 'bg-blue-100';
                  else if (p.tipoContratto && (String(p.tipoContratto).toLowerCase().includes('obbligo') || String(p.tipoContratto).toLowerCase().includes('diritto'))) rowBg = 'bg-yellow-100';
                  return (
                    <tr key={`${p.id ?? i}-${p.giocatore}`} className={`hover:bg-gray-50 transition-colors ${rowBg}`}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{p.giocatore}</div>
                          <div className="text-xs text-gray-500">{p.squadraSerieA !== '#N/A' ? p.squadraSerieA : '-'}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                          {formatRuolo(p.ruolo)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{p.tipoContratto || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-semibold text-gray-900">{formatFVM(p.valoreXMercato)}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-xs">
                          <div className="text-gray-700">
                            <span className="font-medium">Competenza:</span>{' '}
                            <span className="text-orange-600 font-semibold">{formatIngaggio(p.ingaggioReale)}</span>
                          </div>
                          <div className="text-gray-600">
                            <span className="font-medium">Giocatore:</span>{' '}
                            <span className="text-gray-800">{formatIngaggio(p.ingaggio36)}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${inScadenza ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                          {formatDate(p.scadenzaIpotizzata)}
                        </span>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-500">Nessun giocatore trovato con i filtri selezionati</td></tr>
                )}

                {filteredData.length > 0 && (
                  <tr className="bg-gray-100 font-bold">
                    <td colSpan={3} className="px-6 py-3 text-right text-sm text-gray-900">TOTALI:</td>
                    <td className="px-6 py-3 whitespace-nowrap">
                      <span className="text-sm font-bold text-green-700">
                        {filteredData.reduce((sum, p) => sum + (parseFloat(String(p.valoreXMercato)) || 0), 0).toFixed(0)}
                      </span>
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap">
                      <div className="text-xs text-orange-700 font-bold">
                        {filteredData.reduce((sum, p) => sum + (parseFloat(String(p.ingaggioReale)) || 0), 0).toFixed(1)}
                      </div>
                    </td>
                    <td className="px-6 py-3"></td>
                  </tr>
                )}
              </tbody>
            </table>
            <div className="pointer-events-none absolute right-2 bottom-2 text-xs text-gray-500 bg-white/80 rounded px-2 py-1 shadow-sm md:hidden">Scorri →</div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center">
          <label className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800 cursor-pointer">
            <Upload className="h-4 w-4" />
            <span>Carica un file diverso</span>
            <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} className="hidden" />
          </label>
        </div>
      </div>
    </div>
  );
};

export default FantacalcioManager;