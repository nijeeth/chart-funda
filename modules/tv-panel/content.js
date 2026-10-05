// ─────────────────────────────────────────────────
//  tv-panel/content.js
//  Ticker detection, pill, panel shell, and the
//  fundamentals / ownership-peers renderers.
// ─────────────────────────────────────────────────
(function () {
  "use strict";

  const EXCHANGES = ["NSE", "BSE", "MCX", "NASDAQ", "NYSE", "LSE", "AMEX", "CBOE"];
  const INDIAN_EXCHANGES = new Set(["NSE", "BSE"]);
  const INDEX_NAMES = new Set([
    "NIFTY", "NIFTY50", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY", "NIFTYNXT50",
    "SENSEX", "BANKEX", "INDIAVIX", "CNXAUTO", "CNXIT", "CNXPHARMA", "CNXFMCG",
    "CNXMETAL", "CNXREALTY", "CNXENERGY", "CNXINFRA", "NIFTYIT", "NIFTYBANK",
  ]);
  let currentExchange = null;

  // ─── Ticker detection (unchanged approach from the old extension) ───
  function cleanTicker(raw) {
    if (!raw) return null;
    const up = raw.toUpperCase().trim();
    const m = up.match(new RegExp(`^(${EXCHANGES.join("|")})[:\\-](.+)$`));
    const exchange = m ? m[1] : null;
    const ticker = m ? m[2] : up;
    currentExchange = exchange; // cleared when no prefix — never let a stale exchange linger
    if (!ticker || ticker.length < 2 || ticker.length > 20) return null;
    if (EXCHANGES.includes(ticker)) return null;
    if (!/^[A-Z0-9&_.]{2,20}$/.test(ticker)) return null;
    return ticker;
  }

  function tickerFromTitle() {
    const title = document.title || "";
    const m1 = title.match(/\b([A-Z]{2,6}:[A-Z0-9&_]{2,20})\b/i);
    if (m1) return cleanTicker(m1[1]);
    const m2 = title.match(/^([A-Z0-9&_]{2,20})\s*[—\-|]/i);
    if (m2) return cleanTicker(m2[1]);
    return null;
  }

  function tickerFromURL() {
    try {
      const sym = new URLSearchParams(window.location.search).get("symbol");
      if (sym) return cleanTicker(sym);
    } catch (_) {}
    return null;
  }

  function detectTicker() {
    return tickerFromURL() || tickerFromTitle();
  }

  function isIndianTicker(ticker, exchange) {
    if (exchange && !INDIAN_EXCHANGES.has(exchange.toUpperCase())) return false;
    if (!ticker) return false;
    if (ticker.includes(".")) return false;
    return true;
  }

  function classifyTicker(ticker, exchange) {
    if (!isIndianTicker(ticker, exchange)) return 'other';
    if (INDEX_NAMES.has(ticker.toUpperCase())) return 'other';
    if (/\d{2}(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)/i.test(ticker)) return 'other';
    if (/(CE|PE|FUT)$/i.test(ticker) && /\d/.test(ticker)) return 'other';
    return 'equity';
  }

  function classificationMessage(kind) {
    return kind === 'equity' ? null : 'Not an Indian equity stock — Fundamentals not available.';
  }





  // ─── State ───
  let currentTicker = null;
  let panelOpen = false;
  let activeTab = "fundamentals";
  let tvTheme = "dark";
  let lastManualSwitchAt = 0;
  let clickOutsideOn = true;
  let earningsVisible = false;

  function detectTheme() {
    const root = document.documentElement;
    let isDark;
    if (root.classList.contains("theme-dark") || document.body.classList.contains("theme-dark")) {
      isDark = true;
    } else if (root.classList.contains("theme-light") || document.body.classList.contains("theme-light")) {
      isDark = false;
    } else {
      // No explicit theme class — judge by the page's actual background color.
      const m = getComputedStyle(document.body).backgroundColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      isDark = m ? (0.299 * m[1] + 0.587 * m[2] + 0.114 * m[3]) < 128 : true;
    }
    tvTheme = isDark ? "dark" : "light";
    const widget = document.getElementById("tvf-widget");
    if (widget) widget.setAttribute("data-theme", tvTheme);
  }

  // ─── Widget shell ───
  function buildWidget(pillMode) {
    const existing = document.getElementById("tvf-widget");
    if (existing) return existing;

    const widget = document.createElement("div");
    widget.id = "tvf-widget";
    widget.setAttribute("data-theme", tvTheme);
    widget.innerHTML = `
      <div class="tvf-pill" id="tvf-pill" title="TV Funda">
        <span class="tvf-pill-logo-wrap" id="tvf-pill-logo-wrap">
          <span class="tvf-pill-avatar" id="tvf-pill-avatar">–</span>
        </span>
        <span class="tvf-pill-ticker" id="tvf-pill-ticker">–</span>
      </div>
      
      <div class="tvf-panel" id="tvf-panel">
        <div class="tvf-header">
          <div class="tvf-header-text">
            <div class="tvf-company-name" id="tvf-company-name">Loading…</div>
            <div class="tvf-sector" id="tvf-sector"></div>
          </div>
          <div class="tvf-header-actions">
            <button class="tvf-icon-btn" id="tvf-theme-btn" title="Toggle theme"></button>
            <button class="tvf-icon-btn tvf-cons-btn" id="tvf-cons-btn" title="Consolidated / Standalone">CON</button>
            <button class="tvf-icon-btn" id="tvf-close-btn" title="Close">✕</button>
          </div>
        </div>
        <div class="tvf-header-row2">
          <button class="tvf-refresh-btn" id="tvf-refresh-btn" type="button" title="Refresh data">↻ Refresh</button>
        </div>

        <div class="tvf-tabs">
          <button class="tvf-tab tvf-tab-active" data-tab="fundamentals">Fundamentals</button>
          <button class="tvf-tab" data-tab="ownership-peers">Ownership &amp; Peers</button>
          <button class="tvf-tab" data-tab="filings">Filings</button>
        </div>

        <div class="tvf-status-bar" id="tvf-status-bar"></div>
        <div class="tvf-earnings-banner" id="tvf-earnings-banner" style="display:none"></div>
        <div class="tvf-feed-status" id="tvf-feed-status" style="display:none">
          <span id="tvf-feed-rs"></span>
          <span id="tvf-feed-news"></span>
        </div>

        <div class="tvf-scroll-area">
          <div class="tvf-loading" id="tvf-loading" style="display:none">Loading…</div>
          <div class="tvf-error" id="tvf-error" style="display:none"></div>
          <div class="tvf-tab-content" id="tvf-tab-fundamentals">
            <div class="tvf-tiles" id="tvf-tiles"></div>
            <div class="tvf-growth" id="tvf-growth"></div>
            <div class="tvf-proscons" id="tvf-proscons"></div>
          </div>
          <div class="tvf-tab-content" id="tvf-tab-ownership-peers" style="display:none">
            <div class="tvf-shareholding" id="tvf-shareholding"></div>
            <div class="tvf-peers-heading">Peers</div>
            <div class="tvf-peers" id="tvf-peers"></div>
          </div>
          <div class="tvf-tab-content" id="tvf-tab-filings" style="display:none">
            <div class="tvf-filings-loading" id="tvf-filings-loading" style="display:none">Loading…</div>
            <div class="tvf-rs-block" id="tvf-rs-block"></div>
            <div class="tvf-filings-heading">NSE Filings</div>
            <div class="tvf-filings-list" id="tvf-filings-list"></div>
          </div>
        </div>

        <div class="tvf-links-row">
          <a class="tvf-link-btn tvf-link-screener" id="tvf-screener-link" href="#" target="_blank"><img class="tvf-site-logo" alt="" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAMAAABEpIrGAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAD8UExURQAAAAAAABwzAjJcBgAAADtpCCA6BUxpcSxPBgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEh+CU2NCQAAAAAAAAAAAAAAAAAAAAAAAAADAAAAAAAAAAAAAEqBChAZAD5wCD9yCDZeCAAAABsxBAAAAB42BC1RBhwyBAAAAB0zBBguAgAAACtLBgAAAEF0CE6LCzxqCEB2CU6NBxgtAh01BBguAk+RCh01BB01BAkRABsvBBouAjdjCCI8ByNAAxguAgAAAAAAABkvAgAAAB00AgMDADprBzxuCjBXBjNeBh0zBS1SCCZDBSE6BXfWEWS4C3HJEKRIwWwAAABRdFJOUyUGboUBhW4AegwjDQskAgUUHAMHUW5bGllQHzVRWiAITx9CQWRJjCqKd4pYg4tKdxt5XIQ4aX6LimuMgh58aoEmV4wKVodAa1hyM4SCaD5fbXpZ2K0AAAAJcEhZcwAAAVIAAAFSAYQb4Q0AAAEBSURBVDjL7c63TsRAFIXhaxhgPcH22GBvsL05J3LOOcf3fxdGc4W0SJeCgo6/OsVXHFiiYqHYbDYazXsRAgk8sf5mexYkYL5eQ/CiaeDwDQSv/AcACwgW4XeAfUUD5vmOzfciEniyXls21eqySgHmJ60PW2tVksDhfQR95dIACggK8A3MXCfB7HUSyMOtFdPeqblOguTs3XZnrpOA3yB4NNdJAHMI5uEf/DHgxwgewFVTBFPlqhMETxz0ZHt3fD6+uuUyT0eDTmcwSvOLPD3o7e/0jiYaRLc9zOLs8jqpBpVSMY6LpUrg2JkN210BodDcPOGJDKOgrABUOYg8nFyL8BMxT5Tt3oU24wAAAFd6VFh0UmF3IHByb2ZpbGUgdHlwZSBpcHRjAAB4nOPyDAhxVigoyk/LzEnlUgADIwsuYwsTIxNLkxQDEyBEgDTDZAMjs1Qgy9jUyMTMxBzEB8uASKBKLgDqFxF08kI1lQAAAABJRU5ErkJggg==" />Screener<span class="tvf-ext">↗</span></a>
          <a class="tvf-link-btn tvf-link-tijori" id="tvf-tijori-link" href="#" target="_blank"><img class="tvf-site-logo" alt="" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAB2klEQVR4nO2bvUoDQRRGv9mZjUEjgjZ5AW0EW23F9HY2+iLaiI8i6APYC7YWCmJnYy0KgiZGs9mda+E2wR+4SuYTvadM5pKTwzKTIgMY/xunHZAz5FUv33I+m8UQMg4pNTmcVPH+6nZ4uLiBQjMatJ9VPjb2Qhvb6AvQ1E6PCQdg0mEhNuaBYkczqg4gUZbRdSi72snxEqraTUmmHohu8Ese/FGkdlOiDvDXsADqCS8N/dmRAIc3NyX6TdC7c0xjLXzn2SmAso/PD18BwiQA9dcAMAXIszvXjqkDBCl2493ENUppx4hKMVo6F1d8M1uvPtmqfBOonuOR9LNTjVuWwaPvboIM9hU+AL7xQ+gnyEljEy0clA8fvx9mAPSw5VaLw1ROSTfBCGl9eYRKvSYhdgqwBdhYALYAGwvAFmBjAdgCbCwAW4CNBWALsLEAbAE2FoAtwMYCsAXYWAC2ABsLwBZgYwHYAmwsAFuAjQVgC7CxAGwBNhaALcDGArAF2FgAtgAbC8AWYGMB2AJsLABbgI0FYAuwsQBsATapA+TwwId/mRcAvl6TEPWNkZ+Q5XKBwiHMAe/umngAg3pNQpJffxoeNzthWpbi0+jr2RRQdt1l3nk5Tu1k/GdeASbzbT5QHK9EAAAAAElFTkSuQmCC" />Tijori<span class="tvf-ext">↗</span></a>
          <a class="tvf-link-btn tvf-link-trendlyne" id="tvf-trendlyne-link" href="#" target="_blank" rel="noopener noreferrer" style="display:none">Trendlyne<span class="tvf-ext">↗</span></a>
        </div>
        <button class="tvf-credit" id="tvf-credit" type="button"><span class="tvf-credit-name">NijeethFish</span><span class="tvf-credit-sep">|</span><span class="tvf-credit-brand">Chart Funda v2.0</span></button>
      </div>
      
    `;

    if (pillMode !== "compact") widget.classList.add("tvf-classic");
    document.body.appendChild(widget);
    bindShellEvents(widget);
    return widget;
  }

  function bindShellEvents(widget) {
    widget.querySelector("#tvf-pill").addEventListener("click", togglePanel);
    widget.querySelector("#tvf-close-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      closePanel();
    });

    widget.querySelector("#tvf-refresh-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      if (currentTicker) {
        loadFundamentals(currentTicker, true);
        requestFilings(currentTicker, true);
      }
    });

    widget.querySelector("#tvf-theme-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      const next = tvTheme === "dark" ? "light" : "dark";
      tvTheme = next;
      widget.setAttribute("data-theme", next);
      syncThemeButton(widget);
      chrome.storage.local.set({ themeOverride: next });
    });

    const consBtn = widget.querySelector("#tvf-cons-btn");
    chrome.storage.local.get(["consolidated"], (data) => {
      const consolidated = data.consolidated !== false; // default true (CON)
      consBtn.textContent = consolidated ? "CON" : "STD";
    });
    consBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      chrome.storage.local.get(["consolidated"], (data) => {
        const next = !(data.consolidated !== false);
        chrome.storage.local.set({ consolidated: next });
        consBtn.textContent = next ? "CON" : "STD";
        if (currentTicker) loadFundamentals(currentTicker, false); // per-mode cache can serve this
      });
    });

    widget.querySelectorAll(".tvf-tab").forEach((tab) => {
      tab.addEventListener("click", () => switchTab(tab.dataset.tab));
    });

    // Restore saved theme
    chrome.storage.local.get(["themeOverride"], (data) => {
      if (data.themeOverride) {
        tvTheme = data.themeOverride;
        widget.setAttribute("data-theme", tvTheme);
      }
      syncThemeButton(widget);
    });

    widget.querySelector("#tvf-credit").addEventListener("click", (e) => {
      e.stopPropagation();
      chrome.runtime.sendMessage({ type: "OPEN_DASHBOARD" });
    });

    widget.querySelector("#tvf-pill").addEventListener("dblclick", (e) => {
      e.stopPropagation();
      widget.classList.toggle("tvf-classic");
      const mode = widget.classList.contains("tvf-classic") ? "classic" : "compact";
      chrome.storage.local.set({ pillMode: mode });
    });


  }

  function togglePanel() {
    panelOpen ? closePanel() : openPanel();
  }
  function openPanel() {
    panelOpen = true;
    document.getElementById("tvf-panel").classList.add("tvf-panel-open");
    verifyLiveSymbol();
  }
  function closePanel() {
    panelOpen = false;
    document.getElementById("tvf-panel").classList.remove("tvf-panel-open");
  }

  function switchTab(tab) {
    activeTab = tab;
    document.querySelectorAll(".tvf-tab").forEach((t) =>
      t.classList.toggle("tvf-tab-active", t.dataset.tab === tab)
    );
    document.querySelectorAll(".tvf-tab-content").forEach((c) => (c.style.display = "none"));
    const content = document.getElementById(`tvf-tab-${tab}`);
    if (content) content.style.display = "block";
    // Status rows are per-tab: Screener freshness + earnings belong to the
    // fundamentals tabs; the filings tab shows its own feed timestamps.
    const feedMode = tab === "filings";
    const sb = document.getElementById("tvf-status-bar");
    const eb = document.getElementById("tvf-earnings-banner");
    const fs = document.getElementById("tvf-feed-status");
    if (sb) sb.style.display = feedMode ? "none" : "";
    if (eb) eb.style.display = feedMode ? "none" : (earningsVisible ? "flex" : "none");
    if (fs) fs.style.display = feedMode ? "flex" : "none";
  }


  // ─── Ticker change handling ───

  function syncThemeButton(widget) {
    const btn = widget.querySelector("#tvf-theme-btn");
    if (!btn) return;
    const toLight = tvTheme === "dark";
    btn.textContent = toLight ? "Light" : "Dark";
    btn.classList.toggle("tvf-theme-light", toLight);
    btn.classList.toggle("tvf-theme-dark", !toLight);
  }

  function clearPanelContents() {
    for (const id of ["tvf-tiles", "tvf-growth", "tvf-proscons", "tvf-shareholding", "tvf-peers", "tvf-sector", "tvf-status-bar", "tvf-rs-block", "tvf-filings-list"]) {
      const el = document.getElementById(id);
      if (el) el.innerHTML = "";
    }
    renderEarningsBanner(null);
    setFeedStatus(null, null);
    const tl = document.getElementById('tvf-trendlyne-link');
    if (tl) { tl.style.display = 'none'; tl.removeAttribute('href'); }
    const fl = document.getElementById('tvf-filings-loading');
    if (fl) fl.style.display = 'none';
  }

  function onTickerChanged(ticker) {
    currentTicker = ticker;
    const pillTicker = document.getElementById("tvf-pill-ticker");
    const pillAvatar = document.getElementById("tvf-pill-avatar");
    const companyName = document.getElementById("tvf-company-name");
    if (pillTicker) pillTicker.textContent = ticker || "–";
    if (pillAvatar) pillAvatar.textContent = ticker ? ticker[0] : "–";
    if (!ticker) return;

    clearPanelContents();
    const kind = classifyTicker(ticker, currentExchange);
    const msg = classificationMessage(kind);
    if (msg) {
      switchTab("fundamentals");
      if (companyName) companyName.textContent = ticker;
      showError(msg);
      const fl = document.getElementById('tvf-filings-list');
      if (fl) fl.innerHTML = '<div class="tvf-placeholder">Not an Indian equity — filings not available.</div>';
      return;
    }

    if (companyName) companyName.textContent = ticker;
    loadFundamentals(ticker, false);
    requestFilings(ticker, false);
  }


  function onMaybeChanged() {
    // Skip title/URL-based detection for a short window after we
    // manually switched the chart ourselves (e.g. clicking a peer) —
    // TradingView's own title update lags slightly behind the internal
    // API call, so polling too eagerly here would revert the panel
    // back to the old ticker before the title catches up.
    if (Date.now() - lastManualSwitchAt < 2500) return;

    const ticker = detectTicker();
    if (ticker && ticker !== currentTicker) onTickerChanged(ticker);
  }

  function watchTitle() {
    let debounceTimer = null;
    const debouncedVerify = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(verifyLiveSymbol, 300);
    };
    const attach = () => {
      const el = document.querySelector("title");
      if (el) new MutationObserver(debouncedVerify).observe(el, { childList: true, characterData: true, subtree: true });
    };
    attach();
    window.addEventListener("load", attach);
  }

  function watchHistory() {
    const wrap = (fn) => function (...args) { fn.apply(this, args); setTimeout(verifyLiveSymbol, 300); };
    history.pushState = wrap(history.pushState.bind(history));
    history.replaceState = wrap(history.replaceState.bind(history));
    window.addEventListener("popstate", () => setTimeout(verifyLiveSymbol, 300));
  }

  function watchVisibility() {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') verifyLiveSymbol();
  });
}


