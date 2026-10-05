# Bugs

Known bugs in Chart Funda and their status.

## How this file works

Each entry is one line in this format:

```
- [area] Description — reported YYYY-MM-DD, affects vX.Y.Z
```

Statuses:

- **Open** — confirmed, not yet fixed.
- **In progress** — a fix is being worked on.
- **Fixed (awaiting release)** — fixed in source, will ship with the next Chrome Web Store release.

When a release ships, move fixed entries out of this file and into `CHANGELOG.md` under that version.

## Open

_No known open bugs._

## In progress

_None._

## Fixed (awaiting release)

Audit batch (from external review, commit 53abd3a):

- [screener] TradingView `_` tickers (M_M, BAJAJ_AUTO, J&KBANK…) 404'd on Screener and returned empty search — fundamentals failed entirely for several large-caps. Fixed: direct fetch tries `_`→`-` then `_`→`&` slug variants; empty `_` searches retry with `&`. Verified live: M_M→M&M, BAJAJ_AUTO→BAJAJ-AUTO resolve. — reported 2026-10-05, affects v1.0.0
- [screener] BSE peer symbols from Kite (e.g. `M&M`, `BAJAJ-AUTO`) weren't converted to TradingView `_` form — peer clicks could fail. Fixed: same `[&-]`→`_` normalization as NSE slugs. — reported 2026-10-05, affects v1.0.0
- [earnings] Cached `daysAway` was frozen for the 12h TTL — "Earnings Today" could stay stale a day. Fixed: recomputed from the cached date on every read. — reported 2026-10-05, affects v1.0.0
- [chartink] `M&M` was sanitized to `MM` (wrong symbol) and classic URLs with `?query` after `.html` never matched. Fixed: `&`/`-` map to `_`, pathname-based matching. — reported 2026-10-05, affects v1.0.0
- [tv-panel] Fundamentals + earnings + filings fetched on every symbol change even with the panel closed. Fixed: fetches defer until the panel is opened. — reported 2026-10-05, affects v1.0.0
- [tv-panel] CON/STD toggle race — a response from the older mode could paint after the toggle. Fixed: response is dropped when its mode no longer matches the current setting. — reported 2026-10-05, affects v1.0.0
- [tv-panel] Screener/Tijori links kept pointing at the previous stock after a non-equity classification. Fixed: link hrefs cleared on every ticker reset. — reported 2026-10-05, affects v1.0.0
- [tv-panel] `watchHistory` patched `history.pushState` in the isolated content-script world — it never observed TradingView's MAIN-world SPA navigations (dead code). Removed; bridge + title observer + 5s poll remain the change sources. — reported 2026-10-05, affects v1.0.0
- [tv-panel] `watchTitle` attached its MutationObserver twice (init + `load`). Fixed: attach is idempotent. — reported 2026-10-05, affects v1.0.0

Earlier fix pass:

- [screener] Companies whose `/consolidated/` page is a stub (e.g. MACPOWER — single pre-IPO quarter column, Dec 2021) passed the `topRatiosHaveNumbers` check and produced an almost-empty cached result. Fixed: the consolidated page is accepted only when it also has ≥2 quarter columns; otherwise falls back to standalone. — reported 2026-10-05, affects v1.0.0
- [tv-panel] Disabling the panel left the 5-second `verifyLiveSymbol` interval running; with the widget gone `panelEmpty` was always true, so `onTickerChanged` → `loadFundamentals` fired every tick — fetches kept running while the feature was "off". Fixed: `verifyLiveSymbol` returns early when no widget exists. — reported 2026-10-05, affects v1.0.0
- [screener] `isLikelyIndianTicker` rejected any ticker starting with `US`/`UK`/`EU` — false-rejected genuine Indian symbols (e.g. USHAMART). Fixed: exchange is now authoritative — only NSE/BSE pass when an exchange is known; the prefix heuristic is removed and the foreign-ticker blocklist is expanded. — reported 2026-10-05, affects v1.0.0
- [security] Scraped text was injected via `innerHTML` without escaping (pros/cons, peer names and `data-symbol`, sector labels, shareholding labels, tile values). Fixed: all scraped strings pass through `esc()`. — reported 2026-10-05, affects v1.0.0
- [screener] `fetchPeers` always called `getBseLookup`, triggering the multi-MB Kite instruments download once per 24h even with no numeric BSE slugs. Fixed: lookup only loads when a numeric slug exists. — reported 2026-10-05, affects v1.0.0
- [screener] Peers were not cached — refetched on every panel load. Fixed: 12h cache keyed by warehouse id, and the manual Refresh button now passes `forceRefresh` through. — reported 2026-10-05, affects v1.0.0
- [tv-panel] CON/STD toggle force-refreshed both Screener and Trendlyne, ignoring the valid per-mode cache. Fixed: toggle uses a normal cached load. — reported 2026-10-05, affects v1.0.0
- [earnings] A `null` result was cached for 12h — a transient Trendlyne miss stuck for half a day. Fixed: only real results are cached. — reported 2026-10-05, affects v1.0.0
- [screener] Search fallback silently used `results[0]` on slug mismatch — could show the wrong company. Fixed: slug comparison is normalized (`-`/`_`/`&` insensitive), single-result fallback only. — reported 2026-10-05, affects v1.0.0
- [tv-panel] `detectTheme` used `[class*="dark"]` on the whole document — could force dark on a light chart. Fixed: explicit theme classes first, computed background luminance as fallback. — reported 2026-10-05, affects v1.0.0
- [tv-panel] MCX and other non-NSE/BSE symbols classified as equity → wasted fetch then error. Fixed: any known non-NSE/BSE exchange short-circuits to "not Indian equity" (also resets a stale `currentExchange` when a prefix-free ticker is detected). — reported 2026-10-05, affects v1.0.0
- [cosmetic] CMP/P-E lost thousands separators (now `en-IN` grouped); removed dead `tvf_change_symbol` listener and the identical-branches sparkline ternary; refreshed stale file-header comments; removed duplicated HTML comment. — reported 2026-10-05, affects v1.0.0
- [repo] README linked `LICENSE` but the file was missing locally — restored from the GitHub repo when the folder was git-linked. — reported 2026-10-05, affects v1.0.0
- [privacy/docs] Dashboard loads `google.com/s2/favicons` — now disclosed in PRIVACY.md. — reported 2026-10-05, affects v1.0.0
- [compat] No `minimum_chrome_version` — `world: "MAIN"` needs Chrome 102+. Fixed: `"minimum_chrome_version": "102"` added. — reported 2026-10-05, affects v1.0.0

## Not bugs (checked, closed)

- [dashboard] "Feedback" button has no handler — intentional placeholder, per design.
- [tv-panel] Hyphenated tickers (e.g. BAJAJ-AUTO) — TradingView normalizes `-`/`&` to `_` in symbols (`BAJAJ_AUTO`, `M_M`), and `_` is accepted by the ticker regexes. Not a bug.
