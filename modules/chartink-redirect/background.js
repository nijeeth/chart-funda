/**
 * Chartink → TradingView Redirect Module
 * Style: Navigation intercept (Option 2)
 * - Watches tab URL changes
 * - If the URL is a Chartink stock page and the feature is enabled,
 *   redirects the tab to TradingView with NSE:SYMBOL
 */

import { get } from "../../shared/storage.js";

const CHARTINK_STOCKS_NEW = "/stocks-new";
const TRADINGVIEW_BASE = "https://in.tradingview.com/chart/?symbol=NSE:";

/**
 * Returns true if the given URL looks like a Chartink stock page.
 */
function isChartinkStockUrl(url) {
  if (!url || typeof url !== "string") return false;
  try {
    const u = new URL(url);
    if (!/(^|\.)chartink\.com$/.test(u.hostname)) return false;

    // Classic style: https://chartink.com/stocks/SYMBOL.html (query ignored)
    if (u.pathname.startsWith("/stocks/") && u.pathname.endsWith(".html")) {
      return true;
    }

    // Newer style: contains /stocks-new and has a symbol parameter
    if (u.pathname.includes(CHARTINK_STOCKS_NEW) && u.searchParams.has("symbol")) {
      return true;
    }
  } catch (e) {}
  return false;
}

/**
 * Extract the trading symbol from a Chartink stock URL.
 * Handles both classic and newer URL formats.
 * Returns null if extraction fails.
 */
function extractSymbol(url) {
  try {
    const u = new URL(url);
    // Classic: .../stocks/SYMBOL.html
    if (u.pathname.startsWith("/stocks/") && u.pathname.endsWith(".html")) {
      const symbol = decodeURIComponent(u.pathname.replace("/stocks/", "").replace(/\.html$/, "")).trim();
      return symbol || null;
    }

    // Newer: .../stocks-new?symbol=SYMBOL  (or other query params)
    if (u.pathname.includes(CHARTINK_STOCKS_NEW)) {
      const symbol = u.searchParams.get("symbol");
      return symbol ? symbol.trim() : null;
    }
  } catch (e) {
    console.warn("[ChartinkRedirect] Failed to extract symbol:", e);
  }
  return null;
}

/**
 * Build the TradingView URL for a given symbol (always NSE).
 */
function buildTradingViewUrl(symbol) {
  // TradingView spells '&' and '-' as '_' (M&M → M_M, BAJAJ-AUTO → BAJAJ_AUTO)
  const clean = symbol.replace(/^NSE:/i, "")
    .replace(/[&-]/g, "_")
    .replace(/[^A-Za-z0-9._]/g, "");
  return TRADINGVIEW_BASE + clean.toUpperCase();
}

/**
 * Main redirect handler.
 */
async function handleTabUpdate(tabId, url) {
  if (!isChartinkStockUrl(url)) return;

  const enabled = await get("chartinkRedirectEnabled");
  if (!enabled) return;

  const symbol = extractSymbol(url);
  if (!symbol) {
    console.warn("[ChartinkRedirect] Could not extract symbol from:", url);
    return;
  }

  const targetUrl = buildTradingViewUrl(symbol);

  // Avoid redirect loops (should never happen, but safe)
  if (url === targetUrl) return;

  try {
    await chrome.tabs.update(tabId, { url: targetUrl });
  } catch (e) {
    console.warn("[ChartinkRedirect] tabs.update failed:", e);
  }
}

/**
 * Start the module. Call this once from the main background script.
 */
export function startChartinkRedirect() {
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // We only care about URL changes
    if (changeInfo.url) {
      handleTabUpdate(tabId, changeInfo.url);
    }
  });

  console.log("[ChartinkRedirect] Module started");
}
