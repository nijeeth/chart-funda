// ─────────────────────────────────────────────────
//  bse-lookup.js
//  Maps Screener's numeric BSE scrip codes to real
//  TradingView-compatible symbols, using Zerodha's
//  public (no-auth) Kite Connect instruments dump.
//  Cached in chrome.storage.local, refreshed every 24h.
// ─────────────────────────────────────────────────

const BSE_LOOKUP_CACHE_KEY = 'bse_lookup_cache_v2';
const BSE_LOOKUP_TTL_MS = 24 * 60 * 60 * 1000; // 24h

async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (e) {
    clearTimeout(timer);
    if (e.name === 'AbortError') throw new Error('Kite instruments request timed out');
    throw e;
  }
}

function splitCsv(line) {
  const out = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else quoted = false;
      } else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

async function fetchAndBuildBseLookup() {
  const res = await fetchWithTimeout('https://api.kite.trade/instruments');
  if (!res.ok) throw new Error(`Kite instruments HTTP ${res.status}`);
  const text = await res.text();
  const byToken = {};
  const bySymbol = {};
  const lines = text.split('\n');
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const cols = splitCsv(line);
    if (cols.length < 12) continue;
    const exchangeToken = cols[1];
    const tradingsymbol = cols[2];
    const instrumentType = cols[9];
    const segment = cols[10];
    if (segment === 'BSE' && instrumentType === 'EQ' && exchangeToken && tradingsymbol) {
      byToken[exchangeToken] = tradingsymbol;
      bySymbol[tradingsymbol.toUpperCase()] = exchangeToken;
    }
  }
  return { byToken, bySymbol };
}

/**
 * Returns a { exchangeToken: tradingsymbol } map for BSE equities.
 * Uses a 24h cache in chrome.storage.local; refetches only when stale.
 * Falls back to a stale cache (or an empty map) if the refresh fails,
 * so a network hiccup never breaks peer-symbol resolution entirely.
 */
export async function getBseLookup() {
  return new Promise((resolve) => {
    chrome.storage.local.get([BSE_LOOKUP_CACHE_KEY], async (data) => {
      const entry = data[BSE_LOOKUP_CACHE_KEY];
      if (entry && Date.now() - entry.ts < BSE_LOOKUP_TTL_MS) {
        resolve(entry.map);
        return;
      }
      try {
        const map = await fetchAndBuildBseLookup();
        chrome.storage.local.set({ [BSE_LOOKUP_CACHE_KEY]: { ts: Date.now(), map } });
        resolve(map);
      } catch (e) {
        console.warn('[BSE Lookup] refresh failed:', e.message);
        resolve(entry && entry.map && entry.map.byToken ? entry.map : { byToken: {}, bySymbol: {} });
      }
    });
  });
}
