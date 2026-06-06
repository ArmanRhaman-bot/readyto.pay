/*
  server.js — Binance Invoice + Admin Panel
  ENV Variables:
  - MONGODB_URI    : MongoDB Atlas connection string
  - PORT           : auto by Render
*/

const express  = require("express");
const path     = require("path");
const crypto   = require("crypto");
const { MongoClient, ObjectId } = require("mongodb");

const app  = express();
const PORT = process.env.PORT || 8080;

// ── MongoDB ───────────────────────────────────
let db;
async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) { console.warn("⚠️  No MONGODB_URI"); return; }
  try {
    const client = new MongoClient(uri);
    await client.connect();
    db = client.db("invoice_app");
    // indexes
    await db.collection("payments").createIndex({ order_id: 1 }, { unique: true });
    await db.collection("payments").createIndex({ admin_id: 1, createdAt: -1 });
    await db.collection("bots").createIndex({ adminId: 1 }, { unique: true });
    console.log("✅ MongoDB connected");
  } catch(e) { console.error("MongoDB:", e.message); }
}

function col(name) { return db ? db.collection(name) : null; }

// ── Session store ─────────────────────────────
const sessions = new Map();
function makeSession(botToken, botInfo, adminId) {
  const sid = crypto.randomBytes(32).toString("hex");
  sessions.set(sid, { botToken, botInfo, adminId, expiresAt: Date.now() + 7*24*60*60*1000 });
  return sid;
}
function getSession(req) {
  const sid = req.cookies?.sid;
  if (!sid) return null;
  const s = sessions.get(sid);
  if (!s || s.expiresAt < Date.now()) { sessions.delete(sid); return null; }
  return s;
}

// ── Cookie parser ─────────────────────────────
function parseCookies(req, res, next) {
  req.cookies = {};
  (req.headers.cookie || "").split(";").forEach(c => {
    const [k, ...v] = c.trim().split("=");
    if (k) req.cookies[k.trim()] = decodeURIComponent(v.join("="));
  });
  res.setCookie = (name, val, opts={}) => {
    let s = `${name}=${encodeURIComponent(val)}; Path=/; HttpOnly`;
    if (opts.maxAge) s += `; Max-Age=${opts.maxAge}`;
    if (opts.sameSite) s += `; SameSite=${opts.sameSite}`;
    res.setHeader("Set-Cookie", s);
  };
  next();
}

function requireAuth(req, res, next) {
  if (!getSession(req)) return res.status(401).json({ error: "Not authenticated" });
  next();
}

// ── Telegram helper ───────────────────────────
async function tgSend(botToken, chatId, text, extra={}) {
  try {
    const r = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown", ...extra })
    });
    return await r.json();
  } catch(e) { console.error("TG send error:", e.message); return null; }
}

// ── Middleware ────────────────────────────────
app.use(express.json());
app.use(parseCookies);
app.use(express.static(__dirname));

// ══════════════════════════════════════════════
// PUBLIC — POST /verify
// ══════════════════════════════════════════════
app.post("/verify", async (req, res) => {
  const { order_id, amount, uid, admin_id, invoice_id, bot_name, userId, username } = req.body;

  if (!order_id || !/^\d{18}$/.test(order_id))
    return res.json({ success:false, message:"Invalid Order ID format." });
  if (!admin_id)
    return res.json({ success:false, message:"Admin ID missing." });

  const payments = col("payments");

  // Duplicate check
  if (payments) {
    const exists = await payments.findOne({ order_id });
    if (exists) return res.json({ success:false, message:"This Order ID was already submitted." });
  }

  // Build record
  const record = {
    order_id, amount, uid,
    admin_id,   // this is the Telegram chat_id of admin
    invoice_id, bot_name,
    userId: userId || "",
    username: username || "",
    status: "pending",
    createdAt: new Date(),
  };

  let insertedId = null;
  if (payments) {
    try {
      const r = await payments.insertOne(record);
      insertedId = r.insertedId;
      console.log("✅ Payment saved:", insertedId.toString());
    } catch(e) {
      if (e.code === 11000) return res.json({ success:false, message:"Duplicate Order ID." });
      console.error("Insert error:", e.message);
    }
  } else {
    console.warn("No DB — payment not saved");
  }

  // Get bot token for this admin
  let botToken = null;
  const bots = col("bots");
  if (bots) {
    const botDoc = await bots.findOne({ adminId: admin_id });
    if (botDoc) {
      botToken = botDoc.botToken;
      console.log("✅ Found bot token for admin:", admin_id);
    } else {
      console.warn("⚠️  No bot registered for admin_id:", admin_id);
    }
  }

  // Notify admin
  if (botToken && admin_id) {
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

    await tgSend(botToken, admin_id, text);
    console.log("✅ Admin notified:", admin_id);
  }

  res.json({
    success: true,
    invoice_id,
    order_id,
    amount,
    bot_name,
    record_id: insertedId ? insertedId.toString() : null,
  });
});

// PUBLIC — GET /status/:order_id  (for receipt polling)
app.get("/status/:order_id", async (req, res) => {
  const payments = col("payments");
  if (!payments) return res.json({ status:"pending" });
  const rec = await payments.findOne({ order_id: req.params.order_id });
  if (!rec) return res.json({ status:"not_found" });
  res.json({ status: rec.status, amount: rec.amount, invoice_id: rec.invoice_id });
});

// ══════════════════════════════════════════════
// ADMIN AUTH
// ══════════════════════════════════════════════

