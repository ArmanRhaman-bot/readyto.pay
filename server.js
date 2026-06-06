<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Payment Receipt</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet"/>
  <style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --or:#F97316;--bg:#FFF7F0;--card:#fff;--border:#FFE4CC;
  --text:#1A1A1A;--muted:#78716C;--green:#16A34A;--red:#DC2626;--yellow:#D97706;
  --sans:'Inter',sans-serif;--mono:'JetBrains Mono',monospace;
}
body{font-family:var(--sans);background:var(--bg);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}

.wrap{width:100%;max-width:400px}
.card{
  background:var(--card);border:1px solid var(--border);border-radius:24px;overflow:hidden;
  box-shadow:0 20px 60px rgba(249,115,22,.1);
  animation:up .6s cubic-bezier(.16,1,.3,1) both;
}
@keyframes up{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}

/* Header */
.rcpt-header{
  background:linear-gradient(160deg,#FFF7ED,#FFEDD5);
  border-bottom:1px solid var(--border);
  padding:28px 20px 20px;text-align:center;
}
.icon-wrap{
  width:68px;height:68px;border-radius:50%;
  display:flex;align-items:center;justify-content:center;
  margin:0 auto 14px;
  animation:pop .5s cubic-bezier(.16,1,.3,1) .15s both;
  transition:background .5s,box-shadow .5s;
}
@keyframes pop{from{transform:scale(.4);opacity:0}to{transform:scale(1);opacity:1}}
.icon-wrap.pending  {background:linear-gradient(135deg,#D97706,#F59E0B);box-shadow:0 8px 24px rgba(217,119,6,.35)}
.icon-wrap.confirmed{background:linear-gradient(135deg,#16A34A,#22C55E);box-shadow:0 8px 24px rgba(22,163,74,.35)}
.icon-wrap.cancelled{background:linear-gradient(135deg,#DC2626,#EF4444);box-shadow:0 8px 24px rgba(220,38,38,.35)}
.icon-wrap svg{color:#fff;transition:opacity .3s}

.rcpt-title{font-size:20px;font-weight:900;margin-bottom:4px;transition:color .3s}
.rcpt-sub{font-size:13px;color:var(--muted)}

/* Status banner */
.status-banner{
  margin:14px 16px 0;padding:14px;
  border-radius:14px;border-width:1.5px;border-style:solid;
  display:flex;align-items:center;gap:12px;
  transition:background .5s,border-color .5s;
}
.status-banner.pending  {background:rgba(217,119,6,.07);border-color:rgba(217,119,6,.25)}
.status-banner.confirmed{background:rgba(22,163,74,.07); border-color:rgba(22,163,74,.25)}
.status-banner.cancelled{background:rgba(220,38,38,.07); border-color:rgba(220,38,38,.25)}

.s-icon{font-size:26px}
.s-title{font-size:14px;font-weight:800;transition:color .3s}
.s-title.pending  {color:var(--yellow)}
.s-title.confirmed{color:var(--green)}
.s-title.cancelled{color:var(--red)}
.s-desc{font-size:12px;color:var(--muted);margin-top:2px}

/* Poll indicator */
.poll-bar{
  height:3px;
  background:linear-gradient(90deg,var(--or),#FB923C);
  border-radius:2px;
  margin:0 16px;
  animation:pollAnim 2s ease-in-out infinite;
  transform-origin:left;
}
@keyframes pollAnim{0%,100%{opacity:.4;transform:scaleX(.3)}50%{opacity:1;transform:scaleX(1)}}
.poll-bar.hidden{display:none}

/* Amount */
.amount-banner{
  margin:14px 16px 0;
  background:linear-gradient(135deg,#F97316,#FB923C);
  border-radius:14px;padding:16px 20px;text-align:center;
  box-shadow:0 6px 20px rgba(249,115,22,.25);
}
.ab-lbl{font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,.75);margin-bottom:5px}
.ab-amt{font-family:var(--mono);font-size:34px;font-weight:700;color:#fff;letter-spacing:-1px}
.ab-unit{font-size:14px;font-weight:800;color:rgba(255,255,255,.8)}

/* Details */
.rcpt-section{padding:14px 16px}
.rcpt-row{
  display:flex;justify-content:space-between;align-items:center;
  padding:10px 0;border-bottom:1px solid var(--border);
}
.rcpt-row:last-child{border-bottom:none}
.rk{font-size:11px;font-weight:600;letter-spacing:.5px;color:var(--muted);text-transform:uppercase}
.rv{font-size:12px;font-weight:700;color:var(--text);text-align:right;max-width:220px;word-break:break-all}
.rv.mono{font-family:var(--mono)}

.status-pill{
  padding:3px 10px;border-radius:20px;font-size:11px;font-weight:800;
  transition:background .5s,color .5s;
}
.status-pill.pending  {background:rgba(217,119,6,.1);color:var(--yellow)}
.status-pill.confirmed{background:rgba(22,163,74,.1);color:var(--green)}
.status-pill.cancelled{background:rgba(220,38,38,.1);color:var(--red)}

.foot{
  display:flex;align-items:center;justify-content:space-between;
  padding:12px 20px;border-top:1px solid var(--border);
  font-size:11px;color:var(--muted);
}
.foot span{display:flex;align-items:center;gap:4px}
  </style>
</head>
<body>
<div class="wrap">
  <div class="card">
    <div class="rcpt-header">
      <div class="icon-wrap pending" id="iconWrap">
        <svg id="iconSvg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 6v6l4 2"/>
        </svg>
      </div>
      <h2 class="rcpt-title" id="rcptTitle">Submitted!</h2>
      <p class="rcpt-sub" id="rcptBotName">Awaiting admin review</p>
    </div>

    <!-- Status banner -->
    <div class="status-banner pending" id="statusBanner">
      <div class="s-icon" id="statusIcon">⏳</div>
      <div>
        <div class="s-title pending" id="statusTitle">Pending Verification</div>
        <div class="s-desc" id="statusDesc">Admin will verify your payment shortly</div>
      </div>
    </div>

    <!-- Polling progress bar (hidden when done) -->
    <div class="poll-bar" id="pollBar"></div>

    <!-- Amount -->
    <div class="amount-banner">
      <div class="ab-lbl">Amount Sent</div>
      <div><span class="ab-amt" id="rcptAmount">0.00</span> <span class="ab-unit">USDT</span></div>
    </div>

    <!-- Details -->
    <div class="rcpt-section">
      <div class="rcpt-row">
        <span class="rk">Invoice ID</span>
        <span class="rv mono" id="rcptInvoice">—</span>
      </div>
      <div class="rcpt-row">
        <span class="rk">Order ID</span>
        <span class="rv mono" id="rcptOrder">—</span>
      </div>
      <div class="rcpt-row">
        <span class="rk">Binance UID</span>
        <span class="rv mono" id="rcptUid">—</span>
      </div>
      <div class="rcpt-row">
        <span class="rk">Submitted</span>
        <span class="rv" id="rcptTime">—</span>
      </div>
      <div class="rcpt-row">
        <span class="rk">Status</span>
        <span class="rv status-pill pending" id="statusPill">⏳ PENDING</span>
      </div>
    </div>

    <div class="foot">
      <span>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="#22c55e"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5z"/></svg>
        Secured &amp; Encrypted
      </span>
      <span>Binance Pay</span>
    </div>
  </div>
</div>

<script>
const p = new URLSearchParams(location.search);
const orderId = p.get("order_id") || "";

// Render static info
document.getElementById("rcptBotName").textContent  = (p.get("bot_name")||"") + " — Payment Receipt";
document.getElementById("rcptAmount").textContent   = parseFloat(p.get("amount")||0).toFixed(2);
document.getElementById("rcptInvoice").textContent  = p.get("invoice_id") || "—";
document.getElementById("rcptOrder").textContent    = orderId || "—";
document.getElementById("rcptUid").textContent      = p.get("uid") || "—";
document.getElementById("rcptTime").textContent     = new Date().toLocaleString("en-BD",{timeZone:"Asia/Dhaka",hour12:true});
document.title = "Receipt — " + (p.get("bot_name")||"Payment");

// Status UI map
const STATUS_UI = {
  pending: {
    bannerClass:"pending", titleText:"Pending Verification",
    descText:"Admin will verify your payment shortly",
    icon:"⏳", pillText:"⏳ PENDING", pillClass:"pending",
    iconSvg:`<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>`,
    cardTitle:"Submitted!",
  },
  confirmed: {
    bannerClass:"confirmed", titleText:"Payment Confirmed!",
    descText:"Your deposit has been successfully verified",
    icon:"✅", pillText:"✅ CONFIRMED", pillClass:"confirmed",
    iconSvg:`<path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/>`,
    cardTitle:"Confirmed!",
  },
  cancelled: {
    bannerClass:"cancelled", titleText:"Payment Declined",
    descText:"This payment could not be verified. Contact support.",
    icon:"❌", pillText:"❌ DECLINED", pillClass:"cancelled",
    iconSvg:`<circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/>`,
    cardTitle:"Declined",
  },
};

let currentStatus = "pending";
let pollInterval  = null;

function applyStatus(st) {
  if (st === currentStatus && st === "pending") return; // no change
  currentStatus = st;
  const ui = STATUS_UI[st] || STATUS_UI.pending;

  // icon wrap
  const iw = document.getElementById("iconWrap");
  iw.className = "icon-wrap " + ui.bannerClass;
  document.getElementById("iconSvg").innerHTML = ui.iconSvg;

  // header title
  document.getElementById("rcptTitle").textContent = ui.cardTitle;

  // banner
  const banner = document.getElementById("statusBanner");
  banner.className = "status-banner " + ui.bannerClass;
  document.getElementById("statusIcon").textContent  = ui.icon;
  const stTitle = document.getElementById("statusTitle");
  stTitle.className = "s-title " + ui.bannerClass;
  stTitle.textContent = ui.titleText;
  document.getElementById("statusDesc").textContent  = ui.descText;

  // pill
  const pill = document.getElementById("statusPill");
  pill.className = "rv status-pill " + ui.pillClass;
  pill.textContent = ui.pillText;

  // stop polling if done
  if (st !== "pending") {
    document.getElementById("pollBar").classList.add("hidden");
    if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
  }
}

// ── Polling ───────────────────────────────────
async function checkStatus() {
  if (!orderId) return;
  try {
    const r = await fetch("/status/" + orderId);
    const d = await r.json();
    if (d.status && d.status !== currentStatus) {
      applyStatus(d.status);
    }
  } catch(e) { /* ignore network errors */ }
}

// Poll every 5 seconds while pending
if (orderId) {
  checkStatus(); // immediate first check
  pollInterval = setInterval(checkStatus, 5000);
}
</script>
</body>
</html>
