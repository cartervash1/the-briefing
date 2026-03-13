// ============================================
// THE BRIEFING — Daily Email Server
// Fetches real news and sends your briefing
// ============================================

const https = require("https");
const http = require("http");

// ── YOUR KEYS (fill these in) ──────────────
const CONFIG = {
  NEWS_API_KEY: "pub_d428cf4f09b24a8c82cc2f0ec85416a2",
  RESEND_API_KEY: "re_YCxonmZW_LNdFu4G78tVL6941kKPVjiYB",
  FROM_EMAIL: "The Briefing <onboarding@resend.dev>",
  SEND_TIME_HOUR: 7, // 7 AM your time
  SUBSCRIBERS: [
    { name: "carter", email: "carter.vash1@gmail.com" }
    // Add more like: { name: "Jane", email: "jane@email.com" }
  ],
  STOCKS_TO_WATCH: ["AAPL", "NVDA", "MSFT"],
  FAVORITE_TEAMS: ["Cowboys", "Lakers", "Yankees"],
};

// ── FETCH NEWS FROM NEWSDATA.IO ───────────
function fetchNews(query) {
  return new Promise((resolve) => {
    const q = encodeURIComponent(query);
    const url = `https://newsdata.io/api/1/news?apikey=${CONFIG.NEWS_API_KEY}&q=${q}&language=en&size=3`;

    https.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          console.log("NewsData response status:", parsed.status);
          console.log("NewsData results count:", (parsed.results || []).length);
          if (parsed.message) console.log("NewsData message:", parsed.message);
          // NewsData.io returns { results: [...] }
          const articles = (parsed.results || []).map(a => ({
            title: a.title,
            description: a.description,
            url: a.link,
          }));
          resolve(articles);
        } catch(e) {
          console.log("NewsData parse error:", e.message);
          console.log("Raw response:", data.slice(0, 200));
          resolve([]);
        }
      });
    }).on("error", () => resolve([]));
  });
}

