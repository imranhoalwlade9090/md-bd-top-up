const products = [
  {name:"Free Fire Diamonds", desc:"Diamonds & memberships", price:30, category:"gaming", tag:"BESTSELLER", visual:"visual-freefire", mark:"FF", logo:"https://www.google.com/s2/favicons?domain=ff.garena.com&sz=128", logoName:"Free Fire", package:"25 Diamonds"},
  {name:"PUBG Mobile UC", desc:"UC top-up packages", price:120, category:"gaming", tag:"POPULAR", visual:"visual-pubg", mark:"UC", logo:"https://cdn.simpleicons.org/pubg/e3c026", logoName:"PUBG Mobile", package:"60 UC"},
  {name:"CapCut Pro", desc:"Premium creative tools", price:null, category:"subscription", tag:"AVAILABLE", visual:"visual-sub", mark:"CC", logo:"https://www.google.com/s2/favicons?domain=capcut.com&sz=128", logoName:"CapCut", package:"Choose a package"},
  {name:"Spotify Premium", desc:"Music without limits", price:null, category:"subscription", tag:"AVAILABLE", visual:"visual-sub", mark:"♫", logo:"https://cdn.simpleicons.org/spotify/1ed760", logoName:"Spotify", package:"Choose a package"},
  {name:"TikTok Coins", desc:"Recharge your balance", price:160, category:"tiktok", tag:"POPULAR", visual:"visual-tiktok", mark:"♪", logo:"https://cdn.simpleicons.org/tiktok/000000", logoName:"TikTok", package:"60 Coins"},
  {name:"Facebook Boost", desc:"Legitimate promotion", price:170, category:"social", tag:"PROMOTE", visual:"visual-social", mark:"f", logo:"https://cdn.simpleicons.org/facebook/0866ff", logoName:"Facebook", package:"1 Boost"},
  {name:"YouTube Boost", desc:"Promote your content", price:1300, category:"social", tag:"PROMOTE", visual:"visual-social", mark:"▶", logo:"https://cdn.simpleicons.org/youtube/ff0000", logoName:"YouTube", package:"1 Boost"},
  {name:"Instagram Boost", desc:"Reach more people", price:800, category:"social", tag:"PROMOTE", visual:"visual-social", mark:"◎", logo:"https://cdn.simpleicons.org/instagram/e4405f", logoName:"Instagram", package:"1 Boost"}
];
const packageOptions = {
  "Free Fire Diamonds": [["25 Diamonds",30],["50 Diamonds",40],["115 Diamonds",85],["240 Diamonds",163],["355 Diamonds",243],["480 Diamonds",321],["505 Diamonds",345],["610 Diamonds",405],["725 Diamonds",485],["1,240 Diamonds",805],["2,530 Diamonds",1615],["5,060 Diamonds",3225],["7,590 Diamonds",4835],["10,120 Diamonds",6445],["12,650 Diamonds",8055],["Weekly Lite",45],["4X Weekly Lite",165],["Weekly Membership",163],["Monthly Membership",795]],
  "PUBG Mobile UC": [["60 UC",120],["120 UC",240],["180 UC",370],["240 UC",475],["325 UC",610],["385 UC",730],["660 UC",1215],["720 UC",1340],["985 UC",1825],["1,800 UC",3000],["3,850 UC",6000],["8,100 UC",12165],["16,200 UC",24325]],
  "CapCut Pro": [["Monthly Plan",1330],["Yearly Plan",7730],["One-Year Plan",10130],["Monthly Teams Plan",1630]],
  "TikTok Coins": [["60 Coins",160],["100 Coins",250],["200 Coins",440],["300 Coins",1200],["500 Coins",1430],["1,000 Coins",1920]]
};
const accountInfoFields = {
  TikTok: [
    ["accountUsername", "TikTok username", "e.g. @yourusername", true],
    ["profileUrl", "TikTok profile URL", "https://www.tiktok.com/@", true],
    ["whatsapp", "WhatsApp number", "01XXXXXXXXX", true]
  ],
  Facebook: [
    ["accountUsername", "Facebook username or page name", "Your username or page name", true],
    ["profileUrl", "Facebook profile or page URL", "https://www.facebook.com/...", true],
    ["whatsapp", "WhatsApp number", "01XXXXXXXXX", true]
  ],
  YouTube: [
    ["channelUrl", "YouTube channel URL", "https://www.youtube.com/...", true],
    ["accountUsername", "Channel handle", "e.g. @yourchannel", false],
    ["whatsapp", "WhatsApp number", "01XXXXXXXXX", true]
  ],
  Instagram: [
    ["accountUsername", "Instagram username", "e.g. @yourusername", true],
    ["profileUrl", "Instagram profile URL", "https://www.instagram.com/...", true],
    ["whatsapp", "WhatsApp number", "01XXXXXXXXX", true]
  ],
  CapCut: [
    ["accountUsername", "CapCut username or account ID", "Your CapCut username or ID", true],
    ["profileUrl", "CapCut profile URL", "Paste your CapCut profile URL", false],
    ["whatsapp", "WhatsApp number", "01XXXXXXXXX", true]
  ]
};
const accountPlatformForProduct = (product) => {
  if (product.name === "TikTok Coins") return "TikTok";
  if (product.name === "Facebook Boost") return "Facebook";
  if (product.name === "YouTube Boost") return "YouTube";
  if (product.name === "Instagram Boost") return "Instagram";
  if (product.name === "CapCut Pro") return "CapCut";
  return "";
};
const accountInfoMarkup = (platform) => {
  const fields = accountInfoFields[platform];
  if (!fields) return "";
  return `<div class="field full"><label for="accountType">Account type</label><select id="accountType" name="accountType">${Object.keys(accountInfoFields).map((type) => `<option value="${type}"${type === platform ? " selected" : ""}>${type}</option>`).join("")}</select></div><div class="field full"><span class="section-label">ACCOUNT INFO</span><p class="modal-lead">Provide only public account details. We never ask for your social media password.</p><div id="accountFields">${accountFieldsMarkup(platform)}</div></div>`;
};
const accountFieldsMarkup = (platform) => accountInfoFields[platform].map(([name, label, placeholder, required]) => `<div class="field"><label for="${name}">${label}${required ? " *" : ""}</label><input id="${name}" name="account_${name}"${required ? " required" : ""} placeholder="${placeholder}"></div>`).join("");

