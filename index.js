// ============================================
// THE BRIEFING — Daily Email Server
// Fetches real news and sends your briefing
// ============================================

const https = require("https");
const http = require("http");

// ── YOUR KEYS (fill these in) ──────────────
const CONFIG = {
  NEWS_API_KEY: "434d0f260d9b4e12ad415932103f92f2",
  RESEND_API_KEY: "re_YCxonmZW_LNdFu4G78tVL6941kKPVjiYB",
  FROM_EMAIL: "The Briefing <onboarding@resend.dev>",
  SEND_TIME_HOUR: 7,
  SUBSCRIBERS: [
    { name: "You", email: "carter.vash1@gmail.com" }
  ],
  STOCKS_TO_WATCH: ["AAPL", "NVDA", "MSFT"],
  FAVORITE_TEAMS: ["Cowboys", "Lakers", "Yankees"],
};