// ─────────────────────────────────────────────────
//  filings/background.js
//  Fish RS Board feed (fish-rs-board.pages.dev):
//  NSE filings + Fish RS rank, filtered per ticker.
//
//  The JSON files carry a `generated_at` stamp — the same
//  "last fetched" time the site shows. The host supports
//  ETag/If-None-Match (304 = unchanged), so we can re-check
//  freshness per request without downloading ~5 MB.
//  Message type handled: FETCH_FILINGS
// ─────────────────────────────────────────────────

const FEED_BASE = 'https://fish-rs-board.pages.dev/data/';

// In-memory copy of the raw feeds — lives only as long as the
// service worker; never written to chrome.storage (files are big).
const feed = {
  news: { gen: null, etag: null, json: null, inflight: null },
  rs:   { gen: null, etag: null, json: null, inflight: null },
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

/** Persists {gen, etag}; tolerates the older plain-string stamp. */
function feedMeta(raw) {
  if (!raw) return { gen: null, etag: null };
  return typeof raw === 'string' ? { gen: raw, etag: null } : raw;
}

async function downloadFeed(kind, res) {
  if (!res) {
    res = await fetchWithTimeout(`${FEED_BASE}${kind}.json`, { headers: { Accept: 'application/json' } }, 25000);
  }
  if (!res.ok) throw new Error(`${kind}.json HTTP ${res.status}`);
  const json = await res.json();
  feed[kind].gen = json.generated_at || null;
  feed[kind].etag = res.headers.get('ETag') || null;
  feed[kind].json = json;
  storageSet({ [META_KEY[kind]]: { gen: feed[kind].gen, etag: feed[kind].etag } });
  return feed[kind];
}

/**
 * Returns { gen, json } for a feed. json is null when the server says the
 * file is unchanged (304 on If-None-Match) — the caller should serve its
 * per-ticker cache instead of re-downloading ~5 MB.
 */
async function getFeed(kind, forceRefresh) {
  if (feed[kind].inflight) return feed[kind].inflight;

  const promise = (async () => {
    if (forceRefresh) return downloadFeed(kind);
    const meta = feedMeta((await storageGet([META_KEY[kind]]))[META_KEY[kind]]);
    const etag = feed[kind].etag || meta.etag;
    if (etag) {
      try {
        const res = await fetchWithTimeout(
          `${FEED_BASE}${kind}.json`,
          { headers: { 'If-None-Match': etag, Accept: 'application/json' } },
          8000
        );
        if (res.status === 304) {
          feed[kind].gen = feed[kind].gen || meta.gen;
          feed[kind].etag = etag;
          if (feed[kind].json) return feed[kind]; // memory copy is current
          return { gen: feed[kind].gen, json: null }; // unchanged — serve ticker cache
        }
        if (res.ok) return downloadFeed(kind, res); // changed — body is already here
      } catch (e) {
        console.warn(`[Filings] ${kind} etag check failed:`, e.message);
        if (feed[kind].json) return feed[kind]; // serve memory rather than nothing
      }
    }
    if (feed[kind].json) return feed[kind]; // nothing to compare against
    return downloadFeed(kind);
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
  const out = [];
  for (const sess of json.sessions || []) {
    for (const r of sess.rows || []) {
      if (String(r[0]).toUpperCase() !== t) continue;
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
  const sess = (json.sessions || [])[0];
  if (!sess) return null;
  const row = (sess.rows || []).find((r) => String(r[0]).toUpperCase() === t);
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
  const f = await getFeed(kind, forceRefresh);
  if (f.json) {
    const data = extract(f.json, ticker);
    storageSet({ [TICKER_KEY[kind](ticker)]: { gen: f.gen, data } });
    return { gen: f.gen, data };
  }
  const cached = (await storageGet([TICKER_KEY[kind](ticker)]))[TICKER_KEY[kind](ticker)];
  // Serve only when the per-ticker cache was built from the current feed
  // generation — an older gen means the SW restarted and this is stale.
  if (cached && cached.gen === f.gen) return { gen: cached.gen, data: cached.data };
  const full = await downloadFeed(kind);
  const data = extract(full.json, ticker);
  storageSet({ [TICKER_KEY[kind](ticker)]: { gen: full.gen, data } });
  return { gen: full.gen, data };
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
