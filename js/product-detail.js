// ─────────────────────────────
// CONFIG & STATE
// ─────────────────────────────
const API_URL = 'https://script.google.com/macros/s/AKfycbwOeOaSAk2R6PMGAf1jBEHpRaR-hwCJu_UsMR2gxOJIiy4EY_QV1kDSp592Lo4N00ag/exec';

const params    = new URLSearchParams(location.search);
const productId = params.get('id');

let currentProduct = null;
let allProducts    = [];
let activeImg      = 0;
let currentQty     = 1;
let bannerIndex    = 0;
let selectedStars  = 0;

const promoMessages = [
  { text: 'FLAT 40% OFF on orders above ₹799 | Use Code', code: 'SUMMER40' },
  { text: 'FREE SHIPPING on orders above ₹339 | No code needed', code: null },
  { text: 'COD AVAILABLE · Easy Returns · Fresh Made Daily | Use Code', code: 'FIRST10' },
];
let promoIdx = 0;

// ─────────────────────────────
// BUNDLE SETTINGS
// ─────────────────────────────
function getBundleSettings() {
  const defaults = {
    offers: [
      { id:'duo',     enabled:true, title:'The Pair',       subtitle:'Any 2 pieces · 10% off', quantity:2, discountPct:10, badge:'' },
      { id:'bumper',  enabled:true, title:'The Ritual',     subtitle:'Any 4 pieces · 18% off', quantity:4, discountPct:18, badge:'Best Value' },
      { id:'stockup', enabled:true, title:'The Collection', subtitle:'Any 6 pieces · 25% off', quantity:6, discountPct:25, badge:'' }
    ]
  };
  try {
    const stored = JSON.parse(localStorage.getItem('surabhi_bundle_settings') || '{}');
    const offers = defaults.offers.map((o, i) => ({ ...o, ...(stored.offers?.[i] || {}) }));
    return { ...defaults, ...stored, offers };
  } catch { return defaults; }
}

// ─────────────────────────────
// SETTINGS & DEFAULT CONTENT
// ─────────────────────────────
function getPageSettings() {
  try {
    return JSON.parse(localStorage.getItem('surabhi_product_page_settings') || '{}');
  } catch { return {}; }
}

const TRUST_SVGS = [
  `<svg viewBox="0 0 24 24"><path d="M12 2C6 2 3 8 3 12c0 5 4 9 9 9s9-4 9-9C21 7 17 2 12 2z"/><path d="M12 2c0 0 0 10-6 14"/></svg>`,
  `<svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  `<svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`
];
// Convert a Google Drive share URL → direct thumbnail src
function driveThumb(url, size = 48) {
  if (!url) return '';
  const m = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return m ? `https://drive.google.com/thumbnail?id=${m[1]}&sz=w${size}` : url;
}

// Fallback SVGs indexed 0-3 (used when no icon URL is set)
const DELIVERY_SVGS = [
  `<svg viewBox="0 0 24 24" width="20" height="20" stroke="var(--sage)" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>`,
  `<svg viewBox="0 0 24 24" width="20" height="20" stroke="var(--sage)" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>`,
  `<svg viewBox="0 0 24 24" width="20" height="20" stroke="var(--sage)" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>`,
  `<svg viewBox="0 0 24 24" width="20" height="20" stroke="var(--sage)" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>`
];

