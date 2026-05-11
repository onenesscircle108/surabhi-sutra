// ─────────────────────────────
// CONFIG
// ─────────────────────────────
const API_URL = 'https://script.google.com/macros/s/AKfycbwIKKT8D9REXRRHFLHTFWMVP_WbQQyO6ryHzEd7MfbwsGZIjxYdY0g64tWNoP_MWukd/exec';

// ─────────────────────────────
// STATE
// ─────────────────────────────
let cart = JSON.parse(localStorage.getItem('surabhi_cart') || '[]');
let products = [];
let currentProduct = null;
let currentQty = 1;
let currentSlide = 0;
let galleryTimer = null;

// ─────────────────────────────
// BUNDLE SETTINGS
// ─────────────────────────────
function getBundleSettings(){
  const defaults = {
    offers:[
      {id:'duo',enabled:true,title:'The Pair',subtitle:'Any 2 pieces · 10% off',quantity:2,discountPct:10,badge:''},
      {id:'bumper',enabled:true,title:'The Ritual',subtitle:'Any 4 pieces · 18% off',quantity:4,discountPct:18,badge:'Best Value'},
      {id:'stockup',enabled:true,title:'The Collection',subtitle:'Any 6 pieces · 25% off',quantity:6,discountPct:25,badge:''}
    ]
  };
  try{
    const stored = JSON.parse(localStorage.getItem('surabhi_bundle_settings') || '{}');
    const offers = defaults.offers.map((o,i)=>({...o,...(stored.offers?.[i]||{})}));
    return {...defaults,...stored, offers};
  }catch{
    return defaults;
  }
}

// ─────────────────────────────
// HELPERS
// ─────────────────────────────
function escapeAttr(v){
  return String(v ?? '')
    .replace(/&/g,'&amp;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;');
}

function showToast(msg){
  const el = document.createElement('div');
  el.className = 'toast show';
  el.textContent = msg;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(()=>el.remove(),2500);
}

// ✅ Robust CSV parser (handles quotes + commas)
function parseCSV(line){
  const cols = [];
  let cur = '';
  let inQuotes = false;

  for(let i=0;i<line.length;i++){
    const c = line[i];

    if(c === '"' && !inQuotes){
      inQuotes = true;
    }
    else if(c === '"' && inQuotes){
      if(line[i+1] === '"'){ cur += '"'; i++; }
      else inQuotes = false;
    }
    else if(c === ',' && !inQuotes){
      cols.push(cur);
      cur = '';
    }
    else{
      cur += c;
    }
  }

  cols.push(cur);
  return cols;
}

// ─────────────────────────────
// NAV
// ─────────────────────────────
function showPage(page){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.getElementById(page).classList.add('active');
  window.scrollTo(0,0);
  if(page==='shop') renderShop();
}

function toggleMobileMenu(){
  const overlay = document.getElementById('mobile-nav-overlay');
  overlay.classList.toggle('open');
  // keep mobile cart count in sync
  const mc = document.getElementById('mobile-cart-count');
  if(mc) mc.textContent = document.getElementById('cart-count').textContent;
}

// ─────────────────────────────
// FETCH PRODUCTS
// ─────────────────────────────
// ─────────────────────────────
// WELCOME SCREEN
// ─────────────────────────────
const DEFAULT_WELCOME = {
  title: 'Welcome to\nSurabhi Sutra',
  tagline: 'Rituals rooted in five thousand years of wisdom'
};

let welcomeMinTimerComplete = false;
let productsLoaded = false;

function loadWelcomeContent(){
  try{
    const stored = JSON.parse(localStorage.getItem('surabhi_welcome') || '{}');
    const welcome = {...DEFAULT_WELCOME, ...stored};
    document.getElementById('welcome-title').innerHTML = welcome.title.replace(/\n/g, '<br>');
    document.getElementById('welcome-tagline').textContent = welcome.tagline;
  }catch{
    // Use defaults
  }
}

