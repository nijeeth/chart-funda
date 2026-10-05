/**
 * Main service worker.
 * Starts all modules independently. Each module's *own startup logic*
 * is isolated with try/catch, so a runtime error inside one module
 * (a bad API call, an unexpected value, etc.) is caught and logged
 * without stopping the others.
 *
 * Note: this does NOT protect against a missing or syntactically broken
 * module file — that's a hard platform limitation of ES module service
 * workers (both static `import` and dynamic `import()` fail the entire
 * worker in that case, with no way to catch it from inside the worker).
 * All module files must exist and be valid JS for the worker to start.
 */

import { startChartinkRedirect } from "../modules/chartink-redirect/background.js";
import { startScreenerFundamentals } from "../modules/screener-fundamentals/background.js";
import { startEarningsCalendar } from "../modules/earnings-calendar/background.js";
import { startFilings } from "../modules/filings/background.js";

function startModule(label, startFn) {
  try {
    startFn();
    console.log(`[Background] ${label} module started`);
  } catch (e) {
    console.error(`[Background] ${label} module FAILED to start:`, e);
  }
}

startModule("Chartink Redirect", startChartinkRedirect);
startModule("Screener Fundamentals", startScreenerFundamentals);
startModule("Earnings Calendar", startEarningsCalendar);
startModule("Filings", startFilings);

function openDashboard() {
  chrome.tabs.create({
    url: chrome.runtime.getURL("modules/dashboard/index.html")
  });
}

chrome.action.onClicked.addListener(() => {
  try {
    openDashboard();
  } catch (e) {
    console.error("[Background] Dashboard FAILED to open:", e);
  }
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type !== "OPEN_DASHBOARD") return;
  try {
    openDashboard();
  } catch (e) {
    console.error("[Background] Dashboard FAILED to open:", e);
  }
});

console.log("[Background] Service worker ready");