\# Chart Funda



Indian stock fundamentals, ownership, and peers beside your TradingView chart. Includes an optional Chartink redirect.



Chart Funda is a free Chrome extension for NSE and BSE listed companies. Open a chart and the figures sit next to it. Version 1.0.0 is the public Chrome Web Store release.



Chart Funda is an independent extension. It is not made by TradingView, Screener, Trendlyne, Chartink, or Zerodha. The figures are for reference. This extension does not give investment advice.



\## Install



1\. Install Chart Funda from the Chrome Web Store.

2\. Click the extension icon. The dashboard opens.

3\. Open a chart on \[TradingView](https://www.tradingview.com/) or \[in.tradingview.com](https://in.tradingview.com/).

4\. A pill appears at the bottom right. Click it to open the panel. Double-click it to switch between the classic pill and the compact pill. That choice is saved.



The panel works on Indian listed equity. Indexes, futures, and options show a short message instead of figures.



\## What the panel shows



\- Company name and sector, (2 secctor level) linking to its Screener market page.

\- Price, market cap, P/E, P/B, 52-week high and low, dividend yield, ROCE, and ROE.

\- Growth for the latest reported quarter or half-year, against the quarter or Half-year before and the same period a year earlier, with a line naming the period the figures came from.

\- Strengths and concerns from the company page.

\- Shareholding for Promoters, FIIs, DIIs, Government, and Public, each with the change since last quarter and a small trend line.

\- Peers with current price, P/E, and market cap. The median row is marked. Click a peer to switch the chart in place.

\- A link to the company on Screener and on Tijori.

\- Consolidated or standalone results. Consolidated is the default. The choice is saved.



\## Appearance



Light and dark follow the chart, and you can override that from the panel. The choice is saved.



\## Dashboard



Click the extension icon to open the dashboard.

or Click the credit bar in the Fundamental panel to open the dashboard

&#x20;It holds:



\- \*\*Chartink redirect\*\* — optional. When it is on, opening a stock on Chartink opens the NSE: symbol on TradingView instead.

\- \*\*TradingView Fundamentals Panel\*\* - Optional. When it is on, Tradingview website will show the chartfunda panel.

\- A set of curated market links, grouped by category.





\## Privacy and permissions



Chart Funda has no account and does not send your charts or holdings anywhere. Settings and a short-lived copy of company pages stay in your browser.



| Permission | Why the store build asks for it |

|---|---|

| Storage | Saves theme, pill size, consolidated or standalone, the Chartink switch, and cached company pages. |

| Screener.in | Reads the company page, shareholding, and peers. |

| Kite instruments | Matches a BSE symbol to Screener's company page. |

| trendline.com |  Reads the company earning date |

| Tabs | Used only by the Chartink redirect, to read a Chartink stock address and open the TradingView chart. |



Company pages are kept for 12 hours. The BSE symbol list is kept for 24 hours. Tijori and the dashboard links are ordinary web links. The extension does not request those sites.



\## Where the numbers come from



\- \[Screener.in](https://www.screener.in/) for company figures, shareholding, and peers.

\- \[Kite Connect instruments](https://api.kite.trade/instruments) for BSE scrip codes.

\- \[Trendlyne.com] (https://www.Trendlyne.com/) for company earnings date,

\- TradingView is the chart the panel is drawn on.





\## Source



The public release is this repository. There is no build step.



\\```

chart-funda/

├── manifest.json

├── README.md

├── PRIVACY.md

├── background/

│   └── index.js

├── shared/

│   └── storage.js

├── modules/

│   ├── chartink-redirect/

│   │   └── background.js

│   ├── screener-fundamentals/

│   │   ├── background.js

│   │   └── bse-lookup.js

│   ├── tv-panel/

│   │   ├── content.js

│   │   ├── page-bridge.js

│   │   └── style.css

│   |── earnings-calendar/

│   |  └── background.js

│   └── dashboard/

│       ├── index.html

│       ├── style.css

│       └── script.js

└── icons/

&#x20;   ├── icon16.png    (from the candle+EMA logo — export separately)

&#x20;   ├── icon48.png

&#x20;   └── icon128.png

&#x20;   └── logo-source.svg



\\```



To Install Locally

To load the source in Chrome or Brave: 

1. Open the extensions page, 

2\. Turn on Developer mode

3\. Choose Load unpacked

4\. select this folder. After a change, reload the extension and refresh the TradingView tab.



Issues and pull requests are welcome. Keep a change to one behavior. This extension has no API keys.



\## License

MIT License. See the [LICENSE](LICENSE) file.