function fmtBannerDate(d) {
  return String(d || '').trim().replace(/\s+/g, '-'); // "01 Oct 2026" → "01-Oct-2026"
}

function renderEarningsBanner(earnings) {
  const el = document.getElementById('tvf-earnings-banner');
  if (!el) return;
  if (!earnings || earnings.daysAway === undefined) { earningsVisible = false; if (activeTab !== 'filings') el.style.display = 'none'; return; }
  const { daysAway, quarter } = earnings;
  const dateStr = fmtBannerDate(earnings.date);
  const near = Math.abs(daysAway) <= 10;
  let text, cls;
  if (daysAway === 0) { text = `Earnings Today · ${quarter}`; cls = 'tvf-earnings-today'; }
  else if (daysAway > 0) { text = `Earnings: ${dateStr} (in ${daysAway}d) · ${quarter}`; cls = near ? 'tvf-earnings-near' : 'tvf-earnings-upcoming'; }
  else { text = `Earnings released: ${dateStr} (${Math.abs(daysAway)}d ago) · ${quarter}`; cls = near ? 'tvf-earnings-near' : 'tvf-earnings-past'; }
  el.className = `tvf-earnings-banner ${cls}`;
  el.textContent = text;
  earningsVisible = true;
  if (activeTab !== 'filings') el.style.display = 'flex';
}

