import { getJson } from '../lib/http.js';

//Current Session
export async function getCurrentSession() {
  const year = new Date().getUTCFullYear();
  const arr = await getJson('/sessions', { year });
  if (!Array.isArray(arr) || arr.length === 0) return null;

  const now = Date.now();
  const inProgress = arr.find(s => {
    const start = Date.parse(s.date_start);
    const end   = Date.parse(s.date_end);
    return Number.isFinite(start) && Number.isFinite(end) && start <= now && now <= end;
  });
  const latestByStart = [...arr].sort((a, b) => Date.parse(b.date_start) - Date.parse(a.date_start))[0];
  return inProgress ?? latestByStart ?? null;
}

//Current Drivers in Session
export async function getDrivers(session_key) {
  return getJson('/drivers', { session_key });
}


// position vs positions
export async function getPosition(session_key, since) {
  try { return await getJson('/position', { session_key, date_start: since }); }
  catch { return await getJson('/positions', { session_key, date_start: since }); }
}

//Intervals: Fetches time gap between driver and race leader
export async function getIntervals(session_key, since) {
    try { return getJson('/intervals', { session_key, date_start: since }); }
    catch { return []; }
}

//Car Data: Fetches data from the car
export async function getCarData(session_key, since) {
    try { return getJson('/car_data', { session_key, date_start: since }) }
    catch { return []; }
}

//Stints: Provides information about individual stints. A stint refers to a period of continuous driving by a driver during a session.
export async function getStints(session_key ) {
    return getJson('/stints', { session_key });
}

//Starting grid
export async function getStartingGrid(session_key) {
    //Name is still in beta
    return getJson('/starting_grid', { session_key });
}

export async function getLaps(session_key, since) {
  return getJson('/laps', { session_key, date_start: since });
}

export async function getPit(session_key, since) {
  try { return await getJson('/pit', { session_key, date_start: since }); }
  catch { return await getJson('/pits', { session_key, date_start: since }); }
}

// race_control vs race_control_messages
export async function getRaceControl(session_key, since) {
  try { return await getJson('/race_control', { session_key, date_start: since }); }
  catch { return await getJson('/race_control_messages', { session_key, date_start: since }); }
}

// (opcional) ubicación en pista
export async function getLocation(session_key, since) {
  return getJson('/location', { session_key, date_start: since });
}
