const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());

// Root folder serve করবে
app.use(express.static(__dirname));


const submittedOrders = new Set();

app.post("/verify", async (req, res) => {

  const {
    order_id,
    amount,
    uid,
    admin_id,
    invoice_id,
    bot_name,
    userId,
    username
  } = req.body;

  
  if (!order_id || !/^\d{18}$/.test(order_id)) {
    return res.json({ success: false, message: "Invalid Order ID format." });
  }

  if (!admin_id) {
    return res.json({ success: false, message: "Admin ID missing." });
  }

if(submittedOrders.has(order_id)){
    return res.json({
      success:false,
      message:"Deposit request already submitted"
    });
  }

  submittedOrders.add(order_id);

  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    return res.json({
      success: false,
      message: "TELEGRAM_BOT_TOKEN not set"
    });
  }

  const text =
`🔔 New Payment Submission

🤖 Bot: ${bot_name || "N/A"}
👤 Username: @${username || "NoUsername"}
🆔 User ID: ${userId || "N/A"}

📋 Invoice: ${invoice_id || "N/A"}
💰 Amount: ${amount} USDT
💳 Binance UID: ${uid}
🧾 Order ID: ${order_id}`;

  try {

    const tgRes = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          chat_id: admin_id,
          text: text
        })
      }
    );

    const tgData = await tgRes.json();

    if (tgData.ok) {
      return res.json({ success: true });
    }

    return res.json({
      success: false,
      message: "Telegram send failed"
    });

  } catch (e) {

    console.log(e);

    return res.json({
      success: false,
      message: "Server error"
    });

  }
});

// Homepage
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Any route
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  console.log("✅ Server running on port " + PORT);
});