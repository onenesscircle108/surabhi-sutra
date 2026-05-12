// ─────────────────────────────
// CONFIG
// ─────────────────────────────
const API_URL    = 'https://script.google.com/macros/s/AKfycby41ODtHTDs0oXNyZLfPcHGf-tvce7YiDvaqpWo645uPgHu5a83phSz7eZHDCx6Jwsm/exec';
const API_BACKUP = 'https://script.google.com/macros/s/AKfycbxY8IBlJ0ry42dsKVdg6SbwVRpynO3Zjw5-OJOSvQXNIHVPzYBskKRU_jX4ASXa7JzBVw/exec'; // fill in backup /exec URL once deployed

async function apiFetch(url, options){
  try{
    const res = await fetch(url, options);
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  }catch(e){
    if(!API_BACKUP) throw e;
    console.warn('Primary API failed, trying backup:', e.message);
    const backupUrl = url.replace(API_URL, API_BACKUP);
    const res = await fetch(backupUrl, options);
    return res.json();
  }
}

// ─────────────────────────────
// STATE
// ─────────────────────────────
let cart = JSON.parse(localStorage.getItem('surabhi_cart') || '[]');
let wishlist = JSON.parse(localStorage.getItem('surabhi_wishlist') || '[]');
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
  if(page==='shop')     renderShop();
  if(page==='checkout') renderCheckoutSummary();
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

const PRODUCTS_CACHE_KEY = 'surabhi_products_cache';
const PRODUCTS_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

function parseProducts(raw){
  return raw.map(p=>{
    const safeParse=(v,fb=[])=>{try{return typeof v==='string'?JSON.parse(v):v;}catch{return fb;}};
    return {
      id:p.id, name:p.name, category:p.category,
      description:p.description, price:p.price,
      images:safeParse(p.images, p.image_url?[p.image_url]:[]),
      benefits:safeParse(p.benefits,[]),
      bundle:p.bundle_enabled==='yes'
    };
  });
}

async function fetchProducts(){
  // Render from cache immediately so the page feels instant
  try{
    const cached = JSON.parse(localStorage.getItem(PRODUCTS_CACHE_KEY)||'null');
    if(cached && cached.products?.length && (Date.now()-cached.ts)<PRODUCTS_CACHE_TTL){
      products = cached.products;
      renderHome(); renderShop();
      productsLoaded = true;
      if(welcomeMinTimerComplete) dismissWelcome();
    }
  }catch(e){}

  // Fetch fresh in the background and update silently
  try{
    const data = await apiFetch(`${API_URL}?action=getProducts`);
    if(!data.success){ console.error(data); return; }

    products = parseProducts(data.products);
    localStorage.setItem(PRODUCTS_CACHE_KEY, JSON.stringify({ts:Date.now(), products}));

    renderHome(); renderShop();
    productsLoaded = true;
    if(welcomeMinTimerComplete) dismissWelcome();
  }catch(err){
    console.error(err);
    if(!products.length) showToast('Error loading products');
  }
}

// ─────────────────────────────
// RENDER
// ─────────────────────────────
// ─────────────────────────────
// REVIEWS (avg per product)
// ─────────────────────────────
let reviewsByProduct = {};
async function fetchReviews(){
  try{
    const data = await apiFetch(`${API_URL}?action=getReviews`);
    if(data.success){
      reviewsByProduct = {};
      (data.reviews||[]).forEach(r=>{
        if(!r.product_id||!r.stars) return;
        if(!reviewsByProduct[r.product_id]) reviewsByProduct[r.product_id]=[];
        reviewsByProduct[r.product_id].push(Number(r.stars));
      });
    }
  }catch(e){}
}
function getProductRating(id){
  const arr = reviewsByProduct[id];
  if(!arr||!arr.length) return null;
  return { avg:(arr.reduce((s,x)=>s+x,0)/arr.length).toFixed(1), count:arr.length };
}

function isWishlisted(id){ return wishlist.includes(String(id)); }

function toggleWishlist(id, e){
  e.stopPropagation();
  const sid = String(id);
  const idx = wishlist.indexOf(sid);
  if(idx === -1) wishlist.push(sid);
  else wishlist.splice(idx, 1);
  localStorage.setItem('surabhi_wishlist', JSON.stringify(wishlist));
  // refresh the heart on all visible cards for this product
  document.querySelectorAll(`.card-wishlist[data-id="${CSS.escape(sid)}"]`).forEach(btn=>{
    btn.classList.toggle('wishlisted', isWishlisted(sid));
    btn.title = isWishlisted(sid) ? 'Remove from wishlist' : 'Add to wishlist';
  });
}