function dismissWelcome(){
  const ws = document.getElementById('welcome-screen');
  if(!ws) return;
  ws.classList.add('fade-out');
  setTimeout(()=>{
    if(ws && ws.parentElement) ws.remove();
  }, 900);
}

async function fetchProducts(){
  try{
    const res = await fetch(`${API_URL}?action=getProducts`);
    const data = await res.json();

    if(!data.success){
      console.error(data);
      showToast("Failed to load products");
      return;
    }

    products = data.products.map(p => {
      // SAFE PARSE JSON FIELDS
      const safeParse = (v, fallback=[])=>{
        try{
          return typeof v === 'string' ? JSON.parse(v) : v;
        }catch{
          return fallback;
        }
      };

      return {
        id: p.id,
        name: p.name,
        category: p.category,
        description: p.description,
        price: p.price,

        // 👇 IMPORTANT FIX
        images: safeParse(p.images, p.image_url ? [p.image_url] : []),

        benefits: safeParse(p.benefits, []),

        bundle: p.bundle_enabled === 'yes'
      };
    });

    console.log("✅ Loaded products:", products);

    renderHome();
    renderShop();

    productsLoaded = true;
    if(welcomeMinTimerComplete) dismissWelcome();

  }catch(err){
    console.error(err);
    showToast("Error loading products");
  }
}

// ─────────────────────────────
// RENDER
// ─────────────────────────────
function productCard(p){
  const img = p.images?.[0] || '';

  return `
  <div class="product-card" onclick="openProduct('${escapeAttr(p.id)}')">
    <div class="product-img">
      ${img ? `<img src="${img}">` : ''}
    </div>
    <div class="product-info">
      <p>${p.name}</p>
      <p>₹ ${p.price}</p>
    </div>
  </div>`;
}

function renderHome(){
  const el = document.getElementById('home-products');
  if(!el) return;

  el.innerHTML = products.slice(0,4).map(productCard).join('');
}

function renderShop(){
  const searchInput = document.getElementById('shop-search');
  filterShop(searchInput ? searchInput.value : '');
}

function filterShop(query){
  const el = document.getElementById('shop-products');
  if(!el) return;
  if(!products.length){
    el.innerHTML='<p class="loading-text">Loading products...</p>';
    return;
  }
  const q = (query||'').trim().toLowerCase();
  const filtered = q ? products.filter(p=>
    (p.name||'').toLowerCase().includes(q)||
    (p.description||'').toLowerCase().includes(q)||
    (p.category||'').toLowerCase().includes(q)
  ) : products;
  el.innerHTML = filtered.length
    ? filtered.map(productCard).join('')
    : '<p class="loading-text">No products found for "'+q+'".</p>';
}

// ─────────────────────────────
// PRODUCT PAGE
// ─────────────────────────────
function openProduct(id){
  window.location.href = `product-detail.html?id=${encodeURIComponent(id)}`;
}