// ── FETCH STOCK PRICE ──────────────────────
function fetchStock(ticker) {
  return new Promise((resolve) => {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`;
    https.get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          const meta = json.chart.result[0].meta;
          const price = meta.regularMarketPrice.toFixed(2);
          const prev = meta.chartPreviousClose.toFixed(2);
          const change = ((price - prev) / prev * 100).toFixed(2);
          const arrow = change >= 0 ? "▲" : "▼";
          resolve(`${ticker}: $${price} ${arrow}${Math.abs(change)}%`);
        } catch {
          resolve(`${ticker}: unavailable`);
        }
      });
    }).on("error", () => resolve(`${ticker}: unavailable`));
  });
}

// ── BUILD THE EMAIL HTML ───────────────────
function buildEmail(sections, stockLines, recipientName) {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  });

  const stockTable = stockLines.map(s =>
    `<tr><td style="padding:4px 12px 4px 0;font-family:monospace;font-size:13px;color:#333;">${s}</td></tr>`
  ).join("");

  const sectionHTML = sections.map(sec => `
    <div style="margin-bottom:24px;padding-bottom:24px;border-bottom:1px solid #e8e3d9;">
      <div style="font-family:monospace;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#c8392b;margin-bottom:8px;">${sec.icon} ${sec.label}</div>
      <div style="font-family:'Georgia',serif;font-size:18px;font-weight:bold;color:#0d0d0d;margin-bottom:8px;line-height:1.3;">${sec.headline}</div>
      ${sec.stories.map(s => `
        <div style="margin-bottom:10px;">
          <div style="font-size:13px;font-weight:600;color:#1a3a5c;margin-bottom:2px;">${s.title}</div>
          <div style="font-size:12px;color:#666;line-height:1.5;">${s.description || ""}</div>
          ${s.url ? `<a href="${s.url}" style="font-size:11px;color:#c8392b;font-family:monospace;">Read more →</a>` : ""}
        </div>
      `).join("")}
    </div>
  `).join("");

  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f0e8;font-family:'Georgia',serif;">
  <div style="max-width:620px;margin:0 auto;background:white;">

    <!-- Header -->
    <div style="background:#0d0d0d;padding:28px 32px;border-bottom:4px solid #c8392b;">
      <div style="font-family:monospace;font-size:11px;letter-spacing:2px;color:#666;text-transform:uppercase;margin-bottom:6px;">${today}</div>
      <div style="font-family:'Georgia',serif;font-size:28px;font-weight:900;color:white;letter-spacing:-0.5px;">The<span style="color:#c8392b;">.</span>Briefing</div>
      <div style="color:#888;font-size:13px;margin-top:4px;">Good morning, ${recipientName}. Here's what matters today.</div>
    </div>

    <!-- Stocks Bar -->
    <div style="background:#1a3a5c;padding:12px 32px;">
      <div style="font-family:monospace;font-size:10px;letter-spacing:2px;color:#8fa8c8;text-transform:uppercase;margin-bottom:6px;">Your Stocks</div>
      <table style="border-collapse:collapse;">${stockTable}</table>
    </div>

    <!-- Body -->
    <div style="padding:28px 32px;">
      ${sectionHTML}

      <!-- Bottom Line -->
      <div style="background:#0d0d0d;color:white;padding:16px 20px;border-radius:4px;margin-top:8px;">
        <div style="font-family:monospace;font-size:10px;letter-spacing:2px;color:#8fa8c8;text-transform:uppercase;margin-bottom:6px;">⚡ Why This Matters To You</div>
        <div style="font-size:13px;color:#ddd;line-height:1.6;">
          Stay ahead of the market, your teams, and the world. This briefing was built specifically for your interests — stocks, sports, tech, and global events that affect your money and your day.
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div style="padding:16px 32px;border-top:1px solid #e8e3d9;text-align:center;">
      <div style="font-family:monospace;font-size:10px;color:#aaa;letter-spacing:1px;">
        THE BRIEFING · DAILY INTELLIGENCE REPORT<br>
        <span style="color:#ccc;">You're receiving this because you subscribed.</span>
      </div>
    </div>

  </div>
</body>
</html>`;
}

// ── SEND EMAIL VIA RESEND ──────────────────
function sendEmail(to, toName, subject, html) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      from: CONFIG.FROM_EMAIL,
      to: [to],
      subject,
      html,
    });

    const options = {
      hostname: "api.resend.com",
      path: "/emails",
      method: "POST",
      headers: {
        "Authorization": `Bearer ${CONFIG.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          console.log(`✓ Sent to ${toName} (${to})`);
          resolve();
        } else {
          console.error(`✗ Failed for ${to}: ${data}`);
          reject(new Error(data));
        }
      });
    });

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// ── MAIN: FETCH + BUILD + SEND ─────────────
async function sendDailyBriefing() {
  console.log(`\n📰 The Briefing — ${new Date().toLocaleString()}`);
  console.log("Fetching news...");

  // Fetch news sections one at a time (GNews free plan rate limit)
  console.log("Fetching markets news...");
  const marketsNews = await fetchNews("stock market Wall Street S&P");
  await new Promise(r => setTimeout(r, 2000));

  console.log("Fetching tech news...");
  const techNews = await fetchNews("artificial intelligence technology");
  await new Promise(r => setTimeout(r, 2000));

  console.log("Fetching sports news...");
  const sportsNews = await fetchNews("NFL NBA baseball basketball sports");
  await new Promise(r => setTimeout(r, 2000));

  console.log("Fetching politics news...");
  const politicsNews = await fetchNews("US politics war geopolitics");

  // Fetch stock prices
  const stockLines = await Promise.all(
    CONFIG.STOCKS_TO_WATCH.map(fetchStock)
  );

  // Build sections
  const sections = [
    {
      icon: "📉",
      label: "Markets & Finance",
      headline: marketsNews[0]?.title || "Market update unavailable",
      stories: marketsNews.slice(0, 3).map(a => ({
        title: a.title,
        description: a.description,
        url: a.url,
      })),
    },
    {
      icon: "🤖",
      label: "AI & Tech",
      headline: techNews[0]?.title || "Tech update unavailable",
      stories: techNews.slice(0, 3).map(a => ({
        title: a.title,
        description: a.description,
        url: a.url,
      })),
    },
    {
      icon: "🏆",
      label: "Sports",
      headline: sportsNews[0]?.title || "Sports update unavailable",
      stories: sportsNews.slice(0, 3).map(a => ({
        title: a.title,
        description: a.description,
        url: a.url,
      })),
    },
    {
      icon: "⚔️",
      label: "War & Politics",
      headline: politicsNews[0]?.title || "Politics update unavailable",
      stories: politicsNews.slice(0, 3).map(a => ({
        title: a.title,
        description: a.description,
        url: a.url,
      })),
    },
  ];

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric"
  });
  const subject = `Your Briefing for ${today} — ${marketsNews[0]?.title?.slice(0, 60) || "Daily update"}...`;

  // Send to every subscriber
  console.log(`Sending to ${CONFIG.SUBSCRIBERS.length} subscriber(s)...`);
  for (const sub of CONFIG.SUBSCRIBERS) {
    const html = buildEmail(sections, stockLines, sub.name);
    await sendEmail(sub.email, sub.name, subject, html);
  }

  console.log("✅ All done!\n");
}

// ── SCHEDULER: runs every hour, sends at 7am ──
function startScheduler() {
  console.log("⏰ Scheduler running — will send at", CONFIG.SEND_TIME_HOUR + ":00 AM daily");

  // Send immediately on first run (for testing)
  sendDailyBriefing();

  // Then check every hour
  setInterval(() => {
    const hour = new Date().getHours();
    if (hour === CONFIG.SEND_TIME_HOUR) {
      sendDailyBriefing();
    }
  }, 60 * 60 * 1000); // every hour
}

// ── KEEP-ALIVE WEB SERVER (required for Render hosting) ──
const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end("The Briefing is running ✓");
});

server.on("error", (err) => {
  console.error("Server error:", err.message);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught error (keeping alive):", err.message);
});

process.on("unhandledRejection", (err) => {
  console.error("Unhandled rejection (keeping alive):", err);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("🚀 Server alive on port", PORT);
  console.log("🔑 NewsData key set:", CONFIG.NEWS_API_KEY !== "YOUR_NEWSDATA_API_KEY_HERE" ? "YES ✓" : "NO ✗ — please update");
  console.log("🔑 Resend key set:", CONFIG.RESEND_API_KEY !== "YOUR_RESEND_API_KEY_HERE" ? "YES ✓" : "NO ✗ — please update");
  console.log("📧 Sending to:", CONFIG.SUBSCRIBERS.map(s => s.email).join(", "));
  startScheduler();
});





