/**
 * Dashboard logic
 * - Toggle for Chartink redirect
 * - Categorized colorful boxes with site icons
 */

import { get, set } from "../../shared/storage.js";

// ============================================
// CATEGORIES + LINKS
// ============================================
const CATEGORIES = [
  {
    id: "fundamentals",
    title: "Fundamentals & Ideas",
    items: [
      {
        title: "ValuePickr Forum",
        desc: "Long-term Investing discussions/indepth Stock Analysis",
        url: "https://forum.valuepickr.com/",
        domain: "forum.valuepickr.com"
      },
      {
        title: "Tijori Ideas",
        desc: "Curated stock ideas dashboard",
        url: "https://www.tijorifinance.com/in/ideas-dashboard/",
        domain: "tijorifinance.com"
      }
    ]
  },
  {
    id: "ai",
    title: "AI & Smart Screens",
    items: [
      {
        title: "Finmagine AI Advisor",
        info: "Requires Finmagine extension to work",
        desc: "AI-powered fundamental & technical analysis",
        url: "https://finmagine.com/ai-advisor.php",
        domain: "finmagine.com"
      },
      {
        title: "CANSLIM Screener",
        info: "Must be Logged into Screener.in to work", 
        desc: "Growth stock screening using CANSLIM principles",
        url: "https://www.screener.in/screens/3971938/canslim/",
        domain: "screener.in"
      }
    ]
  },
  {
    id: "market",
    title: "Market Strength",
    items: [
      {
        title: "Sector Rotation (RRG)",
        desc: "Relative rotation graphs",
        url: "https://stockmojo.in/sector-rotation-rrg",
        domain: "stockmojo.in"
      },
      {
        title: "Relative Returns",
        desc: "1-month return above the sector",
        url: "https://economictimes.indiatimes.com/stocks/marketstats-technicals/relative-returns?firstoperand=R1MonthReturn&operationtype=Above&secondoperand=sector1MonthReturn&filter=2371",
        domain: "economictimes.indiatimes.com"
      },
      {
        title: "FII / DII Money Flow Analysis",
        desc: "Institutional money flow, F&O positioning & heatmaps",
        url: "https://fii-diidata.mrchartist.com/",
        domain: "fii-diidata.mrchartist.com"
      }
    ]
  },
  {
    id: "funds",
    title: "Mutual Funds",
    items: [
      {
        title: "Value Research Selector",
        desc: "Mutual fund screener",
        url: "https://www.valueresearchonline.com/funds/selector/",
        domain: "valueresearchonline.com"
      },
      {
        title: "Portfolio Overlap",
        desc: "Identify stock overlap in different Mutual Fund holdings",
        url: "https://primeinvestor.in/mutual-funds-overlap/",
        domain: "primeinvestor.in"
      },
      {
        title: "Rolling Returns",
        desc: "Rolling returns vs benchmark",
        url: "https://www.advisorkhoj.com/mutual-funds-research/rolling-return-vs-benchmark",
        domain: "advisorkhoj.com"
      },
      {
        title: "SIP Rolling Returns",
        desc: "Rolling returns calculated in SIP mode",
        url: "https://sip-rolling-returns.streamlit.app/",
        domain: "sip-rolling-returns.streamlit.app"
      }
    ]
  },
  {
    id: "news",
    title: "Newsletters",
    items: [
      {
        title: "The Chatter",
        desc: "Zerodha market newsletter",
        url: "https://thechatter.zerodha.com/",
        domain: "thechatter.zerodha.com"
      },
      {
        title: "Intelsense",
        desc: "Market newsletter & stock ideas",
        url: "https://intelsense.substack.com/archive",
        domain: "intelsense.substack.com"
      },
      {
        title: "SOIC",
        desc: "Stock market education & deep dives",
        url: "https://soic.substack.com/",
        domain: "soic.substack.com"
      },
      {
        title: "Scientific Investing",
        desc: "Research-backed ideas & deep dives",
        url: "https://scientificinvesting.substack.com/",
        domain: "scientificinvesting.substack.com"
      }
    ]
  },
  {
    id: "books",
    title: "Others",
    items: [
      {
        title: "HTT Indicators",
        desc: "Free HTT Indicators for trading view",
        url: "https://sites.google.com/view/httindicators/indicators-and-videos?pli=1&authuser=0",
        domain: "sites.google.com"
      },
      {
        title: "Trading/Investment Books",
        desc: "Free curated investment books",
        url: "https://github.com/bharaniabhishek123/some-investment-books/tree/master",
        domain: "github.com"
      }
    ]
  }
];

// ============================================
// Helpers
// ============================================
function faviconUrl(domain) {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
}

// ============================================
// Settings Toggle
// ============================================
const toggleEl = document.getElementById("chartink-redirect-toggle");
const panelToggleEl = document.getElementById("tv-panel-toggle");

async function initToggle() {
  const enabled = await get("chartinkRedirectEnabled");
  toggleEl.checked = !!enabled;

  toggleEl.addEventListener("change", async () => {
    await set("chartinkRedirectEnabled", toggleEl.checked);
  });

  const panelEnabled = await get("tvPanelEnabled");
  panelToggleEl.checked = panelEnabled !== false;

  panelToggleEl.addEventListener("change", async () => {
    await set("tvPanelEnabled", panelToggleEl.checked);
  });
}

// ============================================
// Render categories
// ============================================
function renderBookmarks() {
  const container = document.getElementById("bookmarks-container");
  container.innerHTML = "";

  CATEGORIES.forEach((cat) => {
    const box = document.createElement("div");
    box.className = `category-box cat-${cat.id}`;

    const title = document.createElement("div");
    title.className = "category-title";
    title.textContent = cat.title;
    box.appendChild(title);

    const links = document.createElement("div");
    links.className = "category-links";

    cat.items.forEach((item) => {
      const a = document.createElement("a");
      a.className = "bookmark-link";
      a.href = item.url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";

      a.innerHTML = `
        <img class="bookmark-icon" src="${faviconUrl(item.domain)}" alt="" loading="lazy" />
        <div class="bookmark-text">
          <span class="bookmark-title">${item.title}</span>
          <span class="bookmark-desc">${item.desc}</span>
        </div>
      `;

      links.appendChild(a);
      if (item.info) {
        const info = document.createElement("div");
        info.className = "bookmark-info";
        info.textContent = item.info;
        document.body.appendChild(info);

        a.addEventListener("mousemove", (e) => {
          info.style.left = `${e.clientX + 12}px`;
          info.style.top = `${e.clientY - info.offsetHeight - 12}px`;
          info.classList.add("visible");
        });

        a.addEventListener("mouseleave", () => {
          info.classList.remove("visible");
        });
      }
    });

    box.appendChild(links);
    container.appendChild(box);
  });
}




// ============================================
// Init — isolated so one failure doesn't block the other
// ============================================
try {
  initToggle();
} catch (e) {
  console.error("[Dashboard] Settings toggle FAILED to init:", e);
}

try {
  renderBookmarks();
} catch (e) {
  console.error("[Dashboard] Bookmark rendering FAILED:", e);
}