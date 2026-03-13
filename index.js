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
    { name: "Carter", email: "carter.vash1@gmail.com" },
    { name: "Audrey", email: "akpehlps03@gmail.com" }
    // Add more like: { name: "Jane", email: "jane@email.com" }
  ],
  STOCKS_TO_WATCH: ["AAPL", "NVDA", "MSFT"],
  FAVORITE_TEAMS: ["Cowboys", "Thunder", "Stars"],
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

  // Parse stock lines into rich cards
  const stockCards = stockLines.map(s => {
    const isDown = s.includes("▼");
    const color = isDown ? "#c8392b" : "#2d6a4f";
    const bg = isDown ? "#fff5f5" : "#f0fff4";
    const border = isDown ? "#f5c6c6" : "#b7e4c7";
    return `
      <td style="padding:0 6px 0 0;">
        <div style="background:${bg};border:1px solid ${border};border-radius:6px;padding:10px 14px;min-width:120px;">
          <div style="font-family:monospace;font-size:11px;letter-spacing:1px;color:#888;margin-bottom:3px;">${s.split(":")[0]}</div>
          <div style="font-family:monospace;font-size:15px;font-weight:bold;color:${color};">${s.split(": ")[1] || ""}</div>
        </div>
      </td>`;
  }).join("");

  const sectionHTML = sections.map((sec, i) => {
    const isLast = i === sections.length - 1;
    const storiesHTML = sec.stories.map((s, si) => {
      const isFirst = si === 0;
      return `
        <div style="padding:14px 0;border-bottom:1px solid #f0ebe0;">
          ${isFirst ? `<div style="display:inline-block;background:#c8392b;color:white;font-family:monospace;font-size:9px;letter-spacing:1px;text-transform:uppercase;padding:2px 7px;border-radius:2px;margin-bottom:6px;">Top Story</div>` : ""}
          <div style="font-family:'Georgia',serif;font-size:${isFirst ? "16px" : "14px"};font-weight:bold;color:#0d0d0d;line-height:1.4;margin-bottom:6px;">${s.title || ""}</div>
          <div style="font-size:13px;color:#555;line-height:1.7;margin-bottom:8px;">${s.description || "No description available."}</div>
          ${s.url ? `<a href="${s.url}" style="font-family:monospace;font-size:11px;color:#c8392b;text-decoration:none;letter-spacing:0.5px;">READ FULL STORY →</a>` : ""}
        </div>`;
    }).join("");

    return `
      <div style="margin-bottom:${isLast ? "0" : "32px"};padding-bottom:${isLast ? "0" : "32px"};${isLast ? "" : "border-bottom:2px solid #e8e3d9;"}">
        <table style="border-collapse:collapse;width:100%;margin-bottom:12px;">
          <tr>
            <td>
              <span style="font-family:monospace;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#c8392b;">${sec.icon} ${sec.label}</span>
            </td>
            <td style="text-align:right;">
              <span style="font-family:monospace;font-size:10px;color:#bbb;letter-spacing:1px;">${new Date().toLocaleDateString("en-US",{month:"short",day:"numeric"})}</span>
            </td>
          </tr>
        </table>
        ${storiesHTML}
      </div>`;
  }).join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>The Briefing</title>
</head>
<body style="margin:0;padding:0;background:#f0ebe0;font-family:'Georgia',serif;">
  <div style="max-width:640px;margin:0 auto;">

    <!-- Top rule -->
    <div style="height:4px;background:linear-gradient(90deg,#c8392b 0%,#1a3a5c 100%);"></div>

    <!-- Header -->
    <div style="background:#0d0d0d;padding:32px 36px 24px;">
      <div style="font-family:monospace;font-size:10px;letter-spacing:3px;color:#555;text-transform:uppercase;margin-bottom:10px;">${today}</div>
      <table style="border-collapse:collapse;width:100%;">
        <tr>
          <td>
            <div style="font-family:'Georgia',serif;font-size:32px;font-weight:900;color:white;letter-spacing:-1px;line-height:1;">
              The<span style="color:#c8392b;">.</span>Briefing
            </div>
          </td>
          <td style="text-align:right;vertical-align:bottom;">
            <div style="font-family:monospace;font-size:10px;color:#444;letter-spacing:1px;text-transform:uppercase;">Daily Intelligence</div>
          </td>
        </tr>
      </table>
      <div style="margin-top:10px;padding-top:10px;border-top:1px solid #222;font-size:13px;color:#888;">
        Good morning, <strong style="color:#bbb;">${recipientName}</strong>. Here is everything that matters today.
      </div>
    </div>

    <!-- Stock Cards -->
    <div style="background:#1a3a5c;padding:16px 36px;">
      <div style="font-family:monospace;font-size:9px;letter-spacing:3px;color:#8fa8c8;text-transform:uppercase;margin-bottom:10px;">📈 Your Portfolio</div>
      <table style="border-collapse:collapse;"><tr>${stockCards}</tr></table>
    </div>

    <!-- Main Content -->
    <div style="background:white;padding:32px 36px;">
      ${sectionHTML}
    </div>

    <!-- Footer -->
    <div style="background:#0d0d0d;padding:20px 36px;text-align:center;">
      <div style="font-family:'Georgia',serif;font-size:14px;font-weight:bold;color:white;margin-bottom:4px;">
        The<span style="color:#c8392b;">.</span>Briefing
      </div>
      <div style="font-family:monospace;font-size:9px;color:#444;letter-spacing:2px;text-transform:uppercase;">
        Daily Intelligence Report · Personal Edition
      </div>
    </div>

    <!-- Bottom rule -->
    <div style="height:4px;background:linear-gradient(90deg,#1a3a5c 0%,#c8392b 100%);"></div>

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