function quarterEndingLabel(period) {
  const months = {
    jan: 'January', feb: 'February', mar: 'March', apr: 'April',
    may: 'May', jun: 'June', jul: 'July', aug: 'August',
    sep: 'September', oct: 'October', nov: 'November', dec: 'December',
  };
  const raw = String(period || '–');
  return raw.replace(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*/ig, (m) => months[m.slice(0, 3).toLowerCase()] || m);
}

function renderStatusBar(cached, staleness, growth, standaloneFallback) {
  const el = document.getElementById('tvf-status-bar');
  if (!el) return;
  const liveText = cached ? 'Cached' : 'Live';
  const status = staleness?.status || 'ok';
  const latestQ = growth?.latestPeriod || '–';
  const sourceNote = standaloneFallback ? ' · standalone' : '';
  el.className = `tvf-status-bar tvf-status-${status}`;
  el.innerHTML = `
    <span class="tvf-status-dot ${cached ? 'tvf-dot-cached' : 'tvf-dot-live'}"></span>
    <span class="tvf-status-label">${liveText}</span>
    <span class="tvf-status-date">data fetched from Q ending ${esc(quarterEndingLabel(latestQ))}${sourceNote}</span>
  `;
}

function renderSector(sector) {
  const el = document.getElementById('tvf-sector');
  if (!el) return;
  if (!sector || sector.length === 0) { el.innerHTML = ''; return; }
  el.innerHTML = sector.map((s, i) =>
    `<a href="https://www.screener.in${esc(s.href)}" target="_blank" class="${i === sector.length - 1 ? 'tvf-sector-last' : ''}">${esc(s.label)}</a>`
  ).join(' <span class="tvf-sector-sep">›</span> ');
}