const DEFAULT_PD_CONTENT = {
  subtitle: 'Brightening & Detan with Real Dals & Besan',
  trust_badges: ['100% Natural', 'Ayurveda Certified', 'Fresh Made Daily', 'Derma Tested'],
  delivery_items: [
    { icon: '', text: '<b>Delhi/NCR:</b> 2–3 business days' },
    { icon: '', text: '<b>Pan India:</b> 4–5 business days' },
    { icon: '', text: 'Free shipping above ₹339' },
    { icon: '', text: 'Cash on Delivery available' }
  ],
  feature_cards: [
    {
      enabled: true,
      eyebrow: 'Patented Formula',
      title: 'With Patented LentiClear™ Technology',
      gradient: 'linear-gradient(135deg,#7D5A3C,#C8922A)',
      benefits: [
        { title: 'Balances Sebum Naturally', desc: 'Controls excess oil production for a matte, comfortable finish. Leaves skin feeling balanced and soft throughout the day without over-drying.' },
        { title: 'Deep Pore Clarity', desc: 'Clears congested pores and lifts away dull surface layers accumulated during the day. Reveals visibly brighter, cleaner skin with each wash.' },
        { title: 'Boosts Skin Radiance', desc: 'Enhances microcirculation and fortifies the skin\'s natural protective barrier. Builds long-term glow from within rather than superficial brightness.' }
      ]
    },
    {
      enabled: true,
      eyebrow: 'Ancient Wisdom',
      title: 'Introducing Regenerative Bitter (Tikta) Cleansing',
      gradient: 'linear-gradient(135deg,#4A7C59,#2C1F14)',
      benefits: [
        { title: 'Anti-Ageing Cellular Action', desc: 'Bitter botanicals stimulate skin cell turnover at the cellular level. Regularly used, this slows visible signs of ageing from the inside out.' },
        { title: 'Cellular Regeneration', desc: 'Promotes renewal of damaged skin cells while supporting production of fresh, healthy ones. Skin becomes progressively firmer and smoother over weeks.' },
        { title: 'Toxin Elimination', desc: 'Ancient Tikta rasa (bitter taste) is known in Ayurveda to cleanse the body of ama (toxins). Applied topically, it draws out impurities trapped in pores.' },
        { title: 'Dosha Balancing', desc: 'Bitter rasa pacifies Pitta and Kapha doshas — the root causes of oily skin, acne, and dullness — restoring the skin\'s natural, balanced state.' }
      ]
    },
    {
      enabled: true,
      eyebrow: 'Natural Cleansing',
      title: 'Bitter is Better Cleansing — Gentle & Brightening',
      gradient: 'linear-gradient(135deg,#C4714A,#7D5A3C)',
      benefits: [
        { title: 'Pure Whole Ingredients', desc: 'Made with real, whole botanicals — not extracts or synthetic derivatives. Each ingredient is recognisable, traceable, and potent in its natural form.' },
        { title: 'Melanin Control', desc: 'Wild turmeric and sandalwood work together to inhibit excess melanin production without bleaching agents. Results in natural, even skin tone over time.' },
        { title: 'Even-Toning Action', desc: 'Regular use gradually fades sun tan, dark spots, and uneven patches. Delivers the kind of slow, lasting brightness that only real ingredients can provide.' },
        { title: 'Zero Harsh Surfactants', desc: 'No SLS, SLES, or parabens. Cleansing power comes entirely from the saponins present in natural ingredients — gentler on the skin barrier than any synthetic.' }
      ]
    }
  ],
  ingredients: {
    eyebrow: "What's Inside",
    title: 'Bitter, active, fresh & whole picks',
    items: [
      { emoji: '🌿', badge: 'Bitter Active', name: 'Wild Turmeric', desc: 'Inhibits melanin production and reduces inflammation, delivering a natural, lasting glow without synthetic brighteners.' },
      { emoji: '🥜', badge: 'Exfoliant', name: 'Real Dals & Besan', desc: 'Gram flour and lentil powder gently exfoliate dead skin cells, absorb excess sebum, and deliver plant-based proteins to the skin.' },
      { emoji: '🪵', badge: 'Soothing', name: 'Sandalwood', desc: 'Cools, soothes, and imparts a subtle natural fragrance while toning the skin and reducing redness and sun damage over time.' }
    ]
  },
  compare: {
    eyebrow: 'Why Choose Tikta',
    title:   'Bitter is Better Than Every Face Wash!',
    col1:    'Feature',
    col2:    'Your Product',
    col3:    'Regular Face Wash',
    rows: [
      { feature: 'Cleansing Power',    yours: '✅ Deep pore, gentle',      theirs: '⚠️ Surface only' },
      { feature: 'Non-Drying',         yours: '✅ Moisture balanced',      theirs: '❌ Often strips barrier' },
      { feature: 'Long Term Effect',   yours: '✅ Visible brightening',    theirs: '❌ No cumulative benefit' },
      { feature: 'Ingredients',        yours: '✅ 100% real botanicals',   theirs: '❌ Synthetic surfactants' },
      { feature: 'Paraben & Sulfate',  yours: '✅ Zero',                   theirs: '❌ Usually present' }
    ]
  },
  usage: {
    eyebrow: 'How to Use',
    title: 'Usage & Safety',
    items: [
      { title: 'How to Use', content: 'Use twice a day — morning and evening. Apply a small amount to damp skin, massage in gentle circular motions for 60 seconds, and rinse thoroughly with lukewarm water. For best results, follow with a toner and moisturiser.' },
      { title: 'Patch Test', content: 'Recommended for first-time users. Apply a small amount to the inner forearm and wait 24 hours before facial use. Discontinue if redness or irritation occurs.' },
      { title: 'Skin Types', content: 'Suitable for all skin types — oily, combination, dry, normal, and sensitive. Especially effective for oily and combination skin types prone to tan and uneven tone.' },
      { title: 'Pregnancy & Kids', content: 'Pregnancy safe. Suitable for children 5 years and above under adult supervision. Free from essential oils that are contraindicated during pregnancy.' }
    ]
  }
};

// Normalise a delivery item to always be {icon, text}
function normalizeDeliveryItem(item) {
  if (typeof item === 'string') return { icon: '', text: item };
  return { icon: item.icon || '', text: item.text || '' };
}

function getPDContent() {
  try {
    const s = JSON.parse(localStorage.getItem('surabhi_product_page_settings') || '{}');
    const rawDelivery = s.delivery_items || DEFAULT_PD_CONTENT.delivery_items;
    const rawCmp      = s.compare        || {};
    const defCmp      = DEFAULT_PD_CONTENT.compare;
    return {
      subtitle:       s.subtitle      || DEFAULT_PD_CONTENT.subtitle,
      trust_badges:   s.trust_badges  || DEFAULT_PD_CONTENT.trust_badges,
      delivery_items: rawDelivery.map(normalizeDeliveryItem),
      feature_cards:  s.feature_cards || DEFAULT_PD_CONTENT.feature_cards,
      ingredients:    s.ingredients   || DEFAULT_PD_CONTENT.ingredients,
      compare: {
        eyebrow: rawCmp.eyebrow || defCmp.eyebrow,
        title:   rawCmp.title   || defCmp.title,
        col1:    rawCmp.col1    || defCmp.col1,
        col2:    rawCmp.col2    || defCmp.col2,
        col3:    rawCmp.col3    || defCmp.col3,
        rows:    (rawCmp.rows && rawCmp.rows.length) ? rawCmp.rows : defCmp.rows
      },
      usage: s.usage || DEFAULT_PD_CONTENT.usage
    };
  } catch { return DEFAULT_PD_CONTENT; }
}

