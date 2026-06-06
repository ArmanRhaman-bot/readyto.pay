/*
  server.js — Binance Invoice + Admin Panel
  
  ENV Variables (Render Dashboard):
  - MONGODB_URI   : MongoDB Atlas connection string
  - SESSION_SECRET: যেকোনো random string (e.g. "mysecret123")
  - PORT          : auto by Render
*/

const express  = require("express");
const path     = require("path");
const crypto   = require("crypto");
const { MongoClient, ObjectId } = require("mongodb");

const app  = express();
const PORT = process.env.PORT || 8080;

// ── MongoDB ───────────────────────────────────
let db;
const MONGO_URI = process.env.MONGODB_URI;

async function connectDB() {
  if (!MONGO_URI) { console.warn("⚠️ No MONGODB_URI — data won't persist"); return; }
  try {
    const client = new MongoClient(MONGO_URI);
    await client.connect();
    db = client.db("invoice_app");
    console.log("✅ MongoDB connected");
  } catch(e) {
    console.error("MongoDB error:", e.message);
  }
}

// ── Helpers ───────────────────────────────────
function col(name) { return db ? db.collection(name) : null; }

// Simple session store (in-memory, enough for small use)
const sessions = new Map(); // token => { botToken, botInfo, adminId, expiresAt }

function makeSession(botToken, botInfo, adminId) {
  const sid = crypto.randomBytes(32).toString("hex");
  sessions.set(sid, {
    botToken,
    botInfo,
    adminId,
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
  });
  return sid;
}

function getSession(req) {
  const sid = req.cookies?.sid;
  if (!sid) return null;
  const s = sessions.get(sid);
  if (!s || s.expiresAt < Date.now()) { sessions.delete(sid); return null; }
  return s;
}

// Cookie parser (tiny, no dependency)
function parseCookies(req, res, next) {
  req.cookies = {};
  const raw = req.headers.cookie || "";
  raw.split(";").forEach(c => {
    const [k, ...v] = c.trim().split("=");
    if (k) req.cookies[k.trim()] = decodeURIComponent(v.join("="));
  });
  res.setCookie = (name, val, opts={}) => {
    let str = `${name}=${encodeURIComponent(val)}; Path=/; HttpOnly`;
    if (opts.maxAge) str += `; Max-Age=${opts.maxAge}`;
    if (opts.sameSite) str += `; SameSite=${opts.sameSite}`;
    res.setHeader("Set-Cookie", str);
  };
  next();
}

function requireAuth(req, res, next) {
  if (!getSession(req)) return res.status(401).json({ error: "Not authenticated" });
  next();
}

// ── Middleware ────────────────────────────────
app.use(express.json());
app.use(parseCookies);
app.use(express.static(__dirname));  // serve index.html, style.css, script.js

// ══════════════════════════════════════════════
// PUBLIC API
// ══════════════════════════════════════════════

// POST /verify — submit payment
app.post("/verify", async (req, res) => {
  const { order_id, amount, uid, admin_id, invoice_id, bot_name, userId, username } = req.body;

  if (!order_id || !/^\d{18}$/.test(order_id))
    return res.json({ success:false, message:"Invalid Order ID format." });
  if (!admin_id)
    return res.json({ success:false, message:"Admin ID missing." });

  // Duplicate check
  const payments = col("payments");
  if (payments) {
    const exists = await payments.findOne({ order_id });
    if (exists) return res.json({ success:false, message:"This Order ID was already submitted." });
  }

  // Save to DB
  const record = {
    order_id,
    amount,
    uid,
    admin_id,
    invoice_id,
    bot_name,
    userId,
    username,
    status: "pending",      // pending | confirmed | cancelled
    createdAt: new Date(),
  };

  let insertedId = null;
  if (payments) {
    const r = await payments.insertOne(record);
    insertedId = r.insertedId;
  }

  // Notify admin via Telegram
  // Find bot token for this admin_id
  let botToken = null;
  const bots = col("bots");
  if (bots) {
    const bot = await bots.findOne({ adminId: admin_id });
    if (bot) botToken = bot.botToken;
  }

  // Fallback to env token
  if (!botToken) botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (botToken) {
    const text =
`🔔 *New Payment Submission*

🤖 Bot: \`${bot_name || "N/A"}\`
👤 User: @${username || "NoUsername"} (\`${userId || "N/A"}\`)

📋 Invoice: \`${invoice_id}\`
💰 Amount: \`${amount} USDT\`
🆔 Binance UID: \`${uid}\`
🧾 Order ID: \`${order_id}\`
🕐 Time: ${new Date().toLocaleString("en-BD", {timeZone:"Asia/Dhaka"})}

Status: ⏳ Pending`;

    const keyboard = insertedId ? {
      inline_keyboard: [[
        { text:"✅ Confirm", callback_data:`confirm_${insertedId}` },
        { text:"❌ Cancel",  callback_data:`cancel_${insertedId}` }
      ]]
    } : undefined;

    try {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          chat_id: admin_id,
          text,
          parse_mode:"Markdown",
          reply_markup: keyboard
        })
      });
    } catch(e) { console.error("TG notify error:", e.message); }
  }

  res.json({ success:true, invoice_id, order_id, amount, bot_name });
});

// ══════════════════════════════════════════════
// ADMIN AUTH
// ══════════════════════════════════════════════

