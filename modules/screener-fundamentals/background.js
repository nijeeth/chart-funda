// ─────────────────────────────────────────────────
//  screener-fundamentals/background.js
//  Fetches, parses, and caches Screener.in company data.
//  Message types handled: FETCH_SCREENER, FETCH_PEERS
// ─────────────────────────────────────────────────

import { getBseLookup } from './bse-lookup.js'


const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12h cache

// ─── Ticker validity ───
const KNOWN_FOREIGN = new Set([
  'AAPL','MSFT','GOOGL','GOOG','AMZN','TSLA','META','NVDA','NFLX',
  'AMD','INTC','QCOM','AVGO','ORCL','CRM','ADBE','PYPL','ABNB','UBER','LYFT',
  'JPM','GS','MS','BAC','WFC','C','V','MA','DIS','SBUX',
  'SPY','QQQ','VIX','DXY','EURUSD','GBPUSD','USDINR','XAUUSD','BTCUSD','ETHUSD',
  'US10Y','US30Y','SPX','NDX','DJI','RUT','DAX','FTSE','CAC','HSI','N225',
  // Index CFDs / commodities TradingView shows without an NSE/BSE prefix
  'US30','US500','US100','US2000','NAS100','SPX500','UK100','EU50','DE40','GER40',
  'FR40','JP225','HK50','HK33','AU200','IN50','USOIL','UKOIL','NATGAS','COPPER',
  'GOLD','SILVER','XAGUSD','USDJPY','GBPJPY','EURINR','GBPINR','JPYINR'
]);
function isLikelyIndianTicker(ticker) {
  if (!ticker) return false;
  if (ticker.includes('.')) return false;
  if (KNOWN_FOREIGN.has(ticker.toUpperCase())) return false;
  return true;
}

// ─── Caching layer ───
function cacheKey(ticker, consolidated) {
  // v6: bump invalidates entries cached before the stub-consolidated fix
  return `screener_cache:${ticker}:${consolidated ? 'c6' : 's6'}`;
}
async function readCache(ticker, consolidated) {
  return new Promise(resolve => {
    const key = cacheKey(ticker, consolidated);
    chrome.storage.local.get([key], (data) => {
      const entry = data[key];
      if (!entry) return resolve(null);
      if (Date.now() - entry.ts > CACHE_TTL_MS) return resolve(null);
      resolve(entry.data);
    });
  });
}
function writeCache(ticker, consolidated, data) {
  const key = cacheKey(ticker, consolidated);
  chrome.storage.local.set({ [key]: { ts: Date.now(), data } }, () => {});
}

// ─── Peers cache — keyed by warehouse id, same 12h TTL as company data ───
function peersCacheKey(warehouseId) {
  return `peers_cache:${warehouseId}`;
}
async function readPeersCache(warehouseId) {
  return new Promise(resolve => {
    const key = peersCacheKey(warehouseId);
    chrome.storage.local.get([key], (data) => {
      const entry = data[key];
      if (!entry) return resolve(null);
      if (Date.now() - entry.ts > CACHE_TTL_MS) return resolve(null);
      resolve(entry.data);
    });
  });
}
function writePeersCache(warehouseId, peers) {
  chrome.storage.local.set({ [peersCacheKey(warehouseId)]: { ts: Date.now(), data: peers } }, () => {});
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (e) {
    clearTimeout(timer);
    if (e.name === 'AbortError') throw new Error('Request timed out');
    throw e;
  }
}

// ─── Main fetch — cache, fast path, fallback ───
function indianEquityError(ticker) {
  return `Could not fetch "${ticker}". Application works only on Indian listed equity.`;
}

