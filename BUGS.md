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

- [tv-panel] Disabling the panel leaves the 5-second `verifyLiveSymbol` interval running; with the widget gone `panelEmpty` is always true, so `onTickerChanged` → `loadFundamentals` fires every tick — fetches keep running while the feature is "off". — reported 2026-10-05, affects v1.0.0
- [screener] `isLikelyIndianTicker` rejects any ticker starting with `US`/`UK`/`EU` — false-rejects genuine Indian symbols (e.g. USHAMART, EUREKAFORB). — reported 2026-10-05, affects v1.0.0
- [dashboard] "Feedback" button in the footer has no click handler — does nothing. — reported 2026-10-05, affects v1.0.0
- [tv-panel] Ticker regexes exclude `-` (`cleanTicker` allows only `[A-Z0-9&_.]`); a hyphenated symbol like BAJAJ-AUTO is truncated to "BAJAJ" by the title regex, risking wrong-company data. Verify TradingView's actual symbol spelling (it may use `BAJAJ_AUTO`). — reported 2026-10-05, affects v1.0.0
- [security] Scraped text is injected via `innerHTML` without escaping (pros/cons, peer names and `data-symbol`, sector labels, shareholding labels). Entities are decoded by `stripTags`, so a `<` in source data becomes live markup on the TradingView page. — reported 2026-10-05, affects v1.0.0
- [screener] `fetchPeers` always calls `getBseLookup`, triggering the multi-MB Kite instruments download once per 24h even when the peer list has no numeric BSE slugs. — reported 2026-10-05, affects v1.0.0
- [screener] Peers are not cached — a peers API fetch happens on every panel load and ticker switch. — reported 2026-10-05, affects v1.0.0
- [tv-panel] CON/STD toggle calls `loadFundamentals(ticker, true)` — force-refreshes Screener AND Trendlyne, ignoring the valid per-mode cache. — reported 2026-10-05, affects v1.0.0
- [earnings] `writeCache` stores a null result for 12h — a transient "no data" sticks for half a day. — reported 2026-10-05, affects v1.0.0
- [screener] Search fallback silently uses `results[0]` when no URL slug matches the ticker — can show the wrong company's page. — reported 2026-10-05, affects v1.0.0
- [tv-panel] `detectTheme` uses `[class*="dark"]` on the whole document — any element with "dark" in a class name forces dark theme on a light chart. — reported 2026-10-05, affects v1.0.0
- [tv-panel] MCX (and other commodity) symbols pass classification as equity (MCX is in `EXCHANGES` but not `NON_INDIAN_EXCHANGES`) → wasted fetch, then an error. — reported 2026-10-05, affects v1.0.0
- [cosmetic] `plainNumber` strips thousands separators from CMP/P-E (mcap gets `toLocaleString`, CMP doesn't); `change4q` is computed but never rendered; sparkline stroke ternary returns `currentColor` on both branches; header comment still says "Step 3a: skeleton only"; dead `tvf_change_symbol` listener in page-bridge; `companyName` fetched but the header shows the ticker. — reported 2026-10-05, affects v1.0.0
- [repo] README links `LICENSE` but no LICENSE file exists in the repo. — reported 2026-10-05, affects v1.0.0
- [privacy/docs] Dashboard loads `google.com/s2/favicons` images — an unlisted external request; check the store listing / privacy wording still covers it. — reported 2026-10-05, affects v1.0.0
- [compat] No `minimum_chrome_version` in the manifest — `world: "MAIN"` needs Chrome 102+; on older versions peer-click symbol switching silently fails. — reported 2026-10-05, affects v1.0.0

## In progress

_None._

## Fixed (awaiting release)

_None._
