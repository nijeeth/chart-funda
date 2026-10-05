# Changelog

Updates to Chart Funda. Newest release first.

The format follows [Keep a Changelog](https://keepachangelog.com/). Each release is a version from `manifest.json`.

## [2.0.0] - 2026-10-05

### Added

- **Corp. Filings tab** — a third panel tab with the stock's recent NSE corporate filings: timestamp, colored subject chip (orders, results, resignations, M&A, insider trades…) and full description; each card links to the official NSE archive PDF.
- **Custom Fish RS Rank (Experimental)** — block at the top of the Filings tab with the current rank plus 1W/1M/3M/6M history, and a small circular rank chip in the panel header.
- **Feed freshness rows** — the Filings tab shows `Fish Rank Updated:` and `NSE Filings fetched:` with the feed's own update time, green when fresh and red past 48 hours.
- **Back button** — appears next to the Peers heading after a peer row jumps the chart; one tap returns to the original stock.
- **Trendlyne button** in the links row (hidden when no company page is found).
- **Click Anywhere To Minimize Panel** — clicking anywhere on the chart collapses the panel to the pill. New dashboard toggle, default ON.
- **Double-click the pill** to switch between compact and classic sizes (single click toggles the panel).
- **Info (i) tooltips** on the NSE Filings and Fish RS Rank headings — floating yellow tips on hover or click.
- The earnings banner now shows the actual date: `Earnings released: 01-Aug-2026 (59d ago) · Q1 FY2027`.

### Changed

- Refresh button moved to the header's sector-breadcrumb row — always visible, including on errors.
- Section headings get distinct colors; tabs are teal when active with a lighter tint and `|` separators when inactive; rows highlight light yellow on hover.
- The filings feed re-downloads at most every 10 minutes (the host ignores Range probes and doesn't expose ETag); per-ticker results are stored and served only while matching the current feed generation.
- Peers are cached for 12 hours keyed by Screener warehouse id; Refresh still forces a fresh pull.
- The multi-MB Kite instruments list is downloaded only when a peer actually has a numeric BSE slug.
- Theme auto-detection uses explicit theme classes with a background-color fallback.
- Ticker detection prefers the URL `symbol` parameter over the page title.
- New extension icons with a thick blue border.
- **No new host permissions** — the fish-rs-board feed is CORS-open, so updating from 1.0.0 does not trigger a permission-increase prompt or disable the extension.

### Fixed

- **`&` symbols (M&M, J&KBANK, ARE&M):** peer slugs arrived HTML-entity-escaped (`M&amp;M`), so peer clicks opened a non-existent `BSE:M&amp;M` chart. Entities are now decoded when parsing peer rows. NSE peer clicks keep `&` (NSE:M&M is the real symbol); Chartink `&` symbols redirect to the correct NSE symbol via URL encoding.
- **`_` tickers on both exchanges:** NSE `_` tickers resolve via the `-` slug (`BAJAJ_AUTO` → `BAJAJ-AUTO`); BSE `_` tickers resolve through a normalized Kite symbol index (`BSE:M_M` → `M&M`). Unknown tickers are cached as not-found for 30 minutes — only genuine misses (404 / no search match / no BSE scrip), keyed per exchange.
- **Offline and rate-limit errors are no longer shown as "not an Indian equity"** — transient failures show "Could not reach Screener — check your connection" and are never cached.
- **Stub consolidated pages** (e.g. MACPOWER — a single pre-IPO quarter) are rejected; standalone data loads instead with a visible amber notice below Growth.
- **Filings and RS rows match the exchange spelling** (`BAJAJ-AUTO`) as well as the TradingView spelling (`BAJAJ_AUTO`) — hyphen stocks show their filings correctly.
- Fundamentals and earnings are no longer fetched while the panel is closed — the pill alone updates and data loads on first open.
- CON/STD toggle race — a response from the older mode can no longer paint over the newer one.
- Screener/Tijori links could keep pointing at the previous stock after a non-equity error — cleared on every ticker change.
- Cached earnings "days away" was frozen for the cache's lifetime — now recomputed from the stored date.
- Chartink redirect handles `&` symbols and `?query`-suffixed classic URLs.
- Double-clicking the pill threw a script error (dead `sendRuntimeMessage` call) — removed; the existing double-click handler toggles pill size.
- Panel off→on left stale state — the first pill click did nothing; state now resets cleanly.
- Dead `watchHistory` (isolated world can't observe TradingView's MAIN-world navigation) and a duplicate title observer removed.
- Filing PDF and Trendlyne links are host-allowlisted (`nsearchives.nseindia.com`, `trendlyne.com`).
- Earlier fix pass: panel-off polling stopped; NSE/BSE exchange is authoritative (USHAMART etc. no longer rejected); scraped text HTML-escaped (XSS); CON/STD uses per-mode cache; missing earnings dates no longer cached 12h; Screener search no longer guesses on ambiguous results; CMP/P/E thousands separators restored.

### Removed

- `fish-rs-board.pages.dev` host permission (feed is CORS-open).
- Dead `tvf_change_symbol` listener in the page bridge.

### Docs / packaging

- `manifest.json`: `minimum_chrome_version: 102` required for `world: "MAIN"`; description updated to mention NSE filings.
- `PRIVACY.md` covers all contacted hosts, including the CORS-open filings feed and Google favicons.
- Project tracking files: `ROADMAP.md`, `BUGS.md`, `WHATSNEW.md`, `AGENTS.md`, `NEXT-RELEASE.md`.

## [1.0.0] - 2026-09-27

### Added

- Chart panel on TradingView for Indian listed stocks: price, market cap, valuation, growth, strengths, concerns, shareholding, and peers.
- Consolidated and standalone toggle. Consolidated is the default.
- Earnings line from Trendlyne. Today, within 10 days, and older than 10 days use different colors.
- Live line shows whether the quarter on screen is current, one quarter behind, or older, and the quarter the figures were fetched from.
- Peer click opens `NSE:` first. `BSE:` is used only when NSE does not open a chart.
- BSE symbols are resolved through the Kite instruments list to Screener’s numeric company page.
- Tijori link is built from the company name: lowercase, `Ltd` written as `Limited`, spaces and symbols replaced with hyphens.
- Shareholding always lists Promoters, FIIs, DIIs, Government, and Public, in that order. A missing figure is a dash. A real zero stays 0. Any other Screener holder is added under those five.
- Classic and compact pill. The last mode is remembered. Double-click the pill to switch.
- Light and dark theme, remembered. The header button says Light or Dark.
- Dashboard with a Chartink redirect setting, a panel on/off setting, and grouped market links.
- Credit line opens the dashboard.

### Notes

- Figures are read from Screener, Trendlyne, and the public Kite instruments file. They are not investment advice.
- Company pages are cached for 12 hours. The BSE symbol map is cached for 24 hours.