function slugFromUrl(url) {
  const match = String(url || '').match(/\/company\/([^/?#]+)/i);
  return match ? decodeURIComponent(match[1]) : null;
}

function topRatiosHaveNumbers(html) {
  const start = String(html || '').indexOf('id="top-ratios"');
  if (start === -1) return false;
  const end = html.indexOf('</ul>', start);
  const block = html.slice(start, end === -1 ? start + 8000 : end);
  return /<span[^>]*class="[^"]*\bnumber\b[^"]*"[^>]*>\s*[-–]?\d/i.test(block);
}

/** Data columns in the quarters table (the first <th> is the row-label). */
function quartersColumnCount(html) {
  const start = String(html || '').indexOf('id="quarters"');
  if (start === -1) return 0;
  const end = html.indexOf('</table>', start);
  const block = html.slice(start, end === -1 ? start + 30000 : end);
  const heads = block.match(/<th[^>]*>/g);
  return heads ? heads.length - 1 : 0;
}

/**
 * BSE symbols such as RAJSEC 404 on /company/RAJSEC/. Screener's search
 * returns the canonical numeric page (/company/526873/). Consolidated is
 * tried first. A 404, or a 200 page whose ratio numbers are blank
 * (Supriya Lifescience has no consolidated results), falls back to standalone.
 */
async function fetchCompanyPage(slug, consolidated) {
  const root = `https://www.screener.in/company/${encodeURIComponent(slug)}/`;
  const headers = { Accept: 'text/html' };
  if (consolidated) {
    const cons = await fetchWithTimeout(root + 'consolidated/', { headers, redirect: 'follow' }, 8000);
    if (cons.ok) {
      const html = await cons.text();
      if (topRatiosHaveNumbers(html) && quartersColumnCount(html) >= 2)
        return { url: cons.url, html, standaloneFallback: false };
    } else if (cons.status !== 404) {
      throw new Error(`HTTP ${cons.status}`);
    }
  }
  const page = await fetchWithTimeout(root, { headers, redirect: 'follow' }, 8000);
  if (page.status === 404) throw new Error(`${slug} not found on Screener.in`);
  if (!page.ok) throw new Error(`HTTP ${page.status}`);
  return { url: page.url, html: await page.text(), standaloneFallback: !!consolidated };
}

async function bseScreenerSlug(ticker) {
  const lookup = await getBseLookup();
  const token = lookup.bySymbol && lookup.bySymbol[String(ticker || '').toUpperCase()];
  return token || null;
}

async function fetchScreenerData(ticker, consolidated, forceRefresh, exchange) {
  const ex = String(exchange || '').trim().toUpperCase();
  if (ex) {
    // A known exchange is authoritative — only NSE/BSE carry Indian equity.
    if (ex !== 'NSE' && ex !== 'BSE') throw new Error(indianEquityError(ticker));
  } else if (!isLikelyIndianTicker(ticker)) {
    throw new Error(indianEquityError(ticker));
  }
  if (!forceRefresh) {
    const cached = await readCache(ticker, consolidated);
    if (cached) { cached._cached = true; return cached; }
  }
  const isBse = String(exchange || '').toUpperCase() === 'BSE';
  if (isBse) {
    try {
      const token = await bseScreenerSlug(ticker);
      if (!token) throw new Error(`No BSE scrip code for ${ticker}`);
      const data = await fetchViaHTML(token, consolidated, ticker);
      if (data && (Object.keys(data.ratios).length > 0 || data.info?.name)) {
        writeCache(ticker, consolidated, data);
        return data;
      }
    } catch (e) {
      console.log('[Screener Fundamentals] BSE scrip lookup failed:', e.message);
    }
  } else {
    try {
      const data = await fetchViaHTML(ticker, consolidated, ticker);
      if (data && (Object.keys(data.ratios).length > 0 || data.info?.name)) {
        writeCache(ticker, consolidated, data);
        return data;
      }
    } catch (e) {
      console.log('[Screener Fundamentals] direct fetch failed:', e.message);
    }
  }
  try {
    const data = await fetchViaScreenerSearch(ticker, consolidated);
    if (data && (Object.keys(data.ratios).length > 0 || data.info?.name)) {
      writeCache(ticker, consolidated, data);
      return data;
    }
  } catch (e) {
    console.log('[Screener Fundamentals] search API failed:', e.message);
  }
  throw new Error(indianEquityError(ticker));
}

async function fetchViaHTML(slug, consolidated, ticker) {
  const page = await fetchCompanyPage(slug, consolidated);
  const parsed = parseScreenerHTML(page.html, ticker || slug);
  parsed.screenerSlug = slugFromUrl(page.url) || slug;
  parsed.standaloneFallback = page.standaloneFallback;
  return parsed;
}

async function fetchViaScreenerSearch(ticker, consolidated) {
  const searchRes = await fetchWithTimeout(
    `https://www.screener.in/api/company/search/?q=${encodeURIComponent(ticker)}&v=3`,
    { headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' } },
    4000
  );
  if (!searchRes.ok) throw new Error(`Search HTTP ${searchRes.status}`);
  const results = await searchRes.json();
  if (!Array.isArray(results) || results.length === 0) throw new Error('No search results');
  const norm = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const tickerUp = ticker.toUpperCase();
  const match = results.find(r => {
    const url = (r.url || '').toUpperCase();
    return url.includes(`/${tickerUp}/`) || url.endsWith(`/${tickerUp}`)
      || norm(slugFromUrl(r.url)) === norm(ticker);
  }) || (results.length === 1 ? results[0] : null);
  if (!match) throw new Error(`No matching company for ${ticker} on Screener.in`);
  const foundSlug = slugFromUrl(match.url) || ticker;
  const pageRes = await fetchCompanyPage(foundSlug, consolidated);
  const parsed = parseScreenerHTML(pageRes.html, ticker);
  if (match.name) parsed.info.name = match.name;
  parsed.screenerSlug = slugFromUrl(pageRes.url) || foundSlug;
  parsed.standaloneFallback = pageRes.standaloneFallback;
  return parsed;
}

// ─── HTML Parser ───
function parseScreenerHTML(html, ticker) {
  const result = {
    ticker, ratios: {}, info: {}, pros: [], cons: [],
    sector: null,
    growth: {},
    shareholding: {},
    warehouseId: null,
  };

  const h1 = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1) {
    const name = stripTags(h1[1]);
    if (name) result.info.name = name;
  }

  // Peers must use this page's warehouse id. Consolidated and standalone
  // ids differ, and each one carries its own Stock P/E.
  const infoDiv = html.match(/<div\b[^>]*\bid="company-info"[^>]*>/i);
  const infoTag = infoDiv && infoDiv[0].match(/data-warehouse-id="(\d+)"/i);
  if (infoTag) result.warehouseId = infoTag[1];

  // Sector breadcrumb — up to 4 levels, e.g. Energy → Oil, Gas & Consumable Fuels → ...
const sectorLinks = [...html.matchAll(/<a[^>]*href="(\/market\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)]
  .map(m => ({ href: m[1], label: stripTags(m[2]) }));
const seenLabels = new Set();
const uniqueSector = sectorLinks.filter(s => {
  if (seenLabels.has(s.label)) return false;
  seenLabels.add(s.label);
  return true;
});
// Keep at most 2 levels: sector name + most specific sub-industry
result.sector = uniqueSector.length > 2
  ? [uniqueSector[0], uniqueSector[uniqueSector.length - 1]]
  : uniqueSector;

  // Top ratios
  const topRatiosStart = html.indexOf('id="top-ratios"');
  if (topRatiosStart !== -1) {
    const ulEnd = html.indexOf('</ul>', topRatiosStart);
    const ratioBlock = html.slice(topRatiosStart, ulEnd > -1 ? ulEnd : topRatiosStart + 6000);
    for (const li of splitByTag(ratioBlock, 'li')) {
      const keyM = li.match(/class="[^"]*\bname\b[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
      if (!keyM) continue;
      const key = stripTags(keyM[1]).trim();
      // Collect EVERY number span in this item (fixes High/Low showing only one value)
      const rest = li.replace(keyM[0], '');
      const nums = [...rest.matchAll(/<span[^>]*class="[^"]*\b(?:number|value)\b[^"]*"[^>]*>([\s\S]*?)<\/span>/gi)]
        .map(m => stripTags(m[1]).trim())
        .filter(Boolean);
      if (key && nums.length > 0) result.ratios[key] = nums;
    }
  }

  extractListSection(html, 'pros', result.pros, 5);
  extractListSection(html, 'cons', result.cons, 5);

  result.growth = extractGrowth(html);
  result.shareholding = extractShareholding(html);

  return result;
}

// ─── Ratio lookup + P/B computation ───
function getRatio(ratios, pattern) {
  for (const [key, nums] of Object.entries(ratios)) {
    if (pattern.test(key)) return nums;
  }
  return null;
}
function toNum(str) {
  const n = parseFloat((str || '').replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? null : n;
}

/**
 * Builds the 9 fundamentals tiles from the raw ratios map.
 * P/B replaces D/E: Current Price ÷ Book Value, both already present
 * in the top-ratios block — no balance-sheet fetch needed.
 */
function buildTiles(ratios) {
  const price = toNum((getRatio(ratios, /current price/i) || [])[0]);
  const bookValue = toNum((getRatio(ratios, /book value/i) || [])[0]);
  const pb = (price !== null && bookValue !== null && bookValue > 0)
    ? +(price / bookValue).toFixed(2)
    : null;

  const highLow = getRatio(ratios, /high\s*\/\s*low/i) || [];

  return {
    currentPrice: price,
    marketCap: (getRatio(ratios, /market cap/i) || [])[0] || null,
    pe: (getRatio(ratios, /^(stock )?p\/?e/i) || [])[0] || null,
    pb,
    high52w: toNum(highLow[0]),
    low52w: toNum(highLow[1]),
    dividendYield: (getRatio(ratios, /dividend yield/i) || [])[0] || null,
    roce: (getRatio(ratios, /roce/i) || [])[0] || null,
    roe: (getRatio(ratios, /^roe/i) || [])[0] || null,
  };
}

// ─── Growth extractor — cadence-aware (quarterly vs half-yearly) ───
const MON = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
function monthIndex(label) {
  const m = String(label).trim().match(/^([A-Za-z]{3})/);
  if (!m) return null;
  return MON.indexOf(m[1].toLowerCase());
}
function periodKey(label) {
  const m = String(label).trim().match(/^([A-Za-z]{3})[a-z]*\s+(\d{4})$/);
  if (!m) return null;
  const mi = monthIndex(label);
  if (mi < 0) return null;
  return +m[2] * 12 + mi;
}

function extractGrowth(html) {
  const growth = {};
  const qSection = sliceSection(html, 'quarters');
  if (qSection) {
    const headerCols = extractTableHeaderCols(qSection);

    // Detect cadence from the gap between the last two columns
    let cadence = 3; // default quarterly
    if (headerCols.length >= 2) {
      const a = periodKey(headerCols[headerCols.length - 2]);
      const b = periodKey(headerCols[headerCols.length - 1]);
      if (a !== null && b !== null) {
        const gap = b - a;
        cadence = gap >= 5 ? 6 : 3;
      }
    }
    growth.cadenceMonths = cadence;
    growth.yoyStep = cadence === 6 ? 2 : 4; // columns back for YoY

    const salesRow   = findTableRowByLabel(qSection, /^(sales|revenue)\s*\+?$/i);
    const profitRow   = findTableRowByLabel(qSection, /^net\s*profit\s*\+?$/i)
                     || findTableRowByLabel(qSection, /^profit\s*after\s*tax\s*\+?$/i);
    const epsRow      = findTableRowByLabel(qSection, /^eps\s*in\s*rs\s*\+?$/i)
                     || findTableRowByLabel(qSection, /^eps\s*\+?$/i);

    const fill = (row, prefix) => {
      if (!row || row.length < 2) return;
      const n = row.length;
      growth[`${prefix}Latest`] = toNum(row[n - 1]);
      growth[`${prefix}Prev`]   = toNum(row[n - 2]);
      growth[`${prefix}QoQ`]    = pctChange(row[n - 1], row[n - 2]);
      const step = growth.yoyStep;
      if (n > step) {
        growth[`${prefix}YoYBase`] = toNum(row[n - 1 - step]);
        growth[`${prefix}YoY`]     = pctChange(row[n - 1], row[n - 1 - step]);
      }
    };
    fill(salesRow, 'sales');
    fill(profitRow, 'profit');
    fill(epsRow, 'eps');

    if (growth.profitLatest !== undefined) growth.profitQoQFlip = signFlip(growth.profitLatest, growth.profitPrev);
    if (growth.profitYoYBase !== undefined) growth.profitYoYFlip = signFlip(growth.profitLatest, growth.profitYoYBase);
    if (growth.epsLatest !== undefined) growth.epsQoQFlip = signFlip(growth.epsLatest, growth.epsPrev);
    if (growth.epsYoYBase !== undefined) growth.epsYoYFlip = signFlip(growth.epsLatest, growth.epsYoYBase);

    if (headerCols.length >= 1) growth.latestPeriod = headerCols[headerCols.length - 1];
    if (headerCols.length >= 2) growth.prevPeriod = headerCols[headerCols.length - 2];
  }

  // Annual fallback — skip the trailing "TTM" column
  const aSection = sliceSection(html, 'profit-loss');
  if (aSection) {
    let headerCols = extractTableHeaderCols(aSection);
    if (headerCols[headerCols.length - 1]?.toUpperCase() === 'TTM') {
      headerCols = headerCols.slice(0, -1);
    }
    growth.latestAnnualPeriod = headerCols[headerCols.length - 1] || null;
  }

  return growth;
}

function pctChange(currentStr, previousStr) {
  const c = toNum(currentStr), p = toNum(previousStr);
  if (c === null || p === null || p === 0) return null;
  return +(((c - p) / Math.abs(p)) * 100).toFixed(1);
}
function signFlip(current, previous) {
  if (current === null || previous === null) return null;
  if (previous > 0 && current < 0) return 'loss';
  if (previous < 0 && current > 0) return 'profit';
  return null;
}

// ─── Staleness — cadence-aware, amber at 1 period behind, red at 2+ ───
function periodEnd(label) {
  const m = String(label).trim().match(/^([A-Za-z]{3})[a-z]*\s+(\d{4})$/);
  if (!m) return null;
  const mi = monthIndex(label);
  if (mi < 0) return null;
  return new Date(+m[2], mi + 1, 0); // last day of that month
}
function computeStaleness(latestLabel, cadenceMonths, today = new Date()) {
  const end = periodEnd(latestLabel);
  if (!end) return null;
  let cursor = end, lag = 0;
  for (let i = 0; i < 20; i++) {
    const next = new Date(cursor.getFullYear(), cursor.getMonth() + cadenceMonths + 1, 0);
    const graceDays = cadenceMonths >= 6 ? 60 : (next.getMonth() === 2 ? 60 : 45);
    if (next.getTime() + graceDays * 86400000 <= today.getTime()) { lag++; cursor = next; }
    else break;
  }
  return { lag, status: lag === 0 ? 'ok' : lag === 1 ? 'amber' : 'red' };
}

// ─── Shareholding extractor ───
const SHARE_CATEGORIES = [
  { key: 'promoter', label: 'Promoters', test: (n) => /^promoters?$/i.test(n) },
  { key: 'fii', label: 'FIIs', test: (n) => /^fiis?$/i.test(n) || /^fii\s*\/\s*fpi/i.test(n) },
  { key: 'dii', label: 'DIIs', test: (n) => /^diis?$/i.test(n) },
  { key: 'govt', label: 'Government', test: (n) => /^government$/i.test(n) },
  { key: 'public', label: 'Public', test: (n) => /^public(\s*\/\s*retail)?$/i.test(n) },
];

function shareLabel(raw) {
  return String(raw || '').replace(/\+/g, '').replace(/\s+/g, ' ').trim();
}

function shareFromVals(label, vals) {
  const nums = (vals || []).map((v) => toNum(v));
  const present = nums.filter((n) => n !== null);
  if (present.length === 0) {
    return { label, latest: null, change1q: null, change4q: null, trend: [] };
  }
  const latest = nums[nums.length - 1];
  const prev = nums.length >= 2 ? nums[nums.length - 2] : null;
  const prev4q = nums.length >= 5 ? nums[nums.length - 5] : null;
  const trend = nums.filter((n) => n !== null).slice(-5);
  return {
    label,
    latest: latest === null ? null : +latest.toFixed(2),
    change1q: latest !== null && prev !== null ? +(latest - prev).toFixed(2) : null,
    change4q: latest !== null && prev4q !== null ? +(latest - prev4q).toFixed(2) : null,
    trend,
  };
}

function listShareRows(section) {
  const rows = [];
  for (const row of section.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const first = row[1].match(/<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/i);
    if (!first) continue;
    const label = shareLabel(stripTags(first[1]));
    if (!label || /shareholder/i.test(label)) continue;
    const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)];
    const data = /<th/i.test(first[0]) ? cells : cells.slice(1);
    const vals = data.map((td) => stripTags(td[1]).replace(/,/g, '').trim());
    if (!vals.some((v) => toNum(v) !== null || v === '-' || v === '—' || v === '')) continue;
    rows.push({ label, vals });
  }
  return rows;
}

function extractShareholding(html) {
  const sh = {};
  const section = sliceSection(html, 'shareholding');
  const found = section ? listShareRows(section) : [];
  const used = new Set();
  for (const cat of SHARE_CATEGORIES) {
    const idx = found.findIndex((row, i) => !used.has(i) && cat.test(row.label));
    if (idx >= 0) used.add(idx);
    sh[cat.key] = shareFromVals(cat.label, idx >= 0 ? found[idx].vals : []);
  }
  found.forEach((row, i) => {
    if (used.has(i)) return;
    if (SHARE_CATEGORIES.some((cat) => cat.test(row.label))) return;
    if (!row.vals.some((v) => toNum(v) !== null)) return;
    sh['extra:' + row.label] = shareFromVals(row.label, row.vals);
  });
  if (section) {
    const headerCols = extractTableHeaderCols(section);
    if (headerCols.length >= 2) sh._periods = headerCols.slice(-5);
  }
  return sh;
}


// ─── Peers ───
async function fetchPeers(warehouseId, selfTicker) {
  const url = `https://www.screener.in/api/company/${warehouseId}/peers/`;
  const res = await fetchWithTimeout(url, { headers: { 'X-Requested-With': 'XMLHttpRequest' } }, 6000);
  if (!res.ok) throw new Error(`Peers HTTP ${res.status}`);
  const html = await res.text();

  const rows = [];
  // Default Screener order: S.No., Company, CMP, P/E, Mar Cap
  let col = { cmp: 2, pe: 3, mcap: 4 };
  for (const tr of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const headers = [...tr[1].matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)].map(m => stripTags(m[1]));
    if (headers.length > 2) {
      const findCol = (re) => headers.findIndex(h => re.test(h));
      const cmp = findCol(/^cmp\b/i);
      const pe = findCol(/p\s*\/?\s*e/i);
      const mcap = findCol(/mar(?:ket)?\s*cap/i);
      if (cmp >= 0 && pe >= 0 && mcap >= 0) col = { cmp, pe, mcap };
      continue;
    }
    if (!/<td/i.test(tr[1])) continue;
    const link = tr[1].match(/<a[^>]*href="(\/company\/([^\/"]+)\/[^"]*)"[^>]*>([\s\S]*?)<\/a>/i);
    const cells = [...tr[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(m => stripTags(m[1]));
    const picked = [cells[col.cmp], cells[col.pe], cells[col.mcap]];

    if (!link) {
      rows.push({ isMedian: true, name: cells[1] || cells[0] || 'Median', cells: picked });
      continue;
    }

    rows.push({
      name: stripTags(link[3]),
      slug: decodeURIComponent(link[2]),
      cells: picked,
    });
  }

  // Only pull the (large) Kite instruments map if a numeric BSE slug exists
  const needsBse = rows.some(r => r.slug && /^\d+$/.test(r.slug));
  const byToken = needsBse ? ((await getBseLookup()).byToken || {}) : {};

  const selfUp = String(selfTicker || '').toUpperCase();
  return rows.map(r => {
    if (r.isMedian) return r;
    const symbol = /^\d+$/.test(r.slug)
      ? (byToken[r.slug] || null)
      : r.slug.replace(/[&\-]/g, '_');
    return {
      ...r,
      symbol,
      isSelf: r.slug.toUpperCase() === selfUp
        || (symbol && symbol.toUpperCase() === selfUp),
    };
  });
}

// ─── Shared HTML helpers ───
function sliceSection(html, id) {
  const start = html.indexOf(`id="${id}"`);
  if (start === -1) return null;
  let secStart = html.lastIndexOf('<section', start);
  if (secStart === -1) secStart = start;
  let depth = 1, pos = html.indexOf('>', start) + 1;
  while (depth > 0 && pos < html.length) {
    const nextOpen = html.indexOf('<section', pos);
    const nextClose = html.indexOf('</section>', pos);
    if (nextClose === -1) break;
    if (nextOpen !== -1 && nextOpen < nextClose) { depth++; pos = nextOpen + 1; }
    else { depth--; pos = nextClose + '</section>'.length; }
  }
  return html.slice(secStart, pos);
}
function extractTableHeaderCols(html) {
  const theadMatch = html.match(/<thead[^>]*>([\s\S]*?)<\/thead>/i);
  if (!theadMatch) return [];
  const cols = [...theadMatch[1].matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)].map(m => stripTags(m[1]).trim());
  if (cols.length > 0 && (cols[0] === '' || (/^[a-z\s]+$/i.test(cols[0]) && cols[0].length < 4))) {
    return cols.slice(1).filter(Boolean);
  }
  return cols.filter(Boolean);
}
function findTableRowByLabel(html, pattern) {
  for (const row of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const first = row[1].match(/<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/i);
    if (!first) continue;
    if (!pattern.test(stripTags(first[1]).trim())) continue;
    const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)];
    const data = /<th/i.test(first[0]) ? cells : cells.slice(1);
    return data.map(td => stripTags(td[1]).replace(/,/g, '').trim());
  }
  return null;
}
function extractListSection(html, cls, arr, max) {
  const start = html.indexOf(`class="${cls}"`);
  if (start === -1) return;
  const ulStart = html.indexOf('<ul', start);
  if (ulStart === -1) return;
  const ulEnd = html.indexOf('</ul>', ulStart);
  const block = html.slice(ulStart, ulEnd > -1 ? ulEnd : ulStart + 2000);
  for (const m of [...block.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]) {
    const text = stripTags(m[1]).trim();
    if (text.length > 5) { arr.push(text); if (arr.length >= max) break; }
  }
}
function splitByTag(html, tag) {
  const results = [], open = `<${tag}`, close = `</${tag}>`;
  let i = 0;
  while (i < html.length) {
    const s = html.indexOf(open, i); if (s === -1) break;
    const e = html.indexOf(close, s); if (e === -1) break;
    results.push(html.slice(s, e + close.length));
    i = e + close.length;
  }
  return results;
}
// Decodes decimal (&#39;) AND hex (&#x27;) entities — fixes the
// "Company&#x27;s" bug from the old parser.
function stripTags(str) {
  return String(str).replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(+dec))
    .replace(/\s+/g, ' ').trim();
}

// ─── Message handlers ───
export function startScreenerFundamentals() {
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'FETCH_SCREENER') {
      fetchScreenerData(msg.ticker, msg.consolidated, msg.forceRefresh, msg.exchange)
        .then(data => {
          const tiles = buildTiles(data.ratios);
          const staleness = data.growth?.latestPeriod
            ? computeStaleness(data.growth.latestPeriod, data.growth.cadenceMonths || 3)
            : null;
          sendResponse({ ok: true, data: { ...data, tiles, staleness }, cached: data._cached });
        })
        .catch(err => sendResponse({ ok: false, error: err.message }));
      return true; // async response
    }

    if (msg.type === 'FETCH_PEERS') {
      if (!msg.warehouseId) {
        sendResponse({ ok: false, error: 'No warehouse ID provided' });
        return;
      }
      (async () => {
        if (!msg.forceRefresh) {
          const cached = await readPeersCache(msg.warehouseId);
          if (cached) { sendResponse({ ok: true, peers: cached, cached: true }); return; }
        }
        const peers = await fetchPeers(msg.warehouseId, msg.ticker);
        writePeersCache(msg.warehouseId, peers);
        sendResponse({ ok: true, peers });
      })().catch(err => sendResponse({ ok: false, error: err.message }));
      return true;
    }
  });

  console.log('[Screener Fundamentals] module started');
}