export function adaptDrivers(raw = []) {
  return raw.map(r => {
    const code =
      r.driver_code || r.tla || r.three_letter_name ||
      (r.name_acronym ? String(r.name_acronym).toUpperCase() : null) ||
      (r.last_name ? String(r.last_name).slice(0,3).toUpperCase() : null) ||
      (r.full_name ? String(r.full_name).split(' ').pop().slice(0,3).toUpperCase() : 'DRV');

    // team color puede venir como "#0C0C0C" o "0C0C0C"
    const rawColour = r.team_colour || r.team_color || r.team_hex || r.team_colour_hex;
    const teamName = normalizeTeamName(r.team_name);

    const color = rawColour
      ? (String(rawColour).startsWith('#') ? String(rawColour) : `#${String(rawColour)}`)
      : teamFallback(teamName);

    return {
      driverNumber: Number(r.driver_number),
      code,
      name: r.full_name ?? r.broadcast_name ?? `${r.first_name ?? ''} ${r.last_name ?? ''}`.trim(),
      team: teamName ?? '—',
      color
    };
  });
}

// Normaliza variantes de nombres de equipo a una clave canónica
function normalizeTeamName(team) {
  if (!team) return team;
  const t = String(team).toLowerCase();

  if (t.includes('red bull')) return 'Red Bull Racing';
  if (t.includes('ferrari')) return 'Ferrari';
  if (t.includes('mercedes')) return 'Mercedes';
  if (t.includes('mclaren')) return 'McLaren';
  if (t.includes('aston martin')) return 'Aston Martin';
  if (t.includes('alpine')) return 'Alpine';
  if (t.includes('haas')) return 'Haas F1 Team';
  if (t.includes('williams')) return 'Williams';
  if (t.includes('racing bulls') || t === 'rb' || t.includes('visa cash app')) return 'Racing Bulls';
  if (t.includes('sauber') || t.includes('kick')) return 'Kick Sauber';

  return team;
}

// Colores fallback por equipo
function teamFallback(team) {
  const map = {
    'Red Bull Racing': '#3671C6',
    'Ferrari': '#E6002B',
    'Mercedes': '#00A19C',
    'McLaren': '#FF8000',
    'Aston Martin': '#006F62',
    'Alpine': '#0090FF',
    'Haas F1 Team': '#B6BABD',
    'Williams': '#00A0DE',
    'Racing Bulls': '#2B2D42',
    'Kick Sauber': '#00E701'
  };
  return map[team] ?? '#888888';
}

export function adaptSessionMeta(session, driversRaw = []) {
  return {
    sessionKey: Number(session.session_key),
    meetingName: session.country_name ? `${session.country_name} GP` : 'Grand Prix',
    circuitName: session.circuit_short_name ?? 'Circuit',
    lapsTotal: undefined,
    weather: undefined,
    drivers: adaptDrivers(driversRaw),
  };
}