app.post("/admin/login", async (req, res) => {
  const { botToken, adminId } = req.body;
  if (!botToken || !adminId)
    return res.json({ success:false, message:"Bot token and Admin ID required." });

  // Verify with Telegram
  try {
    const r = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    const d = await r.json();
    if (!d.ok) return res.json({ success:false, message:"Invalid bot token." });

    const botInfo = d.result;

    // Save/update bot in DB
    const bots = col("bots");
    if (bots) {
      await bots.updateOne(
        { adminId },
        { $set: { botToken, adminId, botInfo, updatedAt: new Date() } },
        { upsert: true }
      );
      console.log("✅ Bot registered for admin:", adminId, "->", botInfo.first_name);
    }

    const sid = makeSession(botToken, botInfo, adminId);
    res.setCookie("sid", sid, { maxAge: 604800, sameSite: "Lax" });
    res.json({ success:true, botName: botInfo.first_name });

  } catch(e) {
    console.error("Login error:", e.message);
    res.json({ success:false, message:"Network error. Try again." });
  }
});

app.post("/admin/logout", (req, res) => {
  const sid = req.cookies?.sid;
  if (sid) sessions.delete(sid);
  res.setCookie("sid", "", { maxAge:0 });
  res.json({ success:true });
});

app.get("/admin/me", (req, res) => {
  const s = getSession(req);
  if (!s) return res.json({ loggedIn:false });
  res.json({ loggedIn:true, botName: s.botInfo?.first_name, adminId: s.adminId });
});

// ══════════════════════════════════════════════
// ADMIN DATA
// ══════════════════════════════════════════════

app.get("/admin/payments", requireAuth, async (req, res) => {
  const s = getSession(req);
  const { status="all", page=1 } = req.query;
  const limit = 20, skip = (parseInt(page)-1)*limit;

  const payments = col("payments");
  if (!payments) return res.json({ payments:[], total:0, pages:1 });

  const filter = { admin_id: s.adminId };
  if (status !== "all") filter.status = status;

  const [list, total] = await Promise.all([
    payments.find(filter).sort({ createdAt:-1 }).skip(skip).limit(limit).toArray(),
    payments.countDocuments(filter)
  ]);

  res.json({ payments:list, total, page:parseInt(page), pages:Math.ceil(total/limit)||1 });
});

app.get("/admin/stats", requireAuth, async (req, res) => {
  const s = getSession(req);
  const payments = col("payments");
  if (!payments) return res.json({ total:0, pending:0, confirmed:0, cancelled:0, volume:0 });

  const [total, pending, confirmed, cancelled, vol] = await Promise.all([
    payments.countDocuments({ admin_id:s.adminId }),
    payments.countDocuments({ admin_id:s.adminId, status:"pending" }),
    payments.countDocuments({ admin_id:s.adminId, status:"confirmed" }),
    payments.countDocuments({ admin_id:s.adminId, status:"cancelled" }),
    payments.aggregate([
      { $match:{ admin_id:s.adminId, status:"confirmed" } },
      { $group:{ _id:null, t:{ $sum:{ $toDouble:"$amount" } } } }
    ]).toArray()
  ]);

  res.json({ total, pending, confirmed, cancelled, volume: vol[0]?.t||0 });
});

async function updateStatus(req, res, newStatus) {
  const s = getSession(req);
  const payments = col("payments");
  if (!payments) return res.json({ success:false });

  const rec = await payments.findOne({ _id: new ObjectId(req.params.id), admin_id: s.adminId });
  if (!rec) return res.json({ success:false, message:"Not found." });

  await payments.updateOne(
    { _id: rec._id },
    { $set:{ status: newStatus, [`${newStatus}At`]: new Date() } }
  );

  // Notify user
  const bots = col("bots");
  let botToken = null;
  if (bots) {
    const b = await bots.findOne({ adminId: s.adminId });
    if (b) botToken = b.botToken;
  }

  if (botToken && rec.userId) {
    const isConfirm = newStatus === "confirmed";
    const text = isConfirm
      ? `✅ *Payment Confirmed!*\n\n📋 Invoice: \`${rec.invoice_id}\`\n💰 Amount: \`${rec.amount} USDT\`\n🧾 Order: \`${rec.order_id}\`\n\nYour deposit has been verified!`
      : `❌ *Payment Cancelled*\n\n📋 Invoice: \`${rec.invoice_id}\`\n💰 Amount: \`${rec.amount} USDT\`\n\nYour payment could not be verified. Please contact support.`;
    await tgSend(botToken, rec.userId, text);
  }

  res.json({ success:true });
}

app.post("/admin/payments/:id/confirm", requireAuth, (req, res) => updateStatus(req, res, "confirmed"));
app.post("/admin/payments/:id/cancel",  requireAuth, (req, res) => updateStatus(req, res, "cancelled"));

// ── Page routes ───────────────────────────────
app.get("/admin",   (req, res) => res.sendFile(path.join(__dirname, "admin.html")));
app.get("/receipt", (req, res) => res.sendFile(path.join(__dirname, "receipt.html")));
app.get("/",        (req, res) => res.sendFile(path.join(__dirname, "index.html")));
app.get("*",        (req, res) => res.sendFile(path.join(__dirname, "index.html")));

// ── Start ─────────────────────────────────────
connectDB().then(() => app.listen(PORT, () => console.log(`✅ Server on port ${PORT}`)));