const grid = document.getElementById("productGrid");
const modalBackdrop = document.getElementById("modalBackdrop");
const modalContent = document.getElementById("modalContent");
const money = (value) => value === null ? "Custom" : `৳${value.toLocaleString("en-BD")}`;
const productLogo = (product, className = "visual-mark") => `<img class="${className}" src="${product.logo}" alt="${product.logoName} logo" onerror="this.replaceWith(document.createTextNode('${product.mark}'))">`;
const submittedTransactions = new Set();
const activeOrders = new Map();
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#039;"
}[character]));

function renderProducts(filter = "all") {
  const visible = filter === "all" ? products : products.filter((p) => p.category === filter);
  grid.innerHTML = visible.map((p) => `<article class="product-card">
    <div class="product-visual ${p.visual}"><span class="product-tag">${p.tag}</span>${productLogo(p)}</div>
    <div class="product-info"><h3>${p.name}</h3><p>${p.desc}</p><div class="product-bottom"><span class="price">${money(p.price)} ${p.price ? '<small>from</small>' : ''}</span><button class="add-btn" data-product="${p.name}" aria-label="Order ${p.name}" type="button">+</button></div></div>
  </article>`).join("");
  grid.querySelectorAll(".add-btn").forEach((button) => button.addEventListener("click", () => openCheckout(products.find((p) => p.name === button.dataset.product))));
}