function renderProductPage(){
  const p = currentProduct;
  if(!p) return;

  const imagesHTML = p.images.map((img,i)=>`
    <img src="${img}" class="slide ${i===0?'active':''}" alt="${escapeAttr(p.name)}">
  `).join('');

  const dotsHTML = p.images.map((_,i)=>`
    <span class="gallery-dot ${i===0?'active':''}" onclick="goSlide(${i})"></span>
  `).join('');

  const thumbsHTML = p.images.map((img,i)=>`
    <img src="${img}" class="${i===0?'active':''}" onclick="goSlide(${i})" alt="Thumbnail ${i+1}">
  `).join('');

  const bundleSettings = getBundleSettings();
  const activeOffers = bundleSettings.offers.filter(o => o.enabled);

  const bundleHTML = (p.bundle && activeOffers.length) ? `
    <div class="bundle-section">
      <p class="bundle-section-title">Bundle &amp; Save</p>
      <div class="bundle-cards">
        ${activeOffers.map(offer=>{
          const original = p.price * offer.quantity;
          const discounted = Math.round(original * (1 - offer.discountPct / 100));
          const badgeHTML = offer.badge
            ? `<div class="bundle-badge">${escapeAttr(offer.badge)}</div>`
            : '';
          return `
            <div class="bundle-card" onclick="addBundle(${offer.quantity},${offer.discountPct/100},this)">
              <div class="bundle-qty-label">${escapeAttr(offer.title)}</div>
              <div class="bundle-subtitle">${escapeAttr(offer.subtitle)}</div>
              ${badgeHTML}
              <div class="bundle-original">&#8377; ${original}</div>
              <div class="bundle-price">&#8377; ${discounted}</div>
            </div>`;
        }).join('')}
      </div>
    </div>` : '';

  document.getElementById('product-content').innerHTML = `
    <div class="product-page-wrap">

      <!-- LEFT: Gallery -->
      <div>
        <div class="gallery-wrap">
          ${imagesHTML}
          <button class="gallery-arrow prev" onclick="stepSlide(-1)">&#8249;</button>
          <button class="gallery-arrow next" onclick="stepSlide(1)">&#8250;</button>
          <div class="gallery-dots">${dotsHTML}</div>
        </div>
        <div class="gallery-thumbs">${thumbsHTML}</div>
      </div>

      <!-- RIGHT: Product Details -->
      <div>
        <p class="product-category-label">${escapeAttr(p.category || '')}</p>
        <h2 class="product-detail-name">${escapeAttr(p.name)}</h2>
        <p class="product-detail-desc">${escapeAttr(p.description)}</p>
        <hr class="product-divider">
        <p class="product-detail-price">&#8377; ${p.price}</p>

        <div class="qty-row">
          <button class="qty-btn" onclick="changeQty(-1)">&#8722;</button>
          <span class="qty-display" id="qty">${currentQty}</span>
          <button class="qty-btn" onclick="changeQty(1)">&#43;</button>
        </div>

        <div class="product-actions">
          <button class="btn-primary" id="atc-btn" onclick="addToCartFromPage()">Add to Cart</button>
          <button class="btn-outline" onclick="buyNow()">Buy Now</button>
        </div>

        <div class="delivery-strip">
          <span>&#128666; Free Delivery</span>
          <span>&#8617; Easy Returns</span>
          <span>&#128274; Secure Payment</span>
        </div>

        ${bundleHTML}
      </div>

    </div>
  `;

  startGallery();
}

function renderRelatedProducts(){
  const el = document.getElementById('related-products');
  if(!el) return;

  const related = products
    .filter(p=>p.id !== currentProduct.id)
    .slice(0,4);

  el.innerHTML = related.map(productCard).join('');
}

// ─────────────────────────────
// GALLERY
// ─────────────────────────────
function startGallery(){
  clearInterval(galleryTimer);

  galleryTimer = setInterval(()=>{
    const slides = document.querySelectorAll('.slide');
    if(!slides.length) return;

    slides[currentSlide].classList.remove('active');
    currentSlide = (currentSlide+1)%slides.length;
    slides[currentSlide].classList.add('active');
    syncGalleryUI();
  },3500);
}

function goSlide(i){
  const slides = document.querySelectorAll('.slide');
  if(!slides.length) return;

  slides[currentSlide].classList.remove('active');
  currentSlide = i;
  slides[currentSlide].classList.add('active');
  syncGalleryUI();
}

function stepSlide(dir){
  const slides = document.querySelectorAll('.slide');
  if(!slides.length) return;
  goSlide((currentSlide+dir+slides.length)%slides.length);
}

function syncGalleryUI(){
  document.querySelectorAll('.gallery-dot').forEach((dot,i)=>{
    dot.classList.toggle('active',i===currentSlide);
  });
  document.querySelectorAll('.gallery-thumbs img').forEach((thumb,i)=>{
    thumb.classList.toggle('active',i===currentSlide);
  });
}

// ─────────────────────────────
// CART
// ─────────────────────────────
function changeQty(n){
  currentQty = Math.max(1, currentQty + n);
  document.getElementById('qty').textContent = currentQty;
}

