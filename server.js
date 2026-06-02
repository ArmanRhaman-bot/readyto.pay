/* =============================================
   server.js — Express Backend for Binance Invoice
   Node.js 18+ built-in fetch ব্যবহার করে
   ============================================= */

const express = require("express");
const path    = require("path");

const app  = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ── POST /verify ──────────────────────────────
app.post("/verify", async (req, res) => {
  const { order_id, amount, uid, admin_id, invoice_id, bot_name } = req.body;

  // Server-side validation
  if (!order_id || !/^\d{18}$/.test(order_id)) {
    return res.json({ success: false, message: "Invalid Order ID format." });
  }
  if (!admin_id) {
    return res.json({ success: false, message: "Admin ID missing." });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error("TELEGRAM_BOT_TOKEN not set");
    return res.json({ success: false, message: "Server config error." });
  }

  const text = [
    `🔔 *New Payment Submission*`,
    ``,
    `🤖 Bot: \`${bot_name || "N/A"}\``,
    `📋 Invoice: \`${invoice_id || "N/A"}\``,
    `💰 Amount: \`${amount} USDT\``,
    `🆔 Binance UID: \`${uid}\``,
    `🧾 Order ID: \`${order_id}\``,
    ``,
    `⏰ Time: ${new Date().toLocaleString("en-BD", { timeZone: "Asia/Dhaka" })}`,
  ].join("\n");

  try {
    const tgRes = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id:    admin_id,
          text:       text,
          parse_mode: "Markdown",
        }),
      }
    );

    const tgData = await tgRes.json();

    if (tgData.ok) {
      res.json({ success: true });
    } else {
      console.error("Telegram error:", JSON.stringify(tgData));
      res.json({ success: false, message: "Failed to notify admin." });
    }
  } catch (err) {
    console.error("Fetch error:", err.message);
    res.json({ success: false, message: "Server error. Try again." });
  }
});

// ── Catch-all → index.html ────────────────────
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