// Escape scraped strings before they go into innerHTML — source HTML
// entities are decoded by the parser, so raw < or & can become live markup.
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

const TILE_DEFS = [
  { key: 'currentPrice', label: 'Price', fmt: (v) => v != null ? `₹${Number(v).toLocaleString('en-IN')}` : '–' },
  { key: 'marketCap',    label: 'Mkt Cap', fmt: (v) => v || '–' },
  { key: 'pe',           label: 'P/E',            fmt: (v) => v || '–' },
  { key: 'pb',           label: 'P/B',            fmt: (v) => v != null ? v.toFixed(2) : '–' },
  { key: 'high52w',      label: '52W High',       fmt: (v) => v != null ? String(v) : '–' },
  { key: 'low52w',       label: '52W Low',        fmt: (v) => v != null ? String(v) : '–' },
  { key: 'dividendYield',label: 'Div Yield',      fmt: (v) => v != null ? `${v}%` : '–' },
  { key: 'roce',         label: 'ROCE',           fmt: (v) => v != null ? `${v}%` : '–' },
  { key: 'roe',          label: 'ROE',            fmt: (v) => v != null ? `${v}%` : '–' },
];

function renderTiles(tiles) {
  const el = document.getElementById('tvf-tiles');
  if (!el || !tiles) return;
  el.innerHTML = TILE_DEFS.map((t) => {
    let sub = '';
    if (t.key === 'high52w' && tiles.currentPrice && tiles.high52w) {
      const pct = ((tiles.currentPrice - tiles.high52w) / tiles.high52w) * 100;
      sub = `<div class="tvf-tile-sub tvf-down">▼ ${Math.abs(pct).toFixed(1)}%</div>`;
    }
    if (t.key === 'low52w' && tiles.currentPrice && tiles.low52w) {
      const pct = ((tiles.currentPrice - tiles.low52w) / tiles.low52w) * 100;
      sub = pct < 0.5
        ? `<div class="tvf-tile-sub tvf-note-up">▲ at low</div>`
        : `<div class="tvf-tile-sub tvf-up">▲ ${pct.toFixed(1)}%</div>`;
    }
    return `<div class="tvf-tile"><div class="tvf-tile-label">${t.label}</div><div class="tvf-tile-val">${esc(t.fmt(tiles[t.key]))}</div>${sub}</div>`;
  }).join('');
}

