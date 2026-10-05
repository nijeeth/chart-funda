(function () {
  // Page-bridge script: runs in the page's own JS context (MAIN world),
  // not the isolated content-script world. This is the only way to
  // reach TradingView's own internal chart API.

  function getChart(api) {
    try {
      if (api.activeChart) return api.activeChart();
      if (api.chart) return api.chart();
    } catch (err) {}
    return null;
  }

  function readSymbol(info) {
    if (!info) return { ticker: "", exchange: "" };
    if (typeof info === "string") {
      const parts = info.split(":");
      return parts.length > 1
        ? { exchange: parts[0], ticker: parts.slice(1).join(":") }
        : { exchange: "", ticker: info };
    }
    const raw = String(info.pro_name || info.ticker || info.full_name || info.name || "");
    let ticker = info.symbol || "";
    let exchange = info.exchange || info.listed_exchange || "";
    if (raw.includes(":")) {
      const parts = raw.split(":");
      if (!exchange) exchange = parts[0];
      if (!ticker) ticker = parts.slice(1).join(":");
    } else if (!ticker) ticker = raw;
    return { ticker: String(ticker || ""), exchange: String(exchange || "") };
  }

  function symbolMatches(info, bare, exchange) {
    const read = readSymbol(info);
    return read.ticker.toUpperCase() === bare.toUpperCase()
      && read.exchange.toUpperCase() === exchange.toUpperCase();
  }

  function applySymbol(api, chart, full) {
    let interval = "D";
    try {
      if (api.getSymbolInterval) interval = api.getSymbolInterval().interval || "D";
    } catch (err) {}
    if (api.changeSymbol) api.changeSymbol(full, interval);
    else if (chart && chart.setSymbol) chart.setSymbol(full);
  }

  function waitForSymbol(chart, bare, exchange, timeoutMs) {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (ok) => {
        if (settled) return;
        settled = true;
        resolve(ok);
      };
      let bus = null;
      const handler = (info) => {
        if (!symbolMatches(info, bare, exchange)) return;
        try { if (bus && bus.unsubscribe) bus.unsubscribe(null, handler); } catch (err) {}
        finish(true);
      };
      try {
        bus = chart.onSymbolChanged && chart.onSymbolChanged();
        if (bus && bus.subscribe) bus.subscribe(null, handler);
      } catch (err) {}
      setTimeout(() => {
        try {
          const ext = chart.symbolExt && chart.symbolExt();
          if (symbolMatches(ext, bare, exchange)) { finish(true); return; }
        } catch (err) {}
        finish(false);
      }, timeoutMs);
    });
  }

  document.addEventListener("tvf_open_chart", function (event) {
    const bare = event.detail && event.detail.symbol;
    const api = window.TradingViewApi || window.TradingView;
    const reply = (detail) => {
      document.dispatchEvent(new CustomEvent("tvf_open_chart_result", { detail }));
    };
    if (!bare || !api) { reply({ ok: false }); return; }
    const chart = getChart(api);
    if (!chart) { reply({ ok: false }); return; }

    (async () => {
      for (const exchange of ["NSE", "BSE"]) {
        try {
          const ext = chart.symbolExt && chart.symbolExt();
          if (symbolMatches(ext, bare, exchange)) {
            reply({ ok: true, ticker: bare, exchange });
            return;
          }
        } catch (err) {}
        const pending = waitForSymbol(chart, bare, exchange, 1200);
        try { applySymbol(api, chart, exchange + ":" + bare); }
        catch (err) { continue; }
        const opened = await pending;
        if (opened) {
          reply({ ok: true, ticker: bare, exchange });
          return;
        }
      }
      reply({ ok: false, ticker: bare });
    })();
  });

  // Reader — answers tvf_request_symbol with TradingView's own
  // authoritative symbol/exchange (more reliable than title/URL scraping).
  document.addEventListener("tvf_request_symbol", function () {
    const api = window.TradingViewApi || window.TradingView;
    let ticker = null;
    let exchange = null;
    try {
      const c = api && api.activeChart ? api.activeChart() : (api && api.chart ? api.chart() : null);
      if (c && c.symbolExt) {
        const e = c.symbolExt();
        ticker = e?.symbol;
        exchange = e?.exchange;
      }
      if (!ticker || !exchange) {
        const full = (c && c.symbol && c.symbol()) || (api && api.getSymbolInterval && api.getSymbolInterval()?.symbol);
        if (full && full.includes(":")) {
          const parts = full.split(":");
          if (!exchange) exchange = parts[0];
          if (!ticker) ticker = parts[1];
        } else if (full && !ticker) {
          ticker = full;
        }
      }
    } catch (err) {
      console.error("[TV Funda] symbol read error:", err);
    }
    document.dispatchEvent(new CustomEvent("tvf_symbol_response", { detail: { ticker, exchange } }));
  });
})();