function addToCartFromPage(){
  addToCart(currentProduct.id,currentProduct.name,currentProduct.price,currentQty);
  const btn = document.getElementById('atc-btn');
  if(!btn) return;
  btn.textContent = 'Added ✓';
  btn.classList.add('confirmed');
  setTimeout(()=>{
    btn.textContent = 'Add to Cart';
    btn.classList.remove('confirmed');
  },1500);
}

function buyNow(){
  addToCart(currentProduct.id,currentProduct.name,currentProduct.price,currentQty);
  showPage('checkout');
}

function addToCart(id,name,price,qty=1){
  const item = cart.find(i=>i.id===id);

  if(item) item.qty += qty;
  else cart.push({id,name,price,qty});

  localStorage.setItem('surabhi_cart',JSON.stringify(cart));
  updateCartUI();
  showToast('Added to cart');
}

function addBundle(qty,discountRate,cardEl){
  const total = Math.round(currentProduct.price * qty * (1-discountRate));

  document.querySelectorAll('.bundle-card').forEach(c=>c.classList.remove('selected'));
  if(cardEl) cardEl.classList.add('selected');

  cart.push({
    id:'bundle-'+Date.now(),
    name:`${currentProduct.name} (Bundle ×${qty})`,
    price:total,
    qty:1
  });

  localStorage.setItem('surabhi_cart',JSON.stringify(cart));
  updateCartUI();
  showToast('Bundle added to cart!');
}

function updateCartUI(){
  const count = cart.reduce((s,i)=>s+i.qty,0);
  document.getElementById('cart-count').textContent = count;
  const mc = document.getElementById('mobile-cart-count');
  if(mc) mc.textContent = count;
  renderCart();
  if(document.getElementById('main-cart-drawer')?.classList.contains('open')) renderCartDrawer();
}

function openCartDrawer(){
  renderCartDrawer();
  document.getElementById('main-cart-drawer').classList.add('open');
  document.getElementById('main-cart-overlay').classList.add('open');
  document.body.style.overflow='hidden';
}

function closeCartDrawer(){
  document.getElementById('main-cart-drawer').classList.remove('open');
  document.getElementById('main-cart-overlay').classList.remove('open');
  document.body.style.overflow='';
}

function renderCartDrawer(){
  const body = document.getElementById('main-cart-body');
  const foot = document.getElementById('main-cart-foot');
  const countEl = document.getElementById('main-cart-count');
  if(!body) return;
  const count = cart.reduce((s,i)=>s+i.qty,0);
  if(countEl) countEl.textContent = count;
  if(!cart.length){
    body.innerHTML='<div class="main-cart-empty">Your cart is empty.<br><small style="color:var(--text-light);">Add something beautiful.</small></div>';
    if(foot) foot.innerHTML='';
    return;
  }
  body.innerHTML = cart.map(item=>{
    const product = products.find(p=>p.id==item.id);
    const imgSrc = product ? (product.images?.[0]||'') : '';
    const imgTag = imgSrc
      ? `<img src="${imgSrc}" class="main-cart-thumb" alt="${escapeAttr(item.name)}">`
      : `<div class="main-cart-thumb"></div>`;
    return `
    <div class="main-cart-item">
      ${imgTag}
      <div class="main-cart-info">
        <div class="main-cart-name">${escapeAttr(item.name)}</div>
        <div class="main-cart-price">&#8377;${item.price} &times; ${item.qty} &nbsp;<strong style="color:var(--text-dark)">&#8377;${item.price*item.qty}</strong></div>
      </div>
      <button class="main-cart-remove" onclick="removeFromCart('${escapeAttr(item.id)}')" title="Remove">&#x2715;</button>
    </div>`;
  }).join('');
  const subtotal = cart.reduce((s,i)=>s+i.price*i.qty,0);
  if(foot) foot.innerHTML=`
    <div class="main-cart-subtotal">
      <span class="main-cart-subtotal-label">Subtotal</span>
      <span class="main-cart-subtotal-amount">&#8377;${subtotal}</span>
    </div>
    <button class="btn-primary" style="width:100%;margin-bottom:.75rem;" onclick="closeCartDrawer();showPage('checkout')">Proceed to Checkout</button>
    <button class="main-cart-continue-btn" onclick="closeCartDrawer()">Continue Shopping</button>`;
}

