/* =============================================
   Binance Invoice Page — script.js

   URL FORMAT:
   /?amount=50&bot_name=MyBot&uid=123456789&admin=TELEGRAM_CHAT_ID&invoice_id=INV-001

   Parameters:
   - amount      : USDT amount (required)
   - bot_name    : Bot display name
   - uid         : Binance UID (shown on page)
   - admin       : Telegram chat_id (HIDDEN — never shown on page)
   - invoice_id  : Optional, auto-generated if missing
   ============================================= */

// ── Parse URL params ──────────────────────────
function getParams() {
  const p = new URLSearchParams(window.location.search);
  return {
    amount:    p.get("amount")     || "0.00",
    botName:   p.get("bot_name")   || "PayBot",
    uid:       p.get("uid")        || "N/A",
    adminId:   p.get("admin")      || "",       // hidden from UI
    invoiceId: p.get("invoice_id") || generateInvoiceId(),
userId: p.get("user_id") || "",
  username: p.get("username") || ""
  };
}

function generateInvoiceId() {
  return "BN" +
    Math.random().toString(36)
    .substring(2, 8)
    .toUpperCase();
}

// ── Render page ───────────────────────────────
function renderPage() {
  const p = getParams();
  document.getElementById("botName").textContent    = p.botName;
  document.title                                    = `Invoice — ${p.botName}`;
  document.getElementById("invoiceId").textContent  = p.invoiceId;
  document.getElementById("binanceUID").textContent = p.uid;

  const amt = parseFloat(p.amount);
  const displayAmt = isNaN(amt) ? "0.00" : amt.toFixed(2);
  document.getElementById("amountDisplay").textContent = displayAmt; document.getElementById("amountStep").textContent    = `${displayAmt} USDT`;
}

// ── Copy UID ──────────────────────────────────
function copyUID() {
  const uid = document.getElementById("binanceUID").textContent;
  if (!uid || uid === "N/A") { showToast("No UID available", "error"); return; }

  navigator.clipboard.writeText(uid).then(() => {
    const btn = document.getElementById("copyUidBtn");
    btn.classList.add("copied");
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg> Copied!`;
    showToast("UID copied!", "success");
    setTimeout(() => {
      btn.classList.remove("copied");
      btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg> Copy`;
    }, 2500);
  }).catch(() => {
    const el = document.createElement("textarea");
    el.value = uid; document.body.appendChild(el); el.select();
    document.execCommand("copy"); document.body.removeChild(el);
    showToast("UID copied!", "success");
  });
}

// ── Validate Binance Order ID ─────────────────
// Real Binance Order IDs are exactly 18 digits
// and are NOT simple sequential patterns like 123456789012345678
function validateOrderId(id) {
  // Must be exactly 18 digits
  if (!/^\d{18}$/.test(id)) {
    return { valid: false, msg: "Order ID must be exactly 18 digits." };
  }

  // Reject obvious fake patterns
  // 1) All same digit: 111111111111111111
  if (/^(\d)\1{17}$/.test(id)) {
    return { valid: false, msg: "Invalid Order ID. Please check again." };
  }

  // 2) Simple ascending sequence: 123456789012345678
  const digits = id.split("").map(Number);
  let ascending = true, descending = true;
  for (let i = 1; i < digits.length; i++) {
    if (digits[i] !== (digits[i-1] + 1) % 10) ascending = false;
    if (digits[i] !== (digits[i-1] - 1 + 10) % 10) descending = false;
  }
  if (ascending || descending) {
    return { valid: false, msg: "Invalid Order ID. This looks like a test number." };
  }

  // 3) Too many repeated digit pairs (e.g. 112233445566778899)
  let pairCount = 0;
  for (let i = 0; i < digits.length - 1; i += 2) {
    if (digits[i] === digits[i+1]) pairCount++;
  }
  if (pairCount >= 7) {
    return { valid: false, msg: "Invalid Order ID. This doesn't look like a real Binance Order ID." };
  }

  // 4) Simple repeating block e.g. 123456123456123456
  const half = id.slice(0, 9);
  if (id === half + half.slice(0,9)) {
    return { valid: false, msg: "Invalid Order ID. This doesn't look like a real Binance Order ID." };
  }

  return { valid: true };
}

// ── Verify Payment ────────────────────────────
async function verifyPayment() {
  const orderId = document.getElementById("txnInput").value.trim();
  const btn     = document.querySelector(".verify-btn");
  const p       = getParams();

  // Validate first
  const check = validateOrderId(orderId);
  if (!check.valid) {
    showToast(check.msg, "error");
    shakeInput();
    return;
  }

  // Loading state
  btn.classList.add("loading");
  btn.querySelector(".btn-text").textContent = "Submitting...";

  try {
    const res = await fetch("/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        order_id:   orderId,
        amount:     p.amount,
        uid:        p.uid,
        admin_id:   p.adminId,
        invoice_id: p.invoiceId,
        userId: p.userId,
  username: p.username,
        bot_name:   p.botName
      })
    });

    const data = await res.json();

    if (data.success) {
      btn.classList.remove("loading");
      btn.classList.add("success");
      btn.querySelector(".btn-text").textContent = "Submitted!";
      showToast("Order ID submitted successfully!", "success");
    } else {
      btn.classList.remove("loading");
      btn.querySelector(".btn-text").textContent = "Verify Payment";
      showToast(data.message || "Submission failed. Try again.", "error");
    }
  } catch (err) {
    btn.classList.remove("loading");
    btn.querySelector(".btn-text").textContent = "Verify Payment";
    showToast("Network error. Please try again.", "error");
  }
}

// ── Shake input on error ──────────────────────
function shakeInput() {
  const input = document.getElementById("txnInput");
  input.style.borderColor = "#F6465D";
  input.style.boxShadow   = "0 0 0 3px rgba(246,70,93,0.15)";
  input.animate([
    { transform: "translateX(0)" },
    { transform: "translateX(-6px)" },
    { transform: "translateX(6px)" },
    { transform: "translateX(-4px)" },
    { transform: "translateX(4px)" },
    { transform: "translateX(0)" },
  ], { duration: 350, easing: "ease-in-out" });
  setTimeout(() => { input.style.borderColor = ""; input.style.boxShadow = ""; }, 1800);
}

// ── Toast ─────────────────────────────────────
let toastTimer = null;
function showToast(message, type = "success") {
  let toast = document.querySelector(".toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "toast";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.className   = `toast ${type}`;
  if (toastTimer) clearTimeout(toastTimer);
  requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add("show")));
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3500);
}

// ── Init ──────────────────────────────────────
document.addEventListener("DOMContentLoaded", renderPage);
        