// ─────────────────────────────
// RENDER HERO TEXTS
// ─────────────────────────────
function renderHeroTexts() {
  const c = getPDContent();

  const subtitleEl = document.getElementById('detail-subtitle');
  if (subtitleEl) subtitleEl.textContent = c.subtitle;

  const trustRow = document.getElementById('pd-trust-row');
  if (trustRow) {
    trustRow.innerHTML = c.trust_badges.slice(0, 4).map((label, i) => `
      <div class="pd-trust-badge">
        ${TRUST_SVGS[i] || TRUST_SVGS[0]}
        <span>${esc(label)}</span>
      </div>`).join('');
  }

  const deliveryBox = document.getElementById('pd-delivery-box');
  if (deliveryBox) {
    deliveryBox.innerHTML = c.delivery_items.map((item, i) => {
      const iconHTML = item.icon
        ? `<img src="${driveThumb(item.icon, 40)}" alt="" class="pd-delivery-icon-img" onerror="this.style.display='none'">`
        : (DELIVERY_SVGS[i] || DELIVERY_SVGS[0]);
      return `<div class="pd-delivery-row">${iconHTML}<div>${item.text}</div></div>`;
    }).join('');
  }
}

// ─────────────────────────────
// BUNDLE RENDER
// ─────────────────────────────
function renderBundle(product) {
  const wrap = document.getElementById('pd-bundle-wrap');
  if (!wrap) return;

  if (!product || !product.bundle) {
    wrap.innerHTML = '';
    return;
  }

  const { offers } = getBundleSettings();
  const activeOffers = offers.filter(o => o.enabled);
  if (!activeOffers.length) { wrap.innerHTML = ''; return; }

  const cartSVG = `<svg viewBox="0 0 24 24"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>`;

  const cards = activeOffers.map(offer => {
    const original   = product.price * offer.quantity;
    const discounted = Math.round(original * (1 - offer.discountPct / 100));
    const saving     = original - discounted;
    const perUnit    = Math.round(discounted / offer.quantity);
    const isBest     = offer.badge && offer.badge.toLowerCase().includes('best');
    const topBadge   = isBest
      ? `<div class="pd-bundle-best">${esc(offer.badge)}</div>`
      : offer.badge
        ? `<div class="pd-bundle-badge">${esc(offer.badge)}</div>`
        : '';
    return `
      <div class="pd-bundle-card${isBest ? ' selected' : ''}" onclick="selectBundle(${offer.quantity}, ${offer.discountPct / 100}, this)">
        ${topBadge}
        <div class="pd-bundle-qty" style="${isBest ? 'margin-top:14px' : ''}">${offer.quantity}×</div>
        <div class="pd-bundle-qty-label">${esc(offer.title)}</div>
        <div class="pd-bundle-saving">SAVE ₹${saving}</div>
        <div class="pd-bundle-original">₹${original}</div>
        <div class="pd-bundle-price">₹${discounted}</div>
        <div class="pd-bundle-per-unit">₹${perUnit}/unit</div>
      </div>`;
  }).join('');

  wrap.innerHTML = `
    <div class="pd-bundle-section">
      <div class="pd-bundle-header">
        <div class="pd-bundle-header-icon">
          <svg viewBox="0 0 24 24"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>
        </div>
        <div class="pd-bundle-header-text">
          <div class="pd-bundle-heading">Bundle &amp; Save More</div>
          <div class="pd-bundle-subheading">Pick a set — the more you buy, the more you save</div>
        </div>
      </div>
      <div class="pd-bundle-cards">${cards}</div>
      <button class="pd-bundle-atc" id="pd-bundle-atc-btn">
        ${cartSVG} Add Bundle to Cart
      </button>
      <p class="pd-bundle-note">Free shipping + COD available on all bundles</p>
    </div>`;

  document.getElementById('pd-bundle-atc-btn').addEventListener('click', () => {
    const sel = wrap.querySelector('.pd-bundle-card.selected');
    if (!sel) { showToast('Select a bundle above'); return; }
    sel.click();
  });
}

function selectBundle(qty, discountRate, cardEl) {
  if (!currentProduct) return;
  const total = Math.round(currentProduct.price * qty * (1 - discountRate));
  document.querySelectorAll('.pd-bundle-card').forEach(c => c.classList.remove('selected'));
  if (cardEl) cardEl.classList.add('selected');
  cardEl._bundleQty = qty;
  cardEl._bundleTotal = total;
  addToCartCore(
    'bundle-' + Date.now(),
    `${currentProduct.name} (Bundle ×${qty})`,
    total,
    1
  );
}

// ─────────────────────────────
// HTML ESCAPE
// ─────────────────────────────
function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ─────────────────────────────
// RENDER DYNAMIC SECTIONS
// ─────────────────────────────
const CHECK_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
const ALTS = ['','pd-alt-bg',''];