function productCard(p){
  const img    = p.images?.[0] || '';
  const rating = getProductRating(p.id);
  const stars  = rating ? `<div class="card-stars">⭐ ${rating.avg} <span class="card-rev-count">(${rating.count})</span></div>` : '';
  const loved  = isWishlisted(p.id);

  return `
  <div class="product-card" onclick="openProduct('${escapeAttr(p.id)}')">
    <div class="product-img">
      ${img ? `<img src="${img}" loading="lazy">` : ''}
      <button class="card-wishlist${loved?' wishlisted':''}" data-id="${escapeAttr(p.id)}"
        onclick="toggleWishlist('${escapeAttr(p.id)}',event)"
        title="${loved?'Remove from wishlist':'Add to wishlist'}">&#10084;</button>
    </div>
    <div class="product-info">
      <p class="card-name">${p.name}</p>
      ${stars}
      <p class="card-price">₹ ${p.price}</p>
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
    el.innerHTML=Array(6).fill(`<div class="product-card skeleton-card">
      <div class="product-img skeleton-pulse"></div>
      <div class="product-info">
        <div class="skeleton-line" style="width:75%;"></div>
        <div class="skeleton-line" style="width:40%;margin-top:6px;"></div>
      </div></div>`).join('');
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
// ─────────────────────────────
// APPLY SITE CONTENT
// ─────────────────────────────
const _DEFAULT_CAT_TILES = [
  {name:'Face Care',    emoji:'🌸', imageUrl:'', bg:'linear-gradient(135deg,#f5edcc,#e8d8b0)'},
  {name:'Hair Care',    emoji:'🌿', imageUrl:'', bg:'linear-gradient(135deg,#dceadf,#c4d8c8)'},
  {name:'Body Wellness',emoji:'✨', imageUrl:'', bg:'linear-gradient(135deg,#e8dece,#d4c4ac)'},
  {name:'Baby & Kids',  emoji:'🤍', imageUrl:'', bg:'linear-gradient(135deg,#f0e8f0,#dccce0)'}
];

function applySiteContent(){
  try{
    const c = JSON.parse(localStorage.getItem('surabhi_site_content')||'{}');

    // Hero
    const set = (id,val,html)=>{ const el=document.getElementById(id); if(el&&val){ html?el.innerHTML=val:el.textContent=val; }};
    set('hero-eyebrow', c.heroEyebrow);
    set('hero-title',   c.heroTitle,   true);
    set('hero-sub',     c.heroSubtext);

    // Bestsellers
    set('bestsellers-label', c.bestsellersLabel);
    set('bestsellers-title', c.bestsellersTitle);

    // Promise
    set('promise-label', c.promiseLabel);
    set('promise-title', c.promiseTitle);

    // Category heading
    set('cats-eyebrow', c.catsEyebrow);
    set('cats-title',   c.catsTitle);

    // Category tiles
    const catsGrid = document.getElementById('cats-grid');
    if(catsGrid){
      const tiles = Array.isArray(c.catTiles) && c.catTiles.length ? c.catTiles : _DEFAULT_CAT_TILES;
      catsGrid.innerHTML = tiles.map(t=>{
        const hasImg = t.imageUrl && t.imageUrl.trim();
        const bgStyle = hasImg
          ? `background-image:url('${t.imageUrl}');background-size:cover;background-position:center;`
          : `background:${t.bg||'linear-gradient(135deg,#f5edcc,#e8d8b0)'};`;
        return `<div class="cat-tile" onclick="showPage('shop')">
          <div class="cat-tile-bg" style="${bgStyle}">${hasImg?'':t.emoji||''}</div>
          <div class="cat-tile-overlay"></div>
          <div class="cat-tile-label"><span class="cat-tile-name">${t.name}</span><span class="cat-tile-sub">Explore →</span></div>
        </div>`;
      }).join('');
    }

    // Philosophy
    set('phil-eyebrow', c.philEyebrow);
    set('phil-heading', c.philHeading, true);
    set('phil-body',    c.philBody);
    set('phil-btn',     c.philBtn);

    // Philosophy panel image
    const panel = document.getElementById('editorial-panel');
    const icon  = document.getElementById('editorial-icon');
    if(panel && c.philImageUrl && c.philImageUrl.trim()){
      panel.style.backgroundImage    = `url('${c.philImageUrl}')`;
      panel.style.backgroundSize     = 'cover';
      panel.style.backgroundPosition = 'center';
      panel.classList.add('has-image');
      if(icon) icon.style.display = 'none';
    } else if(panel){
      panel.style.backgroundImage = '';
      panel.classList.remove('has-image');
      if(icon){ icon.style.display=''; set('editorial-icon', c.philIcon||'☘️'); }
    }
  }catch(e){ console.warn('applySiteContent:',e); }
}

// ─────────────────────────────
// SEARCH OVERLAY
// ─────────────────────────────
function openSearch(){
  document.getElementById('search-overlay').style.display='flex';
  document.body.style.overflow='hidden';
  setTimeout(()=>document.getElementById('search-input')?.focus(),50);
}
function closeSearch(){
  document.getElementById('search-overlay').style.display='none';
  document.body.style.overflow='';
}
function liveSearch(q){
  const el = document.getElementById('search-results');
  if(!el) return;
  const query = (q||'').trim().toLowerCase();
  if(!query){ el.innerHTML=''; return; }
  const hits = products.filter(p=>
    (p.name||'').toLowerCase().includes(query)||
    (p.category||'').toLowerCase().includes(query)
  ).slice(0,6);
  el.innerHTML = hits.length
    ? hits.map(p=>`<div class="search-result-item" onclick="closeSearch();openProduct('${escapeAttr(p.id)}')">
        ${p.images?.[0]?`<img src="${p.images[0]}" class="search-thumb">`:'<div class="search-thumb search-thumb-empty"></div>'}
        <div><div class="search-item-name">${p.name}</div><div class="search-item-price">₹${p.price}</div></div>
      </div>`).join('')
    : '<p class="search-empty">No products found.</p>';
}

// ─────────────────────────────
// PROMO CODES
// ─────────────────────────────
let activePromo = null;

function applyPromo(){
  const input = document.getElementById('co-promo');
  const msgEl = document.getElementById('promo-msg');
  const code  = (input?.value||'').trim().toUpperCase();
  if(!code){ if(msgEl) msgEl.innerHTML=''; return; }

  const promos = JSON.parse(localStorage.getItem('surabhi_promos')||'[]');
  const promo  = promos.find(pr=>pr.code.toUpperCase()===code && pr.active!==false);
  if(!promo){
    if(msgEl) msgEl.innerHTML='<span style="color:#c0392b;">Invalid or expired promo code.</span>';
    return;
  }

  const subtotal = cart.reduce((s,i)=>s+i.price*i.qty,0);
  if(promo.minOrder && subtotal < Number(promo.minOrder)){
    if(msgEl) msgEl.innerHTML=`<span style="color:#c0392b;">Min order ₹${promo.minOrder} required.</span>`;
    return;
  }

  const discount = promo.type==='percent'
    ? Math.round(subtotal * Number(promo.value)/100)
    : Math.min(Number(promo.value), subtotal);

  activePromo = { code:promo.code, discount };
  if(msgEl) msgEl.innerHTML=`<span style="color:#27ae60;">✓ ${promo.code} applied — ₹${discount} off!</span>`;
  renderCheckoutSummary();
}

function clearPromo(){
  activePromo = null;
  const input = document.getElementById('co-promo');
  const msgEl = document.getElementById('promo-msg');
  if(input) input.value='';
  if(msgEl) msgEl.innerHTML='';
  renderCheckoutSummary();
}

// ─────────────────────────────
// CHECKOUT SUMMARY + PLACE ORDER
// ─────────────────────────────
function renderCheckoutSummary(){
  const el = document.getElementById('checkout-summary');
  if(!el) return;
  if(!cart.length){ el.innerHTML=''; return; }

  const subtotal = cart.reduce((s,i)=>s+i.price*i.qty,0);
  const discount = activePromo?.discount||0;
  const total    = Math.max(0, subtotal-discount);

  el.innerHTML=`
    <div class="co-summary-box">
      <div class="co-summary-title">Order Summary</div>
      ${cart.map(i=>`<div class="co-summary-row"><span>${i.name} × ${i.qty}</span><span>₹${(i.price*i.qty).toLocaleString()}</span></div>`).join('')}
      <div class="co-summary-divider"></div>
      <div class="co-summary-row"><span>Subtotal</span><span>₹${subtotal.toLocaleString()}</span></div>
      ${discount?`<div class="co-summary-row co-discount"><span>Promo (${activePromo.code})</span><span>−₹${discount.toLocaleString()}</span></div>`:''}
      <div class="co-summary-row co-total"><span>Total</span><span>₹${total.toLocaleString()}</span></div>
    </div>`;
}

async function placeOrder(){
  const name    = document.getElementById('co-name')?.value.trim();
  const email   = document.getElementById('co-email')?.value.trim();
  const phone   = document.getElementById('co-phone')?.value.trim();
  const address = document.getElementById('co-address')?.value.trim();
  const alertEl = document.getElementById('checkout-alert');

  if(!name||!email||!phone||!address){
    if(alertEl) alertEl.innerHTML='<div style="color:#c0392b;padding:8px;margin-bottom:12px;background:#fdecea;border-radius:4px;">Please fill in all fields.</div>';
    return;
  }
  if(!cart.length){
    if(alertEl) alertEl.innerHTML='<div style="color:#c0392b;padding:8px;margin-bottom:12px;background:#fdecea;border-radius:4px;">Your cart is empty.</div>';
    return;
  }

  const subtotal = cart.reduce((s,i)=>s+i.price*i.qty,0);
  const discount = activePromo?.discount||0;
  const total    = Math.max(0, subtotal-discount);
  const orderId  = 'ORD-'+Date.now();
  const itemsStr = JSON.stringify(cart.map(i=>`${i.name} ×${i.qty}`));

  const btn = document.getElementById('place-order-btn');
  if(btn){ btn.disabled=true; btn.textContent='Placing order…'; }
  if(alertEl) alertEl.innerHTML='';

  try{
    const data = await apiFetch(API_URL,{
      method:'POST',
      body: JSON.stringify({
        action:'saveOrder', order_id:orderId,
        customer_name:name, customer_email:email,
        customer_phone:phone, customer_address:address,
        items:itemsStr, total_amount:total,
        timestamp:new Date().toISOString(), status:'pending'
      })
    });
    if(data.success){
      cart=[]; localStorage.setItem('surabhi_cart',JSON.stringify(cart)); updateCartUI();
      activePromo=null;
      document.getElementById('checkout-form-wrap').style.display='none';
      document.getElementById('order-confirmation').style.display='block';
      document.getElementById('confirmation-msg').textContent=
        `Thank you ${name}! Your order ${orderId} has been placed. We'll reach you at ${phone} shortly.`;
    } else {
      if(alertEl) alertEl.innerHTML=`<div style="color:#c0392b;padding:8px;margin-bottom:12px;background:#fdecea;border-radius:4px;">${data.message||'Order failed. Please try again.'}</div>`;
    }
  }catch(e){
    if(alertEl) alertEl.innerHTML='<div style="color:#c0392b;padding:8px;margin-bottom:12px;background:#fdecea;border-radius:4px;">Network error. Please try again.</div>';
  }finally{
    if(btn){ btn.disabled=false; btn.textContent='Place Order'; }
  }
}

