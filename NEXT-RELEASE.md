# Next Release — working notes

Everything changed since the live Chrome Web Store version (**1.0.0**). This is the working list for the version currently in development — add entries here as work happens.

When the version is declared done:

1. Move these entries into `CHANGELOG.md` under the new version number (prepend — never rewrite older sections).
2. Rewrite `WHATSNEW.md` with the user-facing highlights.
3. Move shipped items out of `ROADMAP.md` and fixed bugs out of `BUGS.md`.
4. Bump `version` in `manifest.json`, re-zip, upload to the store.

## Target: 2.0.0 (in progress)

### Added

- **Corp. Filings tab** — third panel tab showing the stock's recent NSE corporate filings from fish-rs-board.pages.dev: timestamp + colored subject chip (red/amber/green/blue/violet, classified server-side by the site) + full description; each card links to the official NSE archive PDF.
- **Custom Fish RS Rank (Experimental)** — block at the top of the Filings tab: current rank plus 1W/1M/3M/6M history (green ≥95, red below), plus a small circular rank chip in the panel header.
- **Per-tab freshness rows** — on the Filings tab the status slot shows `Fish Rank Updated:` and `NSE Filings fetched:` with the feed's own `generated_at` (dd-Mon-yyyy), green when fresh and red past 48h.
- **Back button** — appears next to the Peers heading after a peer row jumps the chart; one tap returns to the original stock.
- **Trendlyne button** in the links row — company overview page (URL comes from the earnings search; hidden when unavailable).
- **Click Anywhere To Minimize Panel** — clicking anywhere on the chart collapses the panel back to the pill. New dashboard toggle, default ON.
- **Double-click the pill** to switch between compact and classic sizes (single click toggles the panel).
- **Info (i) tooltips** on the NSE Filings and Fish RS Rank headings — yellow floating tips on hover/click.
- Earnings banner now shows the actual date: `Earnings released: 01-Aug-2026 (59d ago) · Q1 FY2027` (same coloring as before).

### Changed

- **Refresh button moved to the header** — on the sector-breadcrumb row, always visible including on errors (previously it lived inside the status bar which only renders after a successful load).
- Section headings get distinct colors; tabs are teal when active with a lighter tint and `|` separators when inactive; rows highlight light yellow on hover.
- Conditional feed fetching — the filings feeds are Range-probed for `generated_at` first (~200 bytes); the full file is only downloaded when it changed. Results are cached per ticker.
- New extension icons; `manifest.json`: added `fish-rs-board.pages.dev` to host permissions.

### Fixed

- Disabling the TradingView panel left a 5-second poll running that kept fetching data in the background — now stops entirely when the panel is off.
- Indian tickers starting with `US`/`UK`/`EU` (e.g. USHAMART, EUREKAFORB) were wrongly rejected as foreign. Exchange is now authoritative: only `NSE:`/`BSE:` charts load fundamentals; foreign and commodity symbols (NASDAQ, MCX, etc.) show the "not Indian equity" message immediately.
- A stale exchange from the previous chart could wrongly allow or block the next symbol — exchange is now cleared whenever a ticker is detected without a prefix.
- Scraped text (company names, strengths/concerns, peer names, sector and shareholding labels) was injected into the panel unescaped — everything now passes through HTML escaping.
- Toggling Consolidated/Standalone force-refreshed everything; it now uses the per-mode cache like a normal load.
- A missing Trendlyne earnings date was cached for 12 hours — transient misses no longer stick.
- Screener search could silently show the wrong company when no slug matched; slug matching is now `-`/`_`/`&`-insensitive and ambiguous multi-results show an error instead of guessing.
- CMP and P/E in the peers table lost thousands separators — now formatted `en-IN` like market cap.

### Changed

- Peers are cached for 12 hours (keyed by Screener warehouse id) instead of refetched on every panel open; the manual Refresh button still forces a fresh pull.
- The multi-MB Kite instruments list is only downloaded when a peer actually has a numeric BSE slug — pure-NSE peer lists never trigger it.
- Theme auto-detection uses explicit theme classes with a background-color fallback instead of matching any element with "dark" in its class name.
- Ticker detection prefers the URL `symbol` parameter over the page title (more authoritative).

### Removed

- Dead `tvf_change_symbol` listener in page-bridge (nothing dispatched it).

### Docs / packaging

- `manifest.json`: added `"minimum_chrome_version": "102"` (required for `world: "MAIN"`).
- `PRIVACY.md`: discloses the Google favicon service used for dashboard link icons.
- `LICENSE` restored locally (exists on GitHub).
- Repo hygiene: stale "Step 3a" comments, duplicate HTML comment, and the `NON_INDIAN_EXCHANGES` set cleaned up.
- Project tracking added: `ROADMAP.md`, `BUGS.md`, `WHATSNEW.md`, `AGENTS.md`, `NEXT-RELEASE.md`.
