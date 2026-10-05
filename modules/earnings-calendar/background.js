/**
 * Trendlyne earnings-date fetch module.
 * Message type handled: FETCH_EARNINGS
 *
 * Flow: stock search → company page (follows redirects) → board-meeting
 * page → nearest results date. Cached ~12h under its own storage key.
 */

const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const SEARCH_URL = 'https://trendlyne.com/member/api/ac_snames/stock/?term=';

const MONTHS = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function cacheKey(ticker) {
  return `earnings_cache:${ticker.toUpperCase()}`;
}

function readCache(ticker) {
  return new Promise((resolve) => {
    const key = cacheKey(ticker);
    chrome.storage.local.get([key], (data) => {
      const entry = data[key];
      if (!entry || Date.now() - entry.ts > CACHE_TTL_MS) return resolve(null);
      resolve(entry);
    });
  });
}

function writeCache(ticker, data) {
  const key = cacheKey(ticker);
  chrome.storage.local.set({ [key]: { ts: Date.now(), data } }, () => {});
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

function stripTags(str) {
  return String(str).replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(+dec))
    .replace(/\s+/g, ' ').trim();
}

function istDayUtc(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date).split('-').map(Number);
  return Date.UTC(parts[0], parts[1] - 1, parts[2]);
}

function parseDisplayDate(str) {
  const m = String(str).match(/(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})/);
  if (!m) return null;
  const month = MONTHS[m[2].toLowerCase()];
  if (month == null) return null;
  return Date.UTC(+m[3], month, +m[1]);
}

/**
 * Indian results month → the quarter being reported, plus the FY ending that March.
 * Jul 2026 (Apr–Jun results) is Q1 FY2027.
 */
function quarterLabel(utcMs) {
  const date = new Date(utcMs);
  const month = date.getUTCMonth();
  const year = date.getUTCFullYear();
  if (month >= 6 && month <= 8) return `Q1 FY${year + 1}`;
  if (month >= 9) return `Q2 FY${year + 1}`;
  if (month <= 2) return `Q3 FY${year}`;
  return `Q4 FY${year}`;
}

function isExactStock(row, ticker) {
  const t = ticker.toUpperCase();
  return [row.NSEcode, row.stock_code, row.id, row.UIcode]
    .some((v) => String(v || '').toUpperCase() === t);
}

/**
 * Nearest results-purpose board meeting relative to `now`.
 * Returns { daysAway, quarter, date, purpose } or null.
 */
export function nearestResultMeeting(html, now = new Date()) {
  const today = istDayUtc(now);
  const meetings = [];

  for (const row of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((td) => stripTags(td[1]));
    const dateCell = cells.find((c) => /\d{1,2}\s+[A-Za-z]{3}\s+\d{4}/.test(c));
    const purpose = cells.find((c) => /result/i.test(c));
    if (!dateCell || !purpose) continue;
    const utc = parseDisplayDate(dateCell);
    if (utc == null) continue;
    meetings.push({ utc, purpose, date: dateCell.match(/\d{1,2}\s+[A-Za-z]{3}\s+\d{4}/)[0] });
  }

  if (meetings.length === 0) {
    const sentence = stripTags(html).match(
      /board meeting[\s\S]{0,80}?(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})[\s\S]{0,80}?purpose of\s+([^.<]+)/i
    );
    if (sentence && /result/i.test(sentence[2])) {
      const utc = parseDisplayDate(sentence[1]);
      if (utc != null) meetings.push({ utc, purpose: sentence[2].trim(), date: sentence[1] });
    }
  }

  let best = null;
  for (const meeting of meetings) {
    const daysAway = Math.round((meeting.utc - today) / 86400000);
    const abs = Math.abs(daysAway);
    if (!best || abs < best.abs || (abs === best.abs && daysAway > best.daysAway)) {
      best = {
        abs,
        daysAway,
        quarter: quarterLabel(meeting.utc),
        date: meeting.date,
        purpose: meeting.purpose,
      };
    }
  }
  if (!best) return null;
  return {
    daysAway: best.daysAway,
    quarter: best.quarter,
    date: best.date,
    purpose: best.purpose,
  };
}

function findBoardMeetingUrl(html) {
  const m = html.match(/href="([^"]*\/equity\/board-meeting\/[^"]+)"/i);
  if (!m) return null;
  const href = m[1].replace(/&amp;/g, '&');
  if (href.startsWith('http')) return href;
  return `https://trendlyne.com${href.startsWith('/') ? href : `/${href}`}`;
}

async function fetchEarnings(ticker) {
  const searchRes = await fetchWithTimeout(
    `${SEARCH_URL}${encodeURIComponent(ticker)}`,
    { headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' } },
    6000
  );
  if (!searchRes.ok) throw new Error(`Trendlyne search HTTP ${searchRes.status}`);
  const results = await searchRes.json();
  if (!Array.isArray(results) || results.length === 0) return null;

  const match = results.find((row) => isExactStock(row, ticker));
  const companyUrl = match && (match.nexturl || (match.urls && match.urls[0] && match.urls[0][1]));
  if (!companyUrl) return null;

  const companyRes = await fetchWithTimeout(companyUrl, { headers: { Accept: 'text/html' } }, 8000);
  if (!companyRes.ok) throw new Error(`Trendlyne company HTTP ${companyRes.status}`);
  const boardUrl = findBoardMeetingUrl(await companyRes.text());
  if (!boardUrl) return { url: companyUrl };

  const boardRes = await fetchWithTimeout(boardUrl, { headers: { Accept: 'text/html' } }, 8000);
  if (!boardRes.ok) throw new Error(`Trendlyne board-meeting HTTP ${boardRes.status}`);
  const meeting = nearestResultMeeting(await boardRes.text());
  return { ...(meeting || {}), url: companyUrl };
}

export function startEarningsCalendar() {
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type !== 'FETCH_EARNINGS') return;

    (async () => {
      const ticker = String(msg.ticker || '').trim();
      if (!ticker) {
        sendResponse({ ok: false, error: 'No ticker' });
        return;
      }
      if (!msg.forceRefresh) {
        const cached = await readCache(ticker);
        if (cached) {
          sendResponse({ ok: true, data: cached.data, cached: true });
          return;
        }
      }
      try {
        const data = await fetchEarnings(ticker);
        if (data) writeCache(ticker, data); // don't pin a "no data" for 12h
        sendResponse({ ok: true, data, cached: false });
      } catch (err) {
        sendResponse({ ok: false, error: err.message });
      }
    })();

    return true;
  });

  console.log('[Earnings Calendar] module started');
}