function renderFeatureCards() {
  const wrap = document.getElementById('pd-feature-cards-wrap');
  if (!wrap) return;
  const { feature_cards } = getPDContent();
  const enabled = feature_cards.filter(c => c.enabled !== false);

  wrap.innerHTML = enabled.map((card, i) => {
    const cardId   = `fc-card-${i}`;
    const gradient = card.gradient || 'linear-gradient(135deg,#7D5A3C,#C8922A)';
    const altBg    = ALTS[i % 3];
    const rows = (card.benefits || []).map(b => `
      <div class="pd-benefit-row">
        <div class="pd-benefit-icon">${CHECK_SVG}</div>
        <div class="pd-benefit-text">
          <h4>${esc(b.title)}</h4>
          <p>${esc(b.desc)}</p>
        </div>
      </div>`).join('');

    return `
      <div class="pd-section ${altBg}">
        <div class="pd-container">
          <div class="pd-expand-card" id="${cardId}">
            <div class="pd-expand-card-bg" style="background-image:${gradient};"></div>
            <div class="pd-expand-card-inner">
              <p class="pd-expand-eyebrow">${esc(card.eyebrow)}</p>
              <h2 class="pd-expand-title">${esc(card.title)}</h2>
              <button class="pd-expand-toggle-btn" onclick="toggleExpand('${cardId}', this)">Click to Know More ▾</button>
              <div class="pd-expand-body">
                <div class="pd-benefit-rows">${rows}</div>
              </div>
            </div>
          </div>
        </div>
      </div>`;
  }).join('');
}

function renderIngredients() {
  const wrap = document.getElementById('pd-ingredients-wrap');
  if (!wrap) return;
  const { ingredients } = getPDContent();
  const cards = (ingredients.items || []).map(item => `
    <div class="pd-ingredient-card">
      <div class="pd-ingredient-img">${item.image ? `<img src="${esc(driveThumb(item.image, 400))}" alt="${esc(item.name)}" style="width:100%;height:100%;object-fit:cover;">` : esc(item.emoji)}</div>
      <div class="pd-ingredient-body">
        <span class="pd-ingredient-badge">${esc(item.badge)}</span>
        <h4 class="pd-ingredient-name">${esc(item.name)}</h4>
        <p class="pd-ingredient-desc">${esc(item.desc)}</p>
      </div>
    </div>`).join('');

  wrap.innerHTML = `
    <div class="pd-section pd-beige-bg">
      <div class="pd-container">
        <p class="pd-eyebrow">${esc(ingredients.eyebrow)}</p>
        <div class="pd-ingredients-header">
          <h2 class="pd-section-title">${esc(ingredients.title)}</h2>
          <span class="pd-ingredients-link" onclick="document.getElementById('more-info').open=true">Full Ingredient List ↗</span>
        </div>
        <div class="pd-ingredients-grid">${cards}</div>
      </div>
    </div>`;
}

function renderCompare() {
  const wrap = document.getElementById('pd-compare-wrap');
  if (!wrap) return;
  const { compare } = getPDContent();

  const rows = (compare.rows || []).map(r =>
    `<tr><td>${esc(r.feature)}</td><td>${esc(r.yours)}</td><td>${esc(r.theirs)}</td></tr>`
  ).join('');

  wrap.innerHTML = `
    <div class="pd-compare-section">
      <div class="pd-container pd-compare-inner">
        <p class="pd-eyebrow">${esc(compare.eyebrow)}</p>
        <h2 class="pd-section-title" style="color:#fff;margin-bottom:1.5rem;">${esc(compare.title)}</h2>
        <div style="overflow-x:auto;">
          <table class="pd-compare-table">
            <thead>
              <tr>
                <th style="text-align:left;">${esc(compare.col1 || 'Feature')}</th>
                <th>${esc(compare.col2 || 'Your Product')}</th>
                <th>${esc(compare.col3 || 'Regular Face Wash')}</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    </div>`;
}

function renderUsage() {
  const wrap = document.getElementById('pd-usage-wrap');
  if (!wrap) return;
  const { usage } = getPDContent();
  const items = (usage.items || []).map(item => `
    <div class="pd-accordion-item">
      <div class="pd-accordion-head" onclick="toggleAccordion(this)">
        <h4>${esc(item.title)}</h4><span class="pd-accordion-icon">+</span>
      </div>
      <div class="pd-accordion-body">
        <div class="pd-accordion-content">${esc(item.content)}</div>
      </div>
    </div>`).join('');

  wrap.innerHTML = `
    <div class="pd-section pd-alt-bg">
      <div class="pd-container">
        <p class="pd-eyebrow">${esc(usage.eyebrow)}</p>
        <h2 class="pd-section-title" style="margin-bottom:1.5rem;">${esc(usage.title)}</h2>
        <div class="pd-accordion">${items}</div>
      </div>
    </div>`;
}

