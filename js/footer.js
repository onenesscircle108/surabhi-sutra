const DEFAULT_FOOTER = {
  brand_desc: 'Surabhi Sutra brings five thousand years of Ayurvedic wisdom into your daily skincare ritual. Every product is made fresh, in small batches, with ingredients your skin was always meant to meet. No shortcuts. No synthetics. Just nature, distilled.',
  socials: [
    { name: 'Telegram',   url: '#', label: 'T'  },
    { name: 'Facebook',   url: '#', label: 'f'  },
    { name: 'Instagram',  url: '#', label: 'ig' }
  ],
  contact: [
    { label: 'WhatsApp Us',            url: '#'                           },
    { label: 'hello@surabhisutra.in',  url: 'mailto:hello@surabhisutra.in' }
  ],
  office_name:    'Surabhi Sutra Naturals',
  office_address: 'New Delhi, India — 110001',
  copyright:      '© 2025 Surabhi Sutra · All rights reserved · Made with love in India'
};

function getFooterSettings() {
  try {
    const s = JSON.parse(localStorage.getItem('surabhi_footer_settings') || '{}');
    return {
      brand_desc:     s.brand_desc     ?? DEFAULT_FOOTER.brand_desc,
      socials:        (s.socials && s.socials.length)  ? s.socials  : DEFAULT_FOOTER.socials,
      contact:        (s.contact && s.contact.length)  ? s.contact  : DEFAULT_FOOTER.contact,
      office_name:    s.office_name    ?? DEFAULT_FOOTER.office_name,
      office_address: s.office_address ?? DEFAULT_FOOTER.office_address,
      copyright:      s.copyright      ?? DEFAULT_FOOTER.copyright
    };
  } catch { return { ...DEFAULT_FOOTER }; }
}

function renderFooter() {
  const s = getFooterSettings();

  const descEl = document.getElementById('footer-brand-desc');
  if (descEl) descEl.textContent = s.brand_desc;

  const socialsEl = document.getElementById('footer-socials');
  if (socialsEl) {
    socialsEl.innerHTML = s.socials.map(soc =>
      `<a href="${soc.url || '#'}" title="${soc.name || ''}" target="${soc.url && soc.url !== '#' ? '_blank' : '_self'}" rel="noopener">${soc.label || soc.name}</a>`
    ).join('');
  }

  const contactEl = document.getElementById('footer-contact-list');
  if (contactEl) {
    contactEl.innerHTML = s.contact.map(c =>
      `<li><a href="${c.url || '#'}">${c.label}</a></li>`
    ).join('');
  }

  const officeEl = document.getElementById('footer-office-block');
  if (officeEl) {
    officeEl.innerHTML = s.office_name
      ? `<h4 style="margin-top:1.5rem;">Office</h4><p style="font-size:12px;opacity:.6;line-height:1.8;">${s.office_name}<br>${(s.office_address || '').replace(/\n/g,'<br>')}</p>`
      : '';
  }

  const copyrightEl = document.getElementById('footer-copyright');
  if (copyrightEl) copyrightEl.textContent = s.copyright;

  try {
    const cart = JSON.parse(localStorage.getItem('surabhi_cart') || '[]');
    const count = cart.reduce((a, i) => a + (i.qty || 1), 0);
    ['cart-count','mobile-cart-count'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = count;
    });
  } catch {}
}