// ─────────────────────────────
// FOLLOW THE RITUAL GRID
// ─────────────────────────────
const RITUAL_DEFAULTS = [
  {emoji:'🌿',videoUrl:'',caption:''},
  {emoji:'🌸',videoUrl:'',caption:''},
  {emoji:'✨',videoUrl:'',caption:''},
  {emoji:'🧴',videoUrl:'',caption:''},
  {emoji:'🌺',videoUrl:'',caption:''},
  {emoji:'💆',videoUrl:'',caption:''}
];

function getYouTubeId(url){
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([^&?/\s]{11})/);
  return m ? m[1] : null;
}

function renderRitualSection(){
  try{
    const data  = JSON.parse(localStorage.getItem('surabhi_ritual')||'{}');
    const slots = (data.slots && data.slots.length) ? data.slots : RITUAL_DEFAULTS;
    const grid  = document.getElementById('ritual-grid');
    if(!grid) return;
    grid.innerHTML = slots.map(slot => {
      let media = '';
      if(slot.videoUrl && slot.videoUrl.trim()){
        const ytId = getYouTubeId(slot.videoUrl);
        if(ytId){
          media = `<iframe src="https://www.youtube.com/embed/${ytId}?autoplay=1&mute=1&loop=1&playlist=${ytId}&controls=0&modestbranding=1&playsinline=1"
            frameborder="0" allow="autoplay; encrypted-media" allowfullscreen loading="lazy"></iframe>`;
        } else {
          media = `<video autoplay muted loop playsinline><source src="${slot.videoUrl}"></video>`;
        }
      }
      return `<div class="ritual-slot">
        ${media || `<div class="ritual-slot-emoji">${slot.emoji||'🌿'}</div>`}
        ${slot.caption ? `<div class="ritual-slot-caption">${slot.caption}</div>` : ''}
      </div>`;
    }).join('');
  }catch(e){}
}

document.addEventListener('DOMContentLoaded',()=>{
  applySiteContent();
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
  fetchReviews();
  updateCartUI();
  initMarquee();
  renderRitualSection();
});