function fmtAbs(n) {
  const text = Number(n).toLocaleString('en-IN');
  return n < 0 ? `<span class="tvf-down">${text}</span>` : text;
}

function growthCard(pct, base, latest, flip) {
  if ((pct === null || pct === undefined) && !flip) return '<div class="tvf-growth-cell tvf-growth-empty">–</div>';
  let pctHtml = '';
  if (pct !== null && pct !== undefined) {
    const arrow = pct > 0 ? '▲' : pct < 0 ? '▼' : '–';
    const cls = pct > 0 ? 'tvf-up' : pct < 0 ? 'tvf-down' : '';
    pctHtml = `<span class="tvf-growth-pct ${cls}"><span class="tvf-growth-arrow">${arrow}</span> ${pct > 0 ? '+' : ''}${pct}%</span>`;
  }
  const flipHtml = flip === 'loss'
    ? '<span class="tvf-flip-loss">Turned Loss</span>'
    : flip === 'profit'
      ? '<span class="tvf-flip-profit">Turned Profit</span>'
      : '';
  const valLine = (base != null && latest != null)
    ? `<div class="tvf-growth-sub">${fmtAbs(base)} → ${fmtAbs(latest)}</div>`
    : '';
  return `<div class="tvf-growth-cell">${pctHtml}${valLine}${flipHtml}</div>`;
}

function renderGrowth(growth) {
  const el = document.getElementById('tvf-growth');
  if (!el || !growth) return;
  const short = growth.cadenceMonths === 6 ? 'HoH' : 'QoQ';
  el.innerHTML = `
    <div class="tvf-growth-heading">Growth</div>
    <div class="tvf-growth-grid">
      <div></div><div class="tvf-growth-colhead">${short}</div><div class="tvf-growth-colhead">YoY</div>
      <div class="tvf-growth-rowlabel">Revenue</div>${growthCard(growth.salesQoQ, growth.salesPrev, growth.salesLatest)}${growthCard(growth.salesYoY, growth.salesYoYBase, growth.salesLatest)}
      <div class="tvf-growth-rowlabel">Profit</div>${growthCard(growth.profitQoQ, growth.profitPrev, growth.profitLatest, growth.profitQoQFlip)}${growthCard(growth.profitYoY, growth.profitYoYBase, growth.profitLatest, growth.profitYoYFlip)}
      <div class="tvf-growth-rowlabel">EPS</div>${growthCard(growth.epsQoQ, growth.epsPrev, growth.epsLatest, growth.epsQoQFlip)}${growthCard(growth.epsYoY, growth.epsYoYBase, growth.epsLatest, growth.epsYoYFlip)}
    </div>
  `;
}

function renderProsCons(pros, cons) {
  const el = document.getElementById('tvf-proscons');
  if (!el) return;
  if ((!pros || pros.length === 0) && (!cons || cons.length === 0)) { el.innerHTML = ''; return; }
  let html = '';
  if (pros && pros.length) {
    html += '<div class="tvf-pros-heading">Strengths</div><div class="tvf-proscons-grid">' +
      pros.map(p => `<div class="tvf-pro-item">${esc(p)}</div>`).join('') + '</div>';
  }
  if (cons && cons.length) {
    html += '<div class="tvf-cons-heading">Concerns</div><div class="tvf-proscons-grid">' +
      cons.map(c => `<div class="tvf-con-item">${esc(c)}</div>`).join('') + '</div>';
  }
  el.innerHTML = html;
}