function openModal(content) {
  modalContent.innerHTML = content;
  modalBackdrop.classList.add("open");
  modalBackdrop.setAttribute("aria-hidden", "false");
}
function closeModal() {
  modalBackdrop.classList.remove("open");
  modalBackdrop.setAttribute("aria-hidden", "true");
}
function openCheckout(product) {
  const price = product.price ? money(product.price) : "Custom package";
  const options = packageOptions[product.name];
  const accountPlatform = accountPlatformForProduct(product);
  const packageField = options ? `<div class="field full"><label for="package">Select package</label><select id="package" name="package">${options.map(([label, value]) => `<option value="${value}">${label} — ${money(value)}</option>`).join("")}</select></div>` : "";
  const accountField = accountPlatform ? accountInfoMarkup(accountPlatform) : `<div class="field full"><label for="playerId">${product.category === "social" ? "Service URL or username" : "Player ID / UID"}</label><input id="playerId" name="playerId" required placeholder="${product.category === "social" ? "Paste the public post, page or video URL" : "Enter your game ID"}"></div>`;
  openModal(`<span class="section-label">SECURE CHECKOUT</span><h2 id="modalTitle">Order ${product.name}</h2><p class="modal-lead">We never ask for your account password or payment PIN.</p>
    <div class="checkout-product"><div class="mini-visual ${product.visual}">${productLogo(product)}</div><div><b>${options ? options[0][0] : product.package}</b><small id="selectedPrice">${price} · Manual verification</small></div></div>
    <form id="checkoutForm"><div class="form-grid">${packageField}<div class="field"><label for="customerName">Customer name</label><input id="customerName" name="customerName" required autocomplete="name" placeholder="Your full name"></div><div class="field"><label for="email">Email address</label><input id="email" name="email" required type="email" autocomplete="email" placeholder="you@example.com"></div><div class="field"><label for="phone">Mobile number</label><input id="phone" name="phone" required type="tel" autocomplete="tel" placeholder="01XXXXXXXXX"></div>${accountField}<div class="field full"><label for="orderDescription">Order notes</label><textarea id="orderDescription" name="orderDescription" rows="3" placeholder="Add any instructions or reference links"></textarea></div><div class="field"><label for="payment">Payment method</label><select id="payment" name="payment"><option>bKash</option><option>Nagad</option><option>Sun Money</option></select></div><div class="field"><label for="trx">Transaction ID</label><input id="trx" name="trx" required placeholder="e.g. 8N7A2..."></div></div><div class="payment-note">Send <strong id="paymentAmount">${price}</strong> to merchant number <strong>01728 557 709</strong>, then enter your transaction ID. Your order stays pending until verified by our team.</div><button class="button submit-order" type="submit">Review order <span>→</span></button></form>`);
  if (accountPlatform) document.getElementById("accountType").addEventListener("change", (event) => {
    document.getElementById("accountFields").innerHTML = accountFieldsMarkup(event.target.value);
  });
  if (options) document.getElementById("package").addEventListener("change", (event) => {
    const selected = options.find((option) => String(option[1]) === event.target.value);
    document.getElementById("selectedPrice").textContent = `${money(selected[1])} · Manual verification`;
    document.getElementById("paymentAmount").textContent = money(selected[1]);
  });
  document.getElementById("checkoutForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const order = {
      product,
      packageName: options ? options.find((option) => String(option[1]) === form.get("package"))[0] : product.package,
      amount: options ? Number(form.get("package")) : product.price,
      customerName: form.get("customerName"),
      email: form.get("email"),
      phone: form.get("phone"),
      playerId: form.get("playerId"),
      accountType: form.get("accountType"),
      accountInfo: accountPlatform ? Object.fromEntries([...form.entries()]
        .filter(([name]) => name.startsWith("account_"))
        .map(([name, value]) => [name.replace("account_", ""), value])) : null,
      description: form.get("orderDescription"),
      payment: form.get("payment"),
      transactionId: String(form.get("trx")).trim()
    };
    const duplicateKey = `${order.phone}|${order.transactionId}`.toLowerCase();
    if (submittedTransactions.has(duplicateKey)) {
      openModal(`<div class="track-result"><span class="status-pill">Already submitted</span><p class="modal-lead">This transaction has already been submitted in this session. Please track the existing order instead of creating a duplicate.</p></div>`);
      return;
    }
    openOrderReview(order, duplicateKey);
  });
}
function openOrderReview(order, duplicateKey) {
  const orderSummary = [
    ["Service", order.product.name],
    ["Package", order.packageName],
    ["Amount", money(order.amount)],
    ["Customer", order.customerName],
    ["Email", order.email],
    ...(order.accountInfo ? [["Account type", order.accountType]] : [["Account or URL", order.playerId]]),
    ...(order.description ? [["Order notes", order.description]] : []),
    ["Payment", order.payment],
    ["Transaction ID", order.transactionId]
  ].map(([label, value]) => `<div class="track-result"><small>${label}</small><strong>${escapeHtml(value || "Not provided")}</strong></div>`).join("");
  const accountSummary = order.accountInfo ? Object.entries(order.accountInfo)
    .filter(([, value]) => value)
    .map(([label, value]) => `<div class="track-result"><small>${escapeHtml(label.replace(/([A-Z])/g, " $1").replace(/^./, (character) => character.toUpperCase()))}</small><strong>${escapeHtml(value)}</strong></div>`).join("") : "";
  openModal(`<span class="section-label">REVIEW ORDER</span><h2 id="modalTitle">Check your details</h2><p class="modal-lead">Confirm the information below before submitting. We never store or request account passwords.</p><div class="order-summary">${orderSummary}${accountSummary ? `<span class="section-label">ACCOUNT INFO</span>${accountSummary}` : ""}</div><div class="payment-note">Payment remains <strong>Pending</strong> until verified by the payment provider or merchant team. This browser cannot verify payments.</div><div class="hero-actions"><button class="button button-quiet" id="editOrder" type="button">← Edit details</button><button class="button submit-order" id="confirmOrder" type="button">Confirm order <span>→</span></button></div>`);
  document.getElementById("editOrder").addEventListener("click", () => openCheckout(order.product));
  document.getElementById("confirmOrder").addEventListener("click", async () => {
    const button = document.getElementById("confirmOrder");
    button.disabled = true;
    button.textContent = "Submitting…";
    try {
      const token = await MBAuth.token();
      if (!token) {
        location.href = `auth.html?return=${encodeURIComponent(location.pathname + location.search)}`;
        return;
      }
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {"Content-Type": "application/json", "Authorization": "Bearer " + token},
        body: JSON.stringify({
          customerName: order.customerName,
          email: order.email,
          phone: order.phone,
          productName: order.product.name,
          packageName: order.packageName,
          amount: order.amount,
          payment: order.payment,
          transactionId: order.transactionId,
          accountType: order.accountType,
          accountInfo: order.accountInfo,
          description: order.description
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to submit order");
      submittedTransactions.add(duplicateKey);
      activeOrders.set(result.orderId, {...order, orderId: result.orderId, status: result.orderStatus, paymentStatus: result.paymentStatus});
      openModal(`<div class="success-box"><div class="success-mark">✓</div><span class="section-label">ORDER RECEIVED</span><h2>You're all set.</h2><p>Your order was saved successfully. Payment remains pending until verified by the admin or a future official payment gateway.</p><div class="order-id">${escapeHtml(result.orderId)}</div><p>Save this Order ID to track your order status.</p><button class="button submit-order" id="successTrack" type="button">Track this order <span>→</span></button></div>`);
      document.getElementById("successTrack").addEventListener("click", () => openTracker(result.orderId));
    } catch (error) {
      button.disabled = false;
      button.innerHTML = "Confirm order <span>→</span>";
      openModal(`<div class="track-result"><span class="status-pill">Submission failed</span><p class="modal-lead">${escapeHtml(error.message)}. No order was created.</p><button class="button button-quiet" id="retryOrder" type="button">Return to review</button></div>`);
      document.getElementById("retryOrder").addEventListener("click", () => openOrderReview(order, duplicateKey));
    }
  });
}
function openTracker(prefill = "") {
  openModal(`<span class="section-label">ORDER STATUS</span><h2 id="modalTitle">Track your order</h2><p class="modal-lead">Enter your Order ID to see the latest update.</p><div class="field"><label for="orderId">Order ID</label><input id="orderId" value="${escapeHtml(prefill)}" placeholder="e.g. MB12345678"></div><button class="button submit-order" id="trackSubmit" type="button">Check status <span>→</span></button><div id="trackResult"></div>`);
  document.getElementById("trackSubmit").addEventListener("click", async () => {
    const id = document.getElementById("orderId").value.trim();
    const order = activeOrders.get(id);
    if (!id) {
      document.getElementById("trackResult").innerHTML = `<div class="track-result"><p class="modal-lead">Please enter your Order ID to continue.</p></div>`;
      return;
    }
    if (order) {
      document.getElementById("trackResult").innerHTML = `<div class="track-result"><span class="status-pill">${escapeHtml(order.paymentStatus)}</span><p class="modal-lead">Order <strong>${escapeHtml(id)}</strong> for ${escapeHtml(order.product.name)} is received and waiting for payment verification.</p></div>`;
      return;
    }
    try {
      const token = await MBAuth.token();
      if (!token) throw new Error("Sign in to track your orders");
      const response = await fetch(`/api/orders/${encodeURIComponent(id)}`, {headers: {"Authorization": "Bearer " + token}});
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Order not found");
      document.getElementById("trackResult").innerHTML = `<div class="track-result"><span class="status-pill">${escapeHtml(result.payment_status)}</span><p class="modal-lead">Order <strong>${escapeHtml(result.id)}</strong> for ${escapeHtml(result.product_name)} is currently ${escapeHtml(result.order_status)}.</p></div>`;
    } catch (error) {
      document.getElementById("trackResult").innerHTML = `<div class="track-result"><p class="modal-lead">${escapeHtml(error.message)}.</p></div>`;
    }
  });
}

document.querySelectorAll("[data-category]").forEach((tab) => tab.addEventListener("click", () => {
  document.querySelectorAll("[data-category]").forEach((item) => item.classList.remove("active"));
  tab.classList.add("active");
  renderProducts(tab.dataset.category);
}));
document.getElementById("modalClose").addEventListener("click", closeModal);
modalBackdrop.addEventListener("click", (event) => { if (event.target === modalBackdrop) closeModal(); });
document.getElementById("trackBtn").addEventListener("click", () => openTracker());
document.getElementById("heroTrack").addEventListener("click", () => openTracker());
document.getElementById("footerTrack").addEventListener("click", (event) => { event.preventDefault(); openTracker(); });
document.getElementById("menuBtn").addEventListener("click", () => document.getElementById("mobileMenu").classList.toggle("open"));
document.getElementById("langBtn").addEventListener("click", (event) => { event.currentTarget.innerHTML = event.currentTarget.innerText.includes("বাংলা") ? "English <span>বাংলা</span>" : "বাংলা <span>EN</span>"; });
renderProducts();
