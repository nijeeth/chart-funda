// ─────────────────────────────────────────────────
//  filings/background.js
//  Fish RS Board feed (fish-rs-board.pages.dev):
//  NSE filings + Fish RS rank, filtered per ticker.
//
//  The JSON files carry a `generated_at` stamp — the same
//  "last fetched" time the site shows. The host doesn't expose
//  ETag to extension fetches (no Access-Control-Expose-Headers),
//  so we simply refresh the in-memory copy at most every few
//  minutes — Chrome's HTTP cache keeps re-downloads cheap.
//  Message type handled: FETCH_FILINGS
// ─────────────────────────────────────────────────

const FEED_BASE = 'https://fish-rs-board.pages.dev/data/';
const FEED_REFRESH_MS = 10 * 60 * 1000; // re-download at most every 10 min

// In-memory copy of the raw feeds — lives only as long as the
// service worker; never written to chrome.storage (files are big).
const feed = {
  news: { gen: null, json: null, fetchedAt: 0, inflight: null },
  rs:   { gen: null, json: null, fetchedAt: 0, inflight: null },
};

const META_KEY = { news: 'fb_news_gen', rs: 'fb_rs_gen' };
const TICKER_KEY = { news: (t) => `fb_filings:${t}`, rs: (t) => `fb_rs:${t}` };

function storageGet(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}
function storageSet(obj) {
  chrome.storage.local.set(obj, () => {});
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (e) {
    clearTimeout(timer);
    if (e.name === 'AbortError') throw new Error('Feed request timed out');
    throw e;
  }
}

async function downloadFeed(kind) {
  const res = await fetchWithTimeout(`${FEED_BASE}${kind}.json`, { headers: { Accept: 'application/json' } }, 25000);
  if (!res.ok) throw new Error(`${kind}.json HTTP ${res.status}`);
  const json = await res.json();
  feed[kind].gen = json.generated_at || null;
  feed[kind].json = json;
  feed[kind].fetchedAt = Date.now();
  storageSet({ [META_KEY[kind]]: { gen: feed[kind].gen } });
  return feed[kind];
}

/**
 * Returns { gen, json } for a feed, re-downloading at most every
 * FEED_REFRESH_MS. On failure falls back to the stale in-memory copy.
 */
async function getFeed(kind, forceRefresh) {
  if (feed[kind].inflight) return feed[kind].inflight;

  const promise = (async () => {
    const age = Date.now() - feed[kind].fetchedAt;
    if (!forceRefresh && feed[kind].json && age < FEED_REFRESH_MS) return feed[kind];
    try {
      return await downloadFeed(kind);
    } catch (e) {
      if (feed[kind].json) return feed[kind]; // serve stale memory rather than nothing
      throw e;
    }
  })();

  feed[kind].inflight = promise;
  try {
    return await promise;
  } finally {
    feed[kind].inflight = null;
  }
}

// ─── Per-ticker extraction ───

/** news row: [symbol, subject, description, pdfUrl, "DD-Mon-YYYY HH:MM:SS", cls, label] */
function filingsForTicker(json, ticker) {
  const t = String(ticker || '').toUpperCase();
  // The feed uses the exchange spelling (BAJAJ-AUTO) where TV uses '_'
  const tAlt = t.replace(/_/g, '-');
  const out = [];
  for (const sess of json.sessions || []) {
    for (const r of sess.rows || []) {
      const sym = String(r[0]).toUpperCase();
      if (sym !== t && sym !== tAlt) continue;
      out.push({
        date: sess.date || null,
        ts: r[4] || null,
        subject: r[1] || '',
        desc: r[2] || '',
        pdf: r[3] || null,
        cls: r[5] || '',
        label: r[6] || '',
      });
    }
  }
  return out;
}

/** rs row: [sym, name, msRS, fishRS, close, …, cat(15), msTrend(16), fishTrend(17)] */
function rsForTicker(json, ticker) {
  const t = String(ticker || '').toUpperCase();
  const tAlt = t.replace(/_/g, '-'); // feed uses the exchange spelling
  const sess = (json.sessions || [])[0];
  if (!sess) return null;
  const row = (sess.rows || []).find((r) => {
    const sym = String(r[0]).toUpperCase();
    return sym === t || sym === tAlt;
  });
  if (!row) return null;
  const num = (v) => (v === null || v === undefined || isNaN(+v) ? null : +(+v).toFixed(1));
  const trend = (Array.isArray(row[17]) ? row[17] : []).map(num);
  return {
    rank: num(row[3]),
    msRank: num(row[2]),
    // fishTrend: [1W ago, 1M ago, 3M ago, 6M ago]
    w1: trend[0] ?? null,
    m1: trend[1] ?? null,
    m3: trend[2] ?? null,
    m6: trend[3] ?? null,
  };
}

async function serveFeed(kind, ticker, forceRefresh, extract) {
  try {
    const f = await getFeed(kind, forceRefresh);
    const data = extract(f.json, ticker);
    storageSet({ [TICKER_KEY[kind](ticker)]: { gen: f.gen, data } });
    return { gen: f.gen, data };
  } catch (e) {
    // Feed unreachable — last-resort: the stored copy from a previous day
    const cached = (await storageGet([TICKER_KEY[kind](ticker)]))[TICKER_KEY[kind](ticker)];
    if (cached) return { gen: cached.gen, data: cached.data };
    throw e;
  }
}

async function fetchFilingsBundle(ticker, exchange, forceRefresh) {
  const ex = String(exchange || '').toUpperCase();
  if (ex === 'BSE') {
    return { nseOnly: true, newsGen: null, filings: [], rsGen: null, rs: null };
  }
  const [newsRes, rsRes] = await Promise.allSettled([
    serveFeed('news', ticker, forceRefresh, filingsForTicker),
    serveFeed('rs', ticker, forceRefresh, rsForTicker),
  ]);
  return {
    nseOnly: false,
    newsGen: newsRes.status === 'fulfilled' ? newsRes.value.gen : null,
    filings: newsRes.status === 'fulfilled' ? newsRes.value.data : [],
    rsGen: rsRes.status === 'fulfilled' ? rsRes.value.gen : null,
    rs: rsRes.status === 'fulfilled' ? rsRes.value.data : null,
  };
}

export function startFilings() {
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type !== 'FETCH_FILINGS') return;

    (async () => {
      const ticker = String(msg.ticker || '').trim();
      if (!ticker) {
        sendResponse({ ok: false, error: 'No ticker' });
        return;
      }
      try {
        const data = await fetchFilingsBundle(ticker, msg.exchange, !!msg.forceRefresh);
        sendResponse({ ok: true, data });
      } catch (err) {
        sendResponse({ ok: false, error: err.message });
      }
    })();

    return true;
  });

  console.log('[Filings] module started');
}
