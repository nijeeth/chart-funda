# Changelog

Updates to Chart Funda. Newest release first.

The format follows [Keep a Changelog](https://keepachangelog.com/). Each release is a version from `manifest.json`.

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