// ─────────────────────────────
// TOAST
// ─────────────────────────────
function showToast(msg) {
  const el = document.getElementById('pd-toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2200);
}

// ─────────────────────────────
// CART CORE
// ─────────────────────────────
function getCart() {
  return JSON.parse(localStorage.getItem('surabhi_cart') || '[]');
}
function saveCart(cart) {
  localStorage.setItem('surabhi_cart', JSON.stringify(cart));
}
function updateCartBadge() {
  const count = getCart().reduce((s, i) => s + i.qty, 0);
  const badge = document.getElementById('cart-badge');
  if (badge) badge.textContent = count;
}
function addToCartCore(id, name, price, qty = 1) {
  const cart = getCart();
  const existing = cart.find(i => i.id === id);
  if (existing) existing.qty += qty;
  else cart.push({ id, name, price, qty });
  saveCart(cart);
  updateCartBadge();
  showToast('Added to cart');
}
function removeFromCart(id) {
  saveCart(getCart().filter(i => i.id !== id));
  updateCartBadge();
  renderCartPanel();
}

// ─────────────────────────────
// CART DRAWER
// ─────────────────────────────
function openCartDrawer() {
  renderCartPanel();
  document.getElementById('cart-drawer').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeCartDrawer() {
  document.getElementById('cart-drawer').classList.remove('open');
  document.body.style.overflow = '';
}
function renderCartPanel() {
  const cart = getCart();
  const body = document.getElementById('cart-panel-body');
  const foot = document.getElementById('cart-panel-foot');
  if (!body) return;

  if (!cart.length) {
    body.innerHTML = '<p class="pd-cart-empty">Your bag is empty.<br><br>Add a product to get started.</p>';
    if (foot) foot.style.display = 'none';
    return;
  }

  body.innerHTML = cart.map(item => {
    const prod = allProducts.find(p => String(p.id) === String(item.id));
    const imgSrc = prod && prod.images && prod.images[0] ? prod.images[0] : '';
    const imgHTML = imgSrc
      ? `<img src="${imgSrc}" alt="${escAttr(item.name)}">`
      : '';
    return `
      <div class="pd-cart-line">
        <div class="pd-cart-line-img">${imgHTML}</div>
        <div class="pd-cart-line-info">
          <div class="pd-cart-line-name">${escAttr(item.name)}</div>
          <div class="pd-cart-line-meta">₹${item.price} × ${item.qty}</div>
        </div>
        <div class="pd-cart-line-total">₹${item.price * item.qty}</div>
        <button class="pd-cart-line-remove" onclick="removeFromCart('${escAttr(item.id)}')" title="Remove">×</button>
      </div>`;
  }).join('');

  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const sub = document.getElementById('cart-panel-subtotal');
  if (sub) sub.textContent = `₹${subtotal}`;
  if (foot) foot.style.display = 'block';
}

// ─────────────────────────────
// ADD TO CART
// ─────────────────────────────
function addToCartPage() {
  if (!currentProduct) return;
  addToCartCore(currentProduct.id, currentProduct.name, currentProduct.price, currentQty);
  const btn = document.getElementById('atc-btn');
  if (btn) {
    btn.textContent = 'Added ✓';
    btn.classList.add('added');
    setTimeout(() => { btn.textContent = 'Add to Cart'; btn.classList.remove('added'); }, 1500);
  }
}
function addProductToCart(id) {
  const prod = allProducts.find(p => String(p.id) === String(id));
  if (!prod) return;
  addToCartCore(prod.id, prod.name, prod.price, 1);
  openCartDrawer();
}

// ─────────────────────────────
// QTY
// ─────────────────────────────
function changeQty(n) {
  currentQty = Math.max(1, currentQty + n);
  const el = document.getElementById('qty-val');
  if (el) el.textContent = currentQty;
}

// ─────────────────────────────
// ESCAPE ATTR
// ─────────────────────────────
function escAttr(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ─────────────────────────────
// GALLERY
// ─────────────────────────────
function renderGallery(images) {
  const mainImg  = document.getElementById('main-img');
  const strip    = document.getElementById('thumbs-strip');
  const galleryEl = document.getElementById('gallery-main');
  if (!mainImg || !strip) return;

  const imgs = images.length ? images : [];
  activeImg  = 0;

  if (imgs[0]) {
    mainImg.src = imgs[0];
    // Remove shimmer once image is actually painted
    const done = () => {
      galleryEl && galleryEl.classList.remove('pd-gallery-loading');
      mainImg.style.opacity = '1';
    };
    if (mainImg.complete && mainImg.naturalWidth) {
      done();
    } else {
      mainImg.onload  = done;
      mainImg.onerror = done; // remove shimmer even if image 404s
    }
    const stickyImg = document.getElementById('sticky-img');
    if (stickyImg) stickyImg.src = imgs[0];
  } else {
    galleryEl && galleryEl.classList.remove('pd-gallery-loading');
  }

  mainImg.alt = currentProduct ? currentProduct.name : 'Product';

  strip.innerHTML = imgs.map((src, i) => `
    <img src="${src}" class="${i === 0 ? 'active' : ''}"
         onclick="switchImage(${i})" alt="View ${i + 1}">
  `).join('');
}

function switchImage(i) {
  const imgs = currentProduct ? currentProduct.images : [];
  if (!imgs.length) return;
  activeImg = i;
  const mainImg = document.getElementById('main-img');
  if (mainImg) {
    mainImg.style.opacity = '0';
    setTimeout(() => { mainImg.src = imgs[i]; mainImg.style.opacity = '1'; }, 150);
  }
  document.querySelectorAll('.pd-thumbs img').forEach((thumb, idx) => {
    thumb.classList.toggle('active', idx === i);
  });
}

function prevImg() {
  const total = currentProduct ? currentProduct.images.length : 1;
  switchImage((activeImg - 1 + total) % total);
}
function nextImg() {
  const total = currentProduct ? currentProduct.images.length : 1;
  switchImage((activeImg + 1) % total);
}

function initGallerySwipe() {
  const main = document.getElementById('gallery-main');
  if (!main) return;
  let startX = 0;
  main.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, { passive: true });
  main.addEventListener('touchend', e => {
    const delta = e.changedTouches[0].clientX - startX;
    if (Math.abs(delta) > 40) delta < 0 ? nextImg() : prevImg();
  }, { passive: true });
}

// ─────────────────────────────
// PRODUCT CARD HTML
// ─────────────────────────────
function productCardHTML(p) {
  const img = p.images && p.images[0] ? p.images[0] : '';
  const imgHTML = img
    ? `<img src="${img}" alt="${escAttr(p.name)}" style="width:100%;height:100%;object-fit:cover;">`
    : '';
  return `
    <div class="pd-product-card" style="cursor:pointer;" onclick="window.location.href='product-detail.html?id=${escAttr(p.id)}'">
      <div class="pd-product-card-img">${imgHTML}</div>
      <div class="pd-product-card-body">
        <h4>${escAttr(p.name)}</h4>
        <div class="pd-product-card-prices">
          <span class="pd-card-price">₹${p.price}</span>
        </div>
        <button class="pd-add-btn" onclick="event.stopPropagation();addProductToCart('${escAttr(p.id)}')">+ ADD</button>
      </div>
    </div>`;
}

// ─────────────────────────────
// RENDER CAROUSELS
// ─────────────────────────────
function renderCarousels() {
  const settings = getPageSettings();
  const others = allProducts.filter(p => String(p.id) !== String(productId));

  function getSelected(key) {
    const ids = settings[key];
    if (ids && ids.length) {
      const filtered = ids.map(id => allProducts.find(p => String(p.id) === String(id))).filter(Boolean);
      if (filtered.length) return filtered;
    }
    return others; // fallback: all other products
  }

  function fillCarousel(sectionId, rowId, products) {
    const section = document.getElementById(sectionId);
    const row     = document.getElementById(rowId);
    if (!section || !row) return;
    if (!products.length) { section.style.display = 'none'; return; }
    row.innerHTML = products.map(productCardHTML).join('');
    section.style.display = '';
    makeDraggable(row);
  }

  fillCarousel('section-cleanser', 'cleanser-row', getSelected('cleanser_ids'));
  fillCarousel('section-alsobuy',  'also-buy-row', getSelected('alsobuy_ids'));
  fillCarousel('section-range',    'range-row',    getSelected('range_ids'));
  fillCarousel('section-fbt',      'fbt-row',      getSelected('fbt_ids'));
}

// ─────────────────────────────
// RENDER PRODUCT
// ─────────────────────────────
function renderProduct(p) {
  currentProduct = p;

  document.title = `${p.name} — Surabhi Sutra`;
  const pgTitle = document.getElementById('page-title');
  if (pgTitle) pgTitle.textContent = `${p.name} — Surabhi Sutra`;

  const bcCat  = document.getElementById('bc-category');
  const bcName = document.getElementById('bc-name');
  if (bcCat)  bcCat.textContent  = p.category || 'Face';
  if (bcName) bcName.textContent = p.name;

  const nameEl = document.getElementById('detail-name');
  if (nameEl) { nameEl.textContent = p.name; nameEl.classList.remove('pd-skeleton'); }

  const descEl = document.getElementById('detail-desc');
  if (descEl && p.description) descEl.textContent = p.description;

  const priceEl = document.getElementById('detail-price');
  if (priceEl) priceEl.textContent = `₹${p.price}`;

  // Derive original price (15% markup) and discount
  const original    = Math.round(p.price / 0.85);
  const discountPct = Math.round(((original - p.price) / original) * 100);
  const origEl      = document.getElementById('detail-original');
  const discEl      = document.getElementById('detail-discount');
  if (origEl) origEl.textContent = `₹${original}`;
  if (discEl) { discEl.textContent = `${discountPct}% OFF`; discEl.style.display = ''; }
  document.getElementById('price-row')?.classList.remove('pd-skeleton-row');

  const stickyName  = document.getElementById('sticky-name');
  const stickyPrice = document.getElementById('sticky-price');
  if (stickyName)  stickyName.textContent  = p.name;
  if (stickyPrice) stickyPrice.textContent = `₹${p.price}`;

  renderGallery(p.images || []);
  renderBundle(p);
}

// ─────────────────────────────
// FETCH ALL DATA
// ─────────────────────────────
const CACHE_KEY = 'surabhi_pd_products_v1';

function parseProducts(raw) {
  const safeParse = (v, fallback = []) => {
    try { return typeof v === 'string' ? JSON.parse(v) : (v || fallback); }
    catch { return fallback; }
  };
  return raw.map(p => ({
    id:          p.id,
    name:        p.name,
    category:    p.category,
    description: p.description,
    price:       p.price,
    images:      safeParse(p.images, p.image_url ? [p.image_url] : []),
    benefits:    safeParse(p.benefits, []),
    bundle:      p.bundle_enabled === 'yes'
  }));
}

async function fetchProduct() {
  const safeParse = (s, fb) => { try { return JSON.parse(s) || fb; } catch { return fb; } };

  // ── STEP 1: render immediately from cache (stale-while-revalidate) ──
  const cached = safeParse(localStorage.getItem(CACHE_KEY), []);
  if (cached.length) {
    allProducts = cached;
    const hit = cached.find(p => String(p.id) === String(productId)) || cached[0];
    if (hit) renderProduct(hit);
    renderCarousels();
  }

  // ── STEP 2: fetch fresh data, update cache and re-render ──
  try {
    const res  = await fetch(`${API_URL}?action=getProducts`);
    const data = await res.json();
    if (!data.success) { if (!cached.length) showToast('Failed to load product'); return; }

    allProducts = parseProducts(data.products);
    localStorage.setItem(CACHE_KEY, JSON.stringify(allProducts));

    const found = allProducts.find(p => String(p.id) === String(productId));
    const target = found || allProducts[0];
    if (target) renderProduct(target);
    renderCarousels();

  } catch (err) {
    console.error(err);
    if (!cached.length) showToast('Error loading product data');
  }
}

// ─────────────────────────────
// REVIEWS
// ─────────────────────────────
async function fetchReviews() {
  try {
    const url  = `${API_URL}?action=getReviews${productId ? '&product_id=' + encodeURIComponent(productId) : ''}`;
    const res  = await fetch(url);
    const data = await res.json();
    if (!data.success) { renderNoReviews(); return; }
    renderReviews(data.reviews || []);
  } catch { renderNoReviews(); }
}

function renderNoReviews() {
  const list = document.getElementById('reviews-list');
  if (list) list.innerHTML = '<p style="color:var(--text-light);font-size:13px;text-align:center;padding:2rem 0;">No reviews yet. Be the first to review!</p>';
  const wrap = document.getElementById('reviews-summary-wrap');
  if (wrap) wrap.innerHTML = '';
}

function starsHTML(n) {
  const full  = Math.round(n);
  return '★'.repeat(full) + '☆'.repeat(5 - full);
}

function renderReviews(reviews) {
  const list = document.getElementById('reviews-list');
  const wrap = document.getElementById('reviews-summary-wrap');
  if (!list) return;

  if (!reviews.length) { renderNoReviews(); return; }

  // Summary stats
  const avg = reviews.reduce((s, r) => s + Number(r.stars || 0), 0) / reviews.length;
  const counts = [0, 0, 0, 0, 0];
  reviews.forEach(r => { const s = Math.min(5, Math.max(1, Math.round(Number(r.stars || 0)))); counts[s - 1]++; });

  // Update live rating row in hero
  const ratingRow = document.getElementById('pd-rating-row');
  const starsEl   = document.getElementById('pd-stars');
  const ratingVal = document.getElementById('pd-rating-val');
  const ratingCnt = document.getElementById('pd-rating-count');
  if (ratingRow && reviews.length) {
    if (starsEl)   starsEl.textContent   = starsHTML(avg);
    if (ratingVal) ratingVal.textContent = avg.toFixed(1);
    if (ratingCnt) ratingCnt.textContent = `${reviews.length} Review${reviews.length !== 1 ? 's' : ''}`;
    ratingRow.style.visibility = 'visible';
  }

  if (wrap) {
    wrap.innerHTML = `
      <div class="pd-reviews-summary">
        <div class="pd-reviews-score">
          <div class="big-score">${avg.toFixed(1)}</div>
          <div class="big-stars" style="color:var(--gold);">${starsHTML(avg)}</div>
          <div class="review-count">${reviews.length} review${reviews.length !== 1 ? 's' : ''}</div>
        </div>
        <div class="pd-rating-bars">
          ${[5,4,3,2,1].map(s => {
            const pct = reviews.length ? Math.round(counts[s-1]/reviews.length*100) : 0;
            return `<div class="pd-rating-bar-row">
              <span>${s} ★</span>
              <div class="pd-bar-track"><div class="pd-bar-fill" style="width:${pct}%"></div></div>
              <span>${pct}%</span>
            </div>`;
          }).join('')}
        </div>
      </div>`;
  }

  list.innerHTML = reviews.map(r => {
    const initial  = (r.name || '?')[0].toUpperCase();
    const starDisp = starsHTML(Number(r.stars || 0));
    return `
      <div class="pd-review-card">
        <div class="pd-review-header">
          <div class="pd-reviewer">
            <div class="pd-reviewer-avatar">${escAttr(initial)}</div>
            <div>
              <div class="pd-reviewer-name">${escAttr(r.name)}</div>
            </div>
          </div>
          <div class="pd-review-stars" style="color:var(--gold);">${starDisp}</div>
        </div>
        <p class="pd-review-text">${escAttr(r.comment)}</p>
      </div>`;
  }).join('');
}

// ─────────────────────────────
// SUBMIT REVIEW
// ─────────────────────────────
async function submitReview() {
  const name    = document.getElementById('rev-name')?.value.trim();
  const email   = document.getElementById('rev-email')?.value.trim();
  const stars   = Number(document.getElementById('rev-stars')?.value || 0);
  const comment = document.getElementById('rev-comment')?.value.trim();
  const alert   = document.getElementById('review-form-alert');
  const btn     = document.getElementById('submit-review-btn');

  function showAlert(msg, type) {
    if (!alert) return;
    alert.textContent = msg;
    alert.className = type;
  }

  if (!name || !email || !stars || !comment) {
    showAlert('Please fill in all fields and select a star rating.', 'error');
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showAlert('Please enter a valid email address.', 'error');
    return;
  }

  if (btn) { btn.disabled = true; btn.textContent = 'Submitting...'; }

  try {
    const res  = await fetch(API_URL, {
      method: 'POST',
      body:   JSON.stringify({ action: 'saveReview', name, email, stars, comment, product_id: productId || '' })
    });
    const data = await res.json();
    if (data.success) {
      showAlert('Thank you for your review! It will appear shortly.', 'success');
      // Reset form
      document.getElementById('rev-name').value    = '';
      document.getElementById('rev-email').value   = '';
      document.getElementById('rev-comment').value = '';
      document.getElementById('rev-stars').value   = '0';
      selectedStars = 0;
      document.querySelectorAll('.pd-star-opt').forEach(s => s.classList.remove('active'));
      fetchReviews(); // refresh list
    } else {
      showAlert('Could not save your review. Please try again.', 'error');
    }
  } catch {
    showAlert('Network error. Please try again.', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Submit Review'; }
  }
}

// ─────────────────────────────
// STAR PICKER
// ─────────────────────────────
function initStarPicker() {
  const stars = document.querySelectorAll('.pd-star-opt');
  stars.forEach(star => {
    star.addEventListener('click', () => {
      selectedStars = Number(star.dataset.val);
      const revStars = document.getElementById('rev-stars');
      if (revStars) revStars.value = selectedStars;
      stars.forEach(s => s.classList.toggle('active', Number(s.dataset.val) <= selectedStars));
    });
    star.addEventListener('mouseover', () => {
      const val = Number(star.dataset.val);
      stars.forEach(s => s.classList.toggle('active', Number(s.dataset.val) <= val));
    });
    star.addEventListener('mouseout', () => {
      stars.forEach(s => s.classList.toggle('active', Number(s.dataset.val) <= selectedStars));
    });
  });
}

// ─────────────────────────────
// ACCORDION TOGGLES
// ─────────────────────────────
function toggleExpand(cardId, btn) {
  const card = document.getElementById(cardId);
  if (!card) return;
  const isOpen = card.classList.toggle('open');
  btn.textContent = isOpen ? 'Close ▴' : 'Click to Know More ▾';
}

function toggleAccordion(head) {
  const item = head.parentElement;
  const isOpen = item.classList.toggle('open');
  const icon   = head.querySelector('.pd-accordion-icon');
  if (icon) icon.textContent = isOpen ? '×' : '+';
}

// ─────────────────────────────
// PROMO CODE COPY
// ─────────────────────────────
function copyPromo(code, el) {
  if (!code) return;
  navigator.clipboard.writeText(code).catch(() => {});
  const original = el.textContent;
  el.textContent    = 'COPIED!';
  el.style.background = '#4A7C59';
  setTimeout(() => { el.textContent = original; el.style.background = ''; }, 1500);
}

// ─────────────────────────────
// PROMO TICKER
// ─────────────────────────────
function initPromoTicker() {
  const msgEl = document.getElementById('promo-msg');
  if (!msgEl) return;
  msgEl.style.transition = 'opacity .3s';

  function update() {
    const msg = promoMessages[promoIdx];
    msgEl.style.opacity = '0';
    setTimeout(() => {
      let html = `<span>${msg.text}</span>`;
      if (msg.code) html += ` <span class="pd-promo-code" onclick="copyPromo('${msg.code}', this)">${msg.code}</span>`;
      msgEl.innerHTML = html;
      msgEl.style.opacity = '1';
    }, 300);
    promoIdx = (promoIdx + 1) % promoMessages.length;
  }
  setInterval(update, 4000);
}

// ─────────────────────────────
// SHARE
// ─────────────────────────────
function shareProduct() {
  if (navigator.share) {
    navigator.share({
      title: currentProduct ? currentProduct.name : 'Surabhi Sutra',
      text:  'Check out this Ayurvedic product!',
      url:   window.location.href
    }).catch(() => {});
  } else {
    navigator.clipboard.writeText(window.location.href).catch(() => {});
    showToast('Link copied!');
  }
}

// ─────────────────────────────
// SIZE PILLS
// ─────────────────────────────
function initSizePills() {
  document.querySelectorAll('.pd-size-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.pd-size-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
    });
  });
}

