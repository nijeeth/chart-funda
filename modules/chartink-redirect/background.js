/**
 * Chartink → TradingView Redirect Module
 * Style: Navigation intercept (Option 2)
 * - Watches tab URL changes
 * - If the URL is a Chartink stock page and the feature is enabled,
 *   redirects the tab to TradingView with NSE:SYMBOL
 */

import { get } from "../../shared/storage.js";

const CHARTINK_STOCKS_PREFIX = "https://chartink.com/stocks/";
const CHARTINK_STOCKS_NEW = "/stocks-new";
const TRADINGVIEW_BASE = "https://in.tradingview.com/chart/?symbol=NSE:";

/**
 * Returns true if the given URL looks like a Chartink stock page.
 */
function isChartinkStockUrl(url) {
  if (!url || typeof url !== "string") return false;

  // Classic style: https://chartink.com/stocks/SYMBOL.html
  if (url.startsWith(CHARTINK_STOCKS_PREFIX) && url.endsWith(".html")) {
    return true;
  }

  // Newer style: contains /stocks-new and has a symbol parameter
  if (url.includes(CHARTINK_STOCKS_NEW) && url.includes("symbol=")) {
    return true;
  }

  return false;
}

/**
 * Extract the trading symbol from a Chartink stock URL.
 * Handles both classic and newer URL formats.
 * Returns null if extraction fails.
 */
function extractSymbol(url) {
  try {
    // Classic: .../stocks/SYMBOL.html
    if (url.startsWith(CHARTINK_STOCKS_PREFIX) && url.endsWith(".html")) {
      const symbol = url
        .replace(CHARTINK_STOCKS_PREFIX, "")
        .replace(".html", "")
        .trim();
      return symbol || null;
    }

    // Newer: .../stocks-new?symbol=SYMBOL  (or other query params)
    if (url.includes(CHARTINK_STOCKS_NEW)) {
      const urlObj = new URL(url);
      const symbol = urlObj.searchParams.get("symbol");
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
  // Clean any accidental prefixes or special chars that Chartink sometimes adds
  const clean = symbol.replace(/^NSE:/i, "").replace(/[^A-Za-z0-9._-]/g, "");
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