function renderCart(){
  const el = document.getElementById('cart-content');
  if(!el) return;

  if(!cart.length){
    el.innerHTML = `
      <div class="cart-empty-msg">
        Your bag is empty.<br>
        <button class="btn-primary" onclick="showPage('shop')" style="margin-top:1.25rem;">
          Continue Shopping
        </button>
      </div>`;
    return;
  }

  const rowsHTML = cart.map(item=>{
    const product = products.find(p=>p.id==item.id);
    const imgSrc = product ? (product.images?.[0] || '') : '';
    const imgTag = imgSrc
      ? `<img src="${imgSrc}" class="cart-item-thumb" alt="${escapeAttr(item.name)}">`
      : `<div class="cart-item-thumb" style="background:var(--beige);"></div>`;
    const lineTotal = item.price * item.qty;

    return `
      <div class="cart-item-row">
        ${imgTag}
        <div class="cart-item-name">${escapeAttr(item.name)}</div>
        <div class="cart-item-unit">&#8377; ${item.price} &#215; ${item.qty}</div>
        <div class="cart-item-total">&#8377; ${lineTotal}</div>
        <button class="cart-remove-btn" onclick="removeFromCart('${escapeAttr(item.id)}')" title="Remove">&times;</button>
      </div>`;
  }).join('');

  const subtotal = cart.reduce((s,i)=>s+i.price*i.qty,0);

  el.innerHTML = `
    <div>${rowsHTML}</div>
    <div class="cart-total-row">
      <div>
        <div class="cart-subtotal-label">Subtotal</div>
        <div class="cart-subtotal-amount">&#8377; ${subtotal}</div>
      </div>
      <button class="btn-primary" onclick="showPage('checkout')">Proceed to Checkout</button>
    </div>`;
}

function removeFromCart(id){
  cart = cart.filter(i=>i.id!=id);
  localStorage.setItem('surabhi_cart',JSON.stringify(cart));
  updateCartUI();
}

// ─────────────────────────────
// MARQUEE SCROLL
// ─────────────────────────────
function initMarquee(){
  const marqueeTrack = document.getElementById('marquee-track');
  if(!marqueeTrack) return;

  const marqueeBar = marqueeTrack.parentElement;
  const trackHTML = marqueeTrack.innerHTML;

  // Clone content to ensure seamless loop
  marqueeTrack.innerHTML = trackHTML + trackHTML;

  let scrollPos = 0;
  const trackWidth = marqueeTrack.offsetWidth / 2; // Half width (original content)

  setInterval(()=>{
    scrollPos -= 1;
    if(Math.abs(scrollPos) >= trackWidth){
      scrollPos = 0;
    }
    marqueeTrack.style.transform = `translateX(${scrollPos}px)`;
  }, 30);
}

// ─────────────────────────────
// INIT
// ─────────────────────────────
document.addEventListener('DOMContentLoaded',()=>{
  loadWelcomeContent();

  // Support deep-linking from product-detail page: ?goto=cart or ?goto=checkout
  const gotoPage = new URLSearchParams(location.search).get('goto');
  if(gotoPage){
    // Skip welcome screen, go straight to the target page
    welcomeMinTimerComplete = true;
    productsLoaded = true;
    dismissWelcome();
    setTimeout(()=>showPage(gotoPage), 50);
  } else {
    setTimeout(()=>{
      welcomeMinTimerComplete = true;
      if(productsLoaded) dismissWelcome();
    }, 1800);
  }

  fetchProducts();
  updateCartUI();
  initMarquee();
});