export function mergeLive(
    drivers = [], 
    positions = [], 
    laps = [], 
    pits = [],
    intervals = [],
    stints = [],
    carData = [],
    startingGrid = []
) {
  const byDriver = Object.fromEntries(drivers.map(d => [d.driverNumber, d]));
  const lastLapBy = {};
  const bestLapBy = {};
  const lapCountBy = {};
  for (const l of (laps || [])) {
    const num = Number(l.driver_number);
    const lapNo = toInt(l.lap_number ?? l.lap);
    if (lapNo > (lapCountBy[num] ?? 0)) lapCountBy[num] = lapNo;

    const lapMs = secToMs(l.lap_duration ?? l.duration ?? l.time);
    if (Number.isFinite(lapMs)) {
        if (!bestLapBy[num] || lapMs < bestLapBy[num]) bestLapBy[num] = lapMs;
        lastLapBy[num] = lapMs;
    }
  }

  //Pits stops & compound
  const pitsBy = {};
  const tyreByFromPits = {};
  for (const p of pits){
    const num = Number(p.driver_number);
    pitsBy[num] = (pitsBy[num] ?? 0) + 1;
    const t = (p.tyre ?? p.compound);
    if (t) tyreByFromPits[num] = mapCompound(t);
  }

  //Active compound from STINTS (Idealy)
  const tyreBy = {};
  const stintsByDrv = groupBy(stints, x => Number(x.driver_number));
  for (const [numStr, arr] of Object.entries(stintsByDrv)) {
    const num = Number(numStr);
    //takes the stint with major lap_start (last); if lap_end null, best.
    arr.sort((a,b) => (Number(a.lap_start||0) - Number(b.lap_start||0)));
    const curr = [...arr].reverse().find(s => s.lap_end == null) || arr[arr.length-1];
    if (curr?.compound) tyreBy[num] = mapCompound(curr.compound);
  }
  //Fallback to pits if stints don't deliver
  for (const [num, c] of Object.entries(tyreByFromPits)) if (!tyreBy[num]) tyreBy[num] = c;
    
    //Gaps to leader
    const gapBy = {};
    for (const g of intervals){
        const num = Number(g.driver_number);
        gapBy[num] = parseGapToLeader(g.gap_to_leader);
    }

  //DRS and aar speed
  const drsBy = {};
  const speedBy = {};
  const latestCd = pickLatestBy(carData, x => `${x.driver_number}`, x => Date.parse(x.date));
  for (const [numStr, cd] of Object.entries(latestCd)) {
    const num = Number(numStr);
    drsBy[num] = drsFlagFromValue(cd.drs);
    if (Number.isFinite(+cd.speed)) speedBy[num] = +cd.speed;
  }

  //Starting grid
  const gridBy = {};
  for (const sg of startingGrid) {
    const num = Number(sg.driver_number);
    const pos = Number(sg.position);
    gridBy[num] = pos > 0 ? pos : null; //0 = pit lane -> treat as null
  }

  //Current position
  const latestPos = pickLatestBy(positions, x => `${x.driver_number}`, x => Date.parse(x.date));
  const rows = Object.values(latestPos)
  .map(p => {
    const num = Number(p.driver_number);
    const currPos = Number(p.position);
    const driver = byDriver[num];
    if (!driver || !currPos) return null;

    const gridPos = gridBy[num] ?? undefined;
    const posDelta = (gridPos ? gridPos - currPos : undefined); //positive = gain places

    const gap = gapBy[num];
    return {
        driverNumber: num,
        position: currPos,
        name: driver.name,
        code: driver.code,
        team: driver.team,
        color: driver.color,

         // Solicitated fields
        drs: drsBy[num] ?? null,                  // 'ON' | 'DET' | 'OFF' | null
        tyre: tyreBy[num] ?? null,                // 'S' | 'M' | 'H' | 'I' | 'W' | null
        positionsDelta: posDelta,                 // + ganadas / - perdidas
        pits: pitsBy[num] ?? 0,                   // contador
        lapsCompleted: lapCountBy[num] ?? 0,      // vueltas corridas por piloto
        gapToLeaderMs: gap?.ms ?? null,           // diferencia al líder en ms (null si líder)
        gapToLeaderLaps: gap?.laps ?? null,       // si está con vuelta perdida(s)
        bestLapMs: bestLapBy[num] ?? null,        // mejor tiempo de vuelta en ms
        speedKmh: speedBy[num] ?? null,           // velocidad instantánea (último tick car_data)

        // Uitls for UI
        lastLapMs: lastLapBy[num] ?? null,
        driver
    };
  })
  .filter(Boolean)
  .sort((a,b) => a.position - b.position);

  return rows;
}

// Utils
function groupBy(arr, keyFn) {
    const m = {};
    for (const x of arr || []) {
        const k = keyFn(x);
        (m[k] ||= []).push(x);
    }
    return m;
}
function pickLatestBy(arr, keyFn, tsFn) {
    const m = {};
    for (const x of arr || []) {
        const k = keyFn(x);
        const t = tsFn(x);
        if (!Number.isFinite(t)) continue;
        if (!m[k] || t > m[k]._t) m[k] = { ...x, _t: t};
    }
    return m;
}
function mapCompound(v) {
    const s = String(v).toUpperCase();
    if (s.startsWith('SOFT') || s === 'S') return 'S';
    if (s.startsWith('MED') || s === 'M') return 'M';
    if (s.startsWith('HAR') || s === 'H') return 'H';
    if (s.startsWith('INT') || s === 'I') return 'I';
    if (s.startsWith('WET') || s === 'W' || s.includes('FULL')) return 'W';
    return s[0] ?? null;
}
function drsFlagFromValue(v) {
    const n = Number(v);
    if ([10, 12, 14].includes(n)) return 'ON'; // DRS active
    if (n === 8) return 'DET'; //detected/armed
    return 'OFF'; // DRS off or unknowned
}
function parseGapToLeader(x){
    if (x == null) return { ms: null, laps: null }; //leader
    if (typeof x === 'string' && x.toUpperCase().includes('LAP')) {
        const m = /(\d+)/.exec(x);
        return { ms: null, laps: m ? Number (m[1]) : 1 };
    }
    const sec = Number(x);
    return Number.isFinite(sec) ? { ms: Math.round(sec*1000), laps: null } : { ms: null, laps: null };
}
function secToMs(v) {
    if (v == null) return undefined;
    const n = Number(v);
    if (Number.isFinite(n)) return Math.round(n * 1000);
    const s = String(v);
    const m = /^(\d+):([0-5]?\d)\.(\d{1,3})$/.exec(s);
    if (!m) return undefined;
    const mins = +m[1], secs = +m[2], ms = +(m[3].padEnd(3, '0'));
    return mins*60000 + secs*1000 + ms;
}
//helper
function toInt(v) {
    const n = Number.parseInt(String(v ?? ''), 10);
    return Number.isFinite(n) ? n : 0;
}