// POST /admin/login
app.post("/admin/login", async (req, res) => {
  const { botToken, adminId } = req.body;
  if (!botToken || !adminId)
    return res.json({ success:false, message:"Bot token and Admin ID required." });

  // Verify token with Telegram
  try {
    const r = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    const d = await r.json();
    if (!d.ok) return res.json({ success:false, message:"Invalid bot token." });

    const botInfo = d.result;

    // Save bot config to DB
    const bots = col("bots");
    if (bots) {
      await bots.updateOne(
        { adminId },
        { $set: { botToken, adminId, botInfo, updatedAt: new Date() } },
        { upsert: true }
      );
    }

    const sid = makeSession(botToken, botInfo, adminId);
    res.setCookie("sid", sid, { maxAge: 604800, sameSite:"Lax" });
    res.json({ success:true, botName: botInfo.first_name });

  } catch(e) {
    res.json({ success:false, message:"Network error. Try again." });
  }
});

// POST /admin/logout
app.post("/admin/logout", (req, res) => {
  const sid = req.cookies?.sid;
  if (sid) sessions.delete(sid);
  res.setCookie("sid", "", { maxAge:0 });
  res.json({ success:true });
});

// GET /admin/me
app.get("/admin/me", (req, res) => {
  const s = getSession(req);
  if (!s) return res.json({ loggedIn:false });
  res.json({ loggedIn:true, botName: s.botInfo?.first_name, adminId: s.adminId });
});

// ══════════════════════════════════════════════
// ADMIN DATA APIs
// ══════════════════════════════════════════════

// GET /admin/payments?status=all|pending|confirmed|cancelled&page=1
app.get("/admin/payments", requireAuth, async (req, res) => {
  const s = getSession(req);
  const { status="all", page=1 } = req.query;
  const limit = 20;
  const skip  = (parseInt(page)-1) * limit;

  const payments = col("payments");
  if (!payments) return res.json({ payments:[], total:0 });

  const filter = { admin_id: s.adminId };
  if (status !== "all") filter.status = status;

  const [list, total] = await Promise.all([
    payments.find(filter).sort({ createdAt:-1 }).skip(skip).limit(limit).toArray(),
    payments.countDocuments(filter)
  ]);

  res.json({ payments: list, total, page: parseInt(page), pages: Math.ceil(total/limit) });
});

// POST /admin/payments/:id/confirm
app.post("/admin/payments/:id/confirm", requireAuth, async (req, res) => {
  const s = getSession(req);
  const payments = col("payments");
  if (!payments) return res.json({ success:false });

  const record = await payments.findOne({ _id: new ObjectId(req.params.id), admin_id: s.adminId });
  if (!record) return res.json({ success:false, message:"Not found." });

  await payments.updateOne({ _id: record._id }, { $set:{ status:"confirmed", confirmedAt: new Date() } });

  // Notify user (if userId known)
  if (record.userId && s.botInfo) {
    try {
      await fetch(`https://api.telegram.org/bot${s.botToken}/sendMessage`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          chat_id: record.userId,
          text: `✅ *Payment Confirmed!*\n\n📋 Invoice: \`${record.invoice_id}\`\n💰 Amount: \`${record.amount} USDT\`\n🧾 Order: \`${record.order_id}\`\n\nYour payment has been verified. Thank you!`,
          parse_mode:"Markdown"
        })
      });
    } catch(e) {}
  }

  res.json({ success:true });
});

// POST /admin/payments/:id/cancel
app.post("/admin/payments/:id/cancel", requireAuth, async (req, res) => {
  const s = getSession(req);
  const payments = col("payments");
  if (!payments) return res.json({ success:false });

  const record = await payments.findOne({ _id: new ObjectId(req.params.id), admin_id: s.adminId });
  if (!record) return res.json({ success:false, message:"Not found." });

  await payments.updateOne({ _id: record._id }, { $set:{ status:"cancelled", cancelledAt: new Date() } });

  if (record.userId) {
    try {
      await fetch(`https://api.telegram.org/bot${s.botToken}/sendMessage`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          chat_id: record.userId,
          text: `❌ *Payment Cancelled*\n\n📋 Invoice: \`${record.invoice_id}\`\n💰 Amount: \`${record.amount} USDT\`\n\nYour payment could not be verified. Please contact support.`,
          parse_mode:"Markdown"
        })
      });
    } catch(e) {}
  }

  res.json({ success:true });
});

// GET /admin/stats
app.get("/admin/stats", requireAuth, async (req, res) => {
  const s = getSession(req);
  const payments = col("payments");
  if (!payments) return res.json({ total:0, pending:0, confirmed:0, cancelled:0, volume:0 });

  const [total, pending, confirmed, cancelled, vol] = await Promise.all([
    payments.countDocuments({ admin_id: s.adminId }),
    payments.countDocuments({ admin_id: s.adminId, status:"pending" }),
    payments.countDocuments({ admin_id: s.adminId, status:"confirmed" }),
    payments.countDocuments({ admin_id: s.adminId, status:"cancelled" }),
    payments.aggregate([
      { $match: { admin_id: s.adminId, status:"confirmed" } },
      { $group: { _id:null, total:{ $sum:{ $toDouble:"$amount" } } } }
    ]).toArray()
  ]);

  res.json({ total, pending, confirmed, cancelled, volume: vol[0]?.total || 0 });
});

// ══════════════════════════════════════════════
// PAGE ROUTES
// ══════════════════════════════════════════════

app.get("/admin", (req, res) => res.sendFile(path.join(__dirname, "admin.html")));
app.get("/receipt", (req, res) => res.sendFile(path.join(__dirname, "receipt.html")));
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));
app.get("*", (req, res) => res.sendFile(path.join(__dirname, "index.html")));

// ── Start ─────────────────────────────────────
connectDB().then(() => {
  app.listen(PORT, () => console.log(`✅ Server on port ${PORT}`));
});