// ─────────────────────────────
// BANNER SLIDER
// ─────────────────────────────
function goBanner(i) {
  bannerIndex = i;
  const track = document.getElementById('banner-track');
  if (track) track.style.transform = `translateX(-${i * 100}%)`;
  document.querySelectorAll('.pd-banner-dot').forEach((dot, idx) => {
    dot.classList.toggle('active', idx === i);
  });
}

function initBanner() {
  const slides = document.querySelectorAll('.pd-banner-slide');
  if (!slides.length) return;
  setInterval(() => {
    bannerIndex = (bannerIndex + 1) % slides.length;
    goBanner(bannerIndex);
  }, 4500);
}

// ─────────────────────────────
// DRAGGABLE CAROUSELS
// ─────────────────────────────
function makeDraggable(el) {
  if (!el || el._draggable) return;
  el._draggable = true;
  let isDown = false, startX = 0, scrollLeft = 0;
  el.addEventListener('mousedown', e => {
    isDown = true; el.classList.add('dragging');
    startX = e.pageX - el.offsetLeft; scrollLeft = el.scrollLeft;
  });
  el.addEventListener('mouseleave', () => { isDown = false; el.classList.remove('dragging'); });
  el.addEventListener('mouseup',    () => { isDown = false; el.classList.remove('dragging'); });
  el.addEventListener('mousemove',  e => {
    if (!isDown) return;
    e.preventDefault();
    el.scrollLeft = scrollLeft - (e.pageX - el.offsetLeft - startX) * 1.5;
  });
}

// ─────────────────────────────
// INIT
// ─────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  renderHeroTexts();
  renderFeatureCards();
  renderIngredients();
  renderCompare();
  renderUsage();
  updateCartBadge();
  fetchProduct();
  fetchReviews();
  initPromoTicker();
  initBanner();
  initGallerySwipe();
  initStarPicker();

  document.querySelectorAll('.pd-blog-row, .pd-product-carousel').forEach(makeDraggable);

  // Close drawer on Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeCartDrawer();
  });
});