function tijoriSlug(companyName) {
  if (!companyName) return null;
  return companyName
    .trim()
    .replace(/\bLtd\.?\b/gi, "Limited")
    .replace(/[^a-zA-Z0-9\s]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}



function renderFundamentalsTab(ticker, data, companyName) {
  renderSector(data.sector);
  renderStatusBar(data._cached, data.staleness, data.growth, data.standaloneFallback);
  renderTiles(data.tiles);
  renderGrowth(data.growth);
  renderProsCons(data.pros, data.cons);

  const screenerLink = document.getElementById('tvf-screener-link');
  const tijoriLink = document.getElementById('tvf-tijori-link');
  const screenerSlug = data.screenerSlug || ticker;
  if (screenerLink) screenerLink.href = `https://www.screener.in/company/${encodeURIComponent(screenerSlug)}/`;

  if (tijoriLink) {
    const named = (data.info && data.info.name) || companyName;
    const slug = named && String(named).toUpperCase() !== String(ticker).toUpperCase()
      ? tijoriSlug(named)
      : null;
    tijoriLink.href = slug
      ? `https://www.tijorifinance.com/company/${slug}/`
      : `https://www.tijorifinance.com/search?q=${encodeURIComponent(ticker)}`;
  }
}


function sparklinePath(vals) {
  if (!vals || vals.length < 2) return '';
  const min = Math.min(...vals), max = Math.max(...vals);
  const range = max - min || 1;
  const W = 48, H = 16;
  const pts = vals.map((v, i) => {
    const x = (i / (vals.length - 1)) * W;
    const y = H - ((v - min) / range) * H;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const up = vals[vals.length - 1] >= vals[vals.length - 2];
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="1.5" class="${up ? 'tvf-up' : 'tvf-down'}"/></svg>`;
}

const SHARE_ROWS = [
  ['promoter', 'Promoters'],
  ['fii', 'FIIs'],
  ['dii', 'DIIs'],
  ['govt', 'Government'],
  ['public', 'Public'],
];

function shareLine(row) {
  const chg = row.change1q;
  const chgHtml = chg == null
    ? '–'
    : chg === 0
      ? '0'
      : `<span class="${chg > 0 ? 'tvf-up' : 'tvf-down'}">${chg > 0 ? '▲' : '▼'} ${Math.abs(chg).toFixed(2)}%</span>`;
  const latestHtml = row.latest == null ? '–' : `${row.latest}%`;
  return `<div class="tvf-share-row">
    <span class="tvf-share-label">${esc(row.label)}</span>
    <span class="tvf-share-pct">${latestHtml}</span>
    <span class="tvf-share-qoq">${chgHtml}</span>
    <span class="tvf-share-spark">${sparklinePath(row.trend)}</span>
  </div>`;
}

function renderShareholding(shareholding) {
  const el = document.getElementById('tvf-shareholding');
  if (!el) return;
  const data = shareholding || {};
  const fixed = SHARE_ROWS.map(([key, label]) => data[key] && data[key].label
    ? { ...data[key], label }
    : { label, latest: null, change1q: null, trend: [] });
  const fixedNames = new Set(SHARE_ROWS.map(([, label]) => label.toLowerCase()));
  const extras = Object.entries(data)
    .filter(([key, row]) => row && row.label && key !== '_periods' && !SHARE_ROWS.some(([id]) => id === key) && !fixedNames.has(String(row.label).toLowerCase()))
    .map(([, row]) => row);
  el.innerHTML = '<div class="tvf-shareholding-heading">Shareholding</div>' +
    `<div class="tvf-share-row tvf-share-header"><span class="tvf-share-label"></span><span class="tvf-share-pct">Current</span><span class="tvf-share-qoq">QoQ</span><span class="tvf-share-spark"></span></div>` +
    fixed.concat(extras).map(shareLine).join('');
}

function cellOrDash(raw) {
  const s = String(raw ?? '').trim();
  if (!s || s === '-' || s === '—') return '–';
  return s;
}

function plainNumber(raw) {
  const s = cellOrDash(raw);
  if (s === '–') return s;
  const n = parseFloat(s.replace(/,/g, ''));
  if (!Number.isFinite(n)) return s;
  return n.toLocaleString('en-IN');
}

function marketCapInteger(raw) {
  const s = String(raw ?? '').trim();
  if (!s || s === '-' || s === '—') return '–';
  const n = parseFloat(s.replace(/,/g, ''));
  if (!Number.isFinite(n)) return s;
  return Math.round(n).toLocaleString('en-IN');
}

function renderPeers(peers) {
  const el = document.getElementById('tvf-peers');
  if (!el) return;
  if (!peers || peers.length === 0) {
    el.innerHTML = '<div class="tvf-placeholder">No peer data</div>';
    return;
  }
  const header = '<div class="tvf-peer-row tvf-peer-header"><span>Company</span><span>CMP</span><span>P/E</span><span>Mkt Cap</span></div>';
  const peerCells = (cells) => {
    const cmp = esc(plainNumber(cells[0]));
    const pe = esc(plainNumber(cells[1]));
    const mcap = esc(marketCapInteger(cells[2]));
    return `<span>${cmp}</span><span>${pe}</span><span>${mcap}</span>`;
  };
  el.innerHTML = header + peers.map((p) => {
    const nums = (p.cells || []).slice(0, 3);
    if (p.isMedian) {
      return `<div class="tvf-peer-row tvf-peer-median"><span>${esc(p.name)}</span>${peerCells(nums)}</div>`;
    }
    if (!p.symbol) {
      return `<div class="tvf-peer-row"><span class="tvf-peer-name">${esc(p.name)}</span>${peerCells(nums)}</div>`;
    }
    const selfCls = p.isSelf ? ' tvf-peer-self' : '';
    return `<div class="tvf-peer-row tvf-peer-clickable${selfCls}" data-symbol="${esc(p.symbol)}">
      <span class="tvf-peer-name">${esc(p.name)}</span>
      ${peerCells(nums)}
    </div>`;
  }).join('');

  el.querySelectorAll('.tvf-peer-clickable').forEach((row) => {
    row.addEventListener('click', () => {
      const symbol = row.dataset.symbol;
      if (!symbol) return;
      openChartPreferNse(symbol).then((opened) => {
        if (!opened || !opened.ok) return;
        lastManualSwitchAt = Date.now();
        currentExchange = opened.exchange;
        onTickerChanged(opened.ticker);
      });
    });
  });

  
}

function renderOwnershipPeersTab(data) {
  renderShareholding(data.shareholding);
  renderPeers(data.peers);
}

// ─── Filings tab (Fish RS Board feed) ───

function setFeedStatus(rsGen, newsGen) {
  const rsEl = document.getElementById('tvf-feed-rs');
  const newsEl = document.getElementById('tvf-feed-news');
  if (rsEl) rsEl.textContent = rsGen ? `Fish Rank Updated: ${rsGen}` : '';
  if (newsEl) newsEl.textContent = newsGen ? `NSE Filings fetched: ${newsGen}` : '';
}

function renderRsBlock(rs, nseOnly) {
  const el = document.getElementById('tvf-rs-block');
  if (!el) return;
  if (nseOnly) { el.innerHTML = ''; return; }
  if (!rs || rs.rank == null) {
    el.innerHTML = '<div class="tvf-rs-empty">Not in RS universe</div>';
    return;
  }
  const colored = (v) => v == null ? '–' : `<span class="${v >= 95 ? 'tvf-up' : 'tvf-down'}">${v}</span>`;
  el.innerHTML = `
    <div class="tvf-rs-head">Custom Fish RS Rank <span class="tvf-rs-exp">(Experimental)</span></div>
    <div class="tvf-rs-vals">
      <span class="tvf-rs-rank">${colored(rs.rank)}</span>
      <span class="tvf-rs-delta">1W&nbsp;${colored(rs.w1)}</span>
      <span class="tvf-rs-delta">1M&nbsp;${colored(rs.m1)}</span>
      <span class="tvf-rs-delta">3M&nbsp;${colored(rs.m3)}</span>
    </div>`;
}

function fmtFilingTime(ts) {
  // "04-Oct-2026 14:54:27" → "04-Oct 14:54"
  const m = String(ts || '').match(/(\d{1,2})-([A-Za-z]{3})-\d{4}\s+(\d{1,2}:\d{2})/);
  return m ? `${m[1]}-${m[2]} ${m[3]}` : String(ts || '');
}

function renderFilings(filings, nseOnly) {
  const el = document.getElementById('tvf-filings-list');
  if (!el) return;
  if (nseOnly) {
    el.innerHTML = '<div class="tvf-placeholder">NSE filings only — this is a BSE symbol.</div>';
    return;
  }
  if (!filings || filings.length === 0) {
    el.innerHTML = '<div class="tvf-placeholder">No recent filings.</div>';
    return;
  }
  el.innerHTML = filings.map((f) => {
    const chip = f.label ? `<span class="tvf-chip tvf-chip-${esc(f.cls)}">${esc(f.label)}</span>` : '';
    const inner = `
      <div class="tvf-filing-top"><span class="tvf-filing-when">${esc(fmtFilingTime(f.ts))}</span>${chip}</div>
      <div class="tvf-filing-desc">${esc(f.desc)}</div>`;
    return f.pdf
      ? `<a class="tvf-filing-card" href="${esc(f.pdf)}" target="_blank" rel="noopener noreferrer">${inner}</a>`
      : `<div class="tvf-filing-card tvf-filing-nolink">${inner}</div>`;
  }).join('');
}

function requestFilings(ticker, forceRefresh) {
  const loadEl = document.getElementById('tvf-filings-loading');
  const listEl = document.getElementById('tvf-filings-list');
  const rsEl = document.getElementById('tvf-rs-block');
  if (loadEl) loadEl.style.display = 'block';
  if (listEl) listEl.innerHTML = '';
  if (rsEl) rsEl.innerHTML = '';
  setFeedStatus(null, null);
  chrome.runtime.sendMessage(
    { type: 'FETCH_FILINGS', ticker, exchange: currentExchange, forceRefresh: !!forceRefresh },
    (response) => {
      if (ticker !== currentTicker) return;
      if (loadEl) loadEl.style.display = 'none';
      if (chrome.runtime.lastError || !response || !response.ok) {
        if (listEl) listEl.innerHTML = '<div class="tvf-placeholder">Could not load filings.</div>';
        return;
      }
      const d = response.data || {};
      setFeedStatus(d.rsGen, d.newsGen);
      renderRsBlock(d.rs, d.nseOnly);
      renderFilings(d.filings, d.nseOnly);
    }
  );
}

function showLoading(show) {
  const l = document.getElementById('tvf-loading');
  const e = document.getElementById('tvf-error');
  if (l) l.style.display = show ? 'flex' : 'none';
  if (show && e) e.style.display = 'none';
}

function showError(msg) {
  const l = document.getElementById('tvf-loading');
  const e = document.getElementById('tvf-error');
  if (l) l.style.display = 'none';
  if (e) { e.textContent = msg; e.style.display = 'flex'; }
}

function requestEarnings(ticker, forceRefresh) {
  chrome.runtime.sendMessage(
    { type: 'FETCH_EARNINGS', ticker, forceRefresh: !!forceRefresh },
    (response) => {
      if (ticker !== currentTicker) return;
      const tl = document.getElementById('tvf-trendlyne-link');
      if (chrome.runtime.lastError || !response || !response.ok) {
        renderEarningsBanner(null);
        if (tl) { tl.style.display = 'none'; tl.removeAttribute('href'); }
        return;
      }
      renderEarningsBanner(response.data);
      const url = response.data && response.data.url;
      if (tl) {
        if (url) { tl.href = url; tl.style.display = ''; }
        else { tl.style.display = 'none'; tl.removeAttribute('href'); }
      }
    }
  );
}

function loadFundamentals(ticker, forceRefresh) {
  requestEarnings(ticker, forceRefresh);
  chrome.storage.local.get(['consolidated'], (data) => {
    const consolidated = data.consolidated !== false;
    showLoading(true);
    chrome.runtime.sendMessage(
      { type: 'FETCH_SCREENER', ticker, exchange: currentExchange, consolidated, forceRefresh: !!forceRefresh },
      (response) => {
        if (ticker !== currentTicker) return;
        showLoading(false);
        if (chrome.runtime.lastError || !response) {
          showError('Extension error — try reloading the tab.');
          return;
        }
        if (!response.ok) {
          showError(response.error || 'Could not load fundamentals.');
          return;
        }
        const el = document.getElementById('tvf-error');
        if (el) el.style.display = 'none';

        const companyName = response.data.info?.name || ticker;
        const nameEl = document.getElementById('tvf-company-name');
        if (nameEl) nameEl.textContent = ticker;

        renderFundamentalsTab(ticker, response.data, companyName);

        if (response.data.warehouseId) {
          chrome.runtime.sendMessage(
            { type: 'FETCH_PEERS', warehouseId: response.data.warehouseId, ticker, forceRefresh: !!forceRefresh },
            (peerResp) => {
              if (ticker !== currentTicker) return;
              if (peerResp && peerResp.ok) {
                renderOwnershipPeersTab({ shareholding: response.data.shareholding, peers: peerResp.peers });
              } else {
                renderOwnershipPeersTab({ shareholding: response.data.shareholding, peers: [] });
              }
            }
          );
        } else {
          renderOwnershipPeersTab({ shareholding: response.data.shareholding, peers: [] });
        }
      }
    );
  });
}



/**
 * Asks the page-bridge for TradingView's own authoritative current symbol.
 * This is the real source of truth — title/URL can be stale after any
 * soft navigation, ours or someone else's. Falls back to null if the
 * bridge doesn't respond in time (e.g. TradingViewApi genuinely
 * unavailable on this page).
 */
function openChartPreferNse(symbol, timeoutMs = 2800) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (detail) => {
      if (done) return;
      done = true;
      document.removeEventListener('tvf_open_chart_result', onReply);
      resolve(detail);
    };
    const onReply = (e) => finish(e.detail || { ok: false });
    document.addEventListener('tvf_open_chart_result', onReply);
    document.dispatchEvent(new CustomEvent('tvf_open_chart', { detail: { symbol } }));
    setTimeout(() => finish({ ok: false }), timeoutMs);
  });
}

function requestLiveSymbol(timeoutMs = 1000) {
  return new Promise((resolve) => {
    let done = false;
    const onReply = (e) => {
      if (done) return;
      done = true;
      document.removeEventListener('tvf_symbol_response', onReply);
      resolve(e.detail && e.detail.ticker ? e.detail : null);
    };
    document.addEventListener('tvf_symbol_response', onReply);
    document.dispatchEvent(new CustomEvent('tvf_request_symbol'));
    setTimeout(() => {
      if (done) return;
      done = true;
      document.removeEventListener('tvf_symbol_response', onReply);
      resolve(null);
    }, timeoutMs);
  });
}

/**
 * Verifies the panel matches whatever TradingView is actually showing
 * right now, correcting for any change we didn't cause ourselves
 * (another tool, a backgrounded tab resuming, etc.). Falls back to
 * title/URL detection if the bridge gives no answer.
 */
async function verifyLiveSymbol() {
  if (!document.getElementById("tvf-widget")) return; // panel disabled — don't poll or fetch
  const live = await requestLiveSymbol();
  const nameEl = document.getElementById("tvf-company-name");
  const panelEmpty = !nameEl || nameEl.textContent === "Loading…";
  if (live && live.ticker) {
    if (live.exchange) currentExchange = live.exchange;
    if (panelEmpty || live.ticker !== currentTicker) {
      lastManualSwitchAt = Date.now(); // avoid the title-poll racing this update
      onTickerChanged(live.ticker);
    }
  } else if (panelEmpty) {
    const ticker = detectTicker();
    if (ticker) onTickerChanged(ticker);
  } else {
    onMaybeChanged(); // bridge unavailable — fall back to the old method
  }
}




  // ─── Init ───
  let started = false;
  let initPending = false;

  function init() {
    if (initPending) return;
    initPending = true;
    chrome.storage.local.get(["pillMode", "themeOverride", "tvPanelEnabled", "clickOutsideMinimize"], (data) => {
      initPending = false;
      clickOutsideOn = data.clickOutsideMinimize !== false;
      if (data.tvPanelEnabled === false) return;
      try {
        detectTheme();
        if (data.themeOverride) tvTheme = data.themeOverride;
        const already = document.getElementById("tvf-widget");
        const widget = buildWidget(data.pillMode);
        if (data.themeOverride && widget) widget.setAttribute("data-theme", tvTheme);
        if (!already) currentTicker = null;
        if (!started) {
          started = true;
          watchTitle();
          watchHistory();
          watchVisibility();
          document.addEventListener("pointerdown", (e) => {
            if (!clickOutsideOn || !panelOpen) return;
            const w = document.getElementById("tvf-widget");
            if (w && !w.contains(e.target)) closePanel();
          }, true);
          setInterval(verifyLiveSymbol, 5000);
        }
        verifyLiveSymbol();
        console.log("[TV Panel] initialized");
      } catch (e) {
        console.error("[TV Panel] FAILED to initialize:", e);
      }
    });
  }

  function boot() {
    init();
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;
      if (changes.clickOutsideMinimize) {
        clickOutsideOn = changes.clickOutsideMinimize.newValue !== false;
      }
      if (!changes.tvPanelEnabled) return;
      if (changes.tvPanelEnabled.newValue === false) {
        document.getElementById("tvf-widget")?.remove();
        currentTicker = null;
      } else {
        currentTicker = null;
        init();
      }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();