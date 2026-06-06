function getParams() {
  const p = new URLSearchParams(window.location.search);
  return {
    amount:    p.get("amount")     || "0.00",
    botName:   p.get("bot_name")   || "PayBot",
    uid:       p.get("uid")        || "N/A",
    adminId:   p.get("admin")      || "",
    invoiceId: p.get("invoice_id") || ("BP" + Math.floor(10000000 + Math.random()*90000000)),
    userId:    p.get("user_id")    || "",
    username:  p.get("username")   || "",
  };
}

function renderPage() {
  const p = getParams();
  document.getElementById("botName").textContent    = p.botName;
  document.getElementById("invoiceId").textContent  = p.invoiceId;
  document.getElementById("binanceUID").textContent = p.uid;
  document.title = "Invoice — " + p.botName;
  const amt = parseFloat(p.amount);
  const d   = isNaN(amt) ? "0.00" : amt.toFixed(2);
  document.getElementById("amountDisplay").textContent = d;
  document.getElementById("amountStep").textContent    = d + " USDT";
}

function copyUID() {
  const uid = document.getElementById("binanceUID").textContent;
  if (!uid || uid === "N/A") { showToast("No UID available", "error"); return; }
  navigator.clipboard.writeText(uid).then(() => {
    const btn = document.getElementById("copyUidBtn");
    btn.classList.add("copied");
    btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg> Copied!`;
    showToast("UID copied!", "success");
    setTimeout(() => {
      btn.classList.remove("copied");
      btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg> Copy`;
    }, 2500);
  }).catch(() => {
    const el = document.createElement("textarea");
    el.value = uid; document.body.appendChild(el); el.select();
    document.execCommand("copy"); document.body.removeChild(el);
    showToast("UID copied!", "success");
  });
}

function validateOrderId(id) {
  if (!/^\d{18}$/.test(id))
    return { valid:false, msg:"Order ID must be exactly 18 digits." };
  if (/^(\d)\1{17}$/.test(id))
    return { valid:false, msg:"Invalid Order ID. Please check again." };
  const d = id.split("").map(Number);
  let asc = true, dsc = true;
  for (let i=1;i<d.length;i++) {
    if (d[i] !== (d[i-1]+1)%10) asc = false;
    if (d[i] !== (d[i-1]-1+10)%10) dsc = false;
  }
  if (asc||dsc) return { valid:false, msg:"Invalid Order ID. Looks like a test number." };
  let pairs = 0;
  for (let i=0;i<d.length-1;i+=2) if(d[i]===d[i+1]) pairs++;
  if (pairs>=7) return { valid:false, msg:"Invalid Order ID. Doesn't look real." };
  return { valid:true };
}

async function verifyPayment() {
  const orderId = document.getElementById("txnInput").value.trim();
  const btn     = document.querySelector(".verify-btn");
  const p       = getParams();

  const chk = validateOrderId(orderId);
  if (!chk.valid) { showToast(chk.msg, "error"); shakeInput(); return; }

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
        bot_name:   p.botName,
        userId:     p.userId,
        username:   p.username,
      })
    });
    const data = await res.json();
    btn.classList.remove("loading");

    if (data.success) {
      btn.classList.add("success");
      btn.querySelector(".btn-text").textContent = "Submitted ✓";
      // Redirect to receipt with all info
      setTimeout(() => {
        const rp = new URLSearchParams({
          amount:     p.amount,
          bot_name:   p.botName,
          uid:        p.uid,
          invoice_id: data.invoice_id || p.invoiceId,
          order_id:   data.order_id   || orderId,
        });
        window.location.href = "/receipt?" + rp.toString();
      }, 700);
    } else {
      btn.querySelector(".btn-text").textContent = "Confirm Payment";
      showToast(data.message || "Failed. Try again.", "error");
    }
  } catch(e) {
    btn.classList.remove("loading");
    btn.querySelector(".btn-text").textContent = "Confirm Payment";
    showToast("Network error. Try again.", "error");
  }
}

function shakeInput() {
  const el = document.getElementById("txnInput");
  el.style.borderColor = "#DC2626";
  el.style.boxShadow   = "0 0 0 3px rgba(220,38,38,0.12)";
  el.animate([
    {transform:"translateX(0)"},{transform:"translateX(-6px)"},
    {transform:"translateX(6px)"},{transform:"translateX(-4px)"},
    {transform:"translateX(4px)"},{transform:"translateX(0)"},
  ],{duration:350,easing:"ease-in-out"});
  setTimeout(()=>{el.style.borderColor="";el.style.boxShadow="";},1800);
}

let _tt = null;
function showToast(msg, type="success") {
  let t = document.querySelector(".toast");
  if (!t) { t=document.createElement("div"); t.className="toast"; document.body.appendChild(t); }
  t.textContent = msg; t.className = "toast " + type;
  if(_tt) clearTimeout(_tt);
  requestAnimationFrame(()=>requestAnimationFrame(()=>t.classList.add("show")));
  _tt = setTimeout(()=>t.classList.remove("show"), 3500);
}

document.addEventListener("DOMContentLoaded", renderPage);
