// --- STATE MANAGEMENT ---
const state = {
  package: null,     // { id, name, price, includedPages, brandKitBundlePrice, extraPageCost }
  brandKit: false,   // Boolean
  pages: [],         // Array of page name strings
  addons: []         // Array of { id, name, price }
};

const BASE_BRAND_KIT_PRICE = 500;

// --- STATE PERSISTENCE ---
function saveState() {
  try {
    localStorage.setItem('onboardingState', JSON.stringify(state));
  } catch (e) {
    console.error('Error saving state:', e);
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem('onboardingState');
    if (!raw) return;
    const loaded = JSON.parse(raw);
    Object.assign(state, loaded);
  } catch (e) {
    console.error('Error loading state:', e);
  }
}

// --- NAVIGATION ---
function nextStep(stepNumber) {
  saveState();
  if (stepNumber >= 1 && stepNumber <= 4) window.location.href = `step${stepNumber}.html`;
  else console.error('Invalid step number:', stepNumber);
}

// --- PACKAGE SELECTION ---
function selectPackage(id, name, price, includedPages, brandKitBundlePrice, extraPageCost, element) {
  document.querySelectorAll('.package-card').forEach(el => el.classList.remove('selected'));
  if (element) element.classList.add('selected');

  state.package = { id, name, price, includedPages, brandKitBundlePrice, extraPageCost };

  calculateTotal();
  updateBrandKitDisplay();
  saveState();
}

// --- BRAND KIT ---
function toggleBrandKit(element) {
  state.brandKit = !state.brandKit;
  if (element) element.classList.toggle('selected', state.brandKit);

  calculateTotal();
  updateBrandKitDisplay();
  saveState();
}

function updateBrandKitDisplay() {
  const bar = document.getElementById('brand-kit-bar');
  if (!bar) return;

  const ogPriceEl = bar.querySelector('.og-price');
  const discountLabelEl = bar.querySelector('.discount-label');
  const finalPriceEl = bar.querySelector('.final-price');

  if (!finalPriceEl) return;

  const hasBundle = !!(state.package && state.package.brandKitBundlePrice);
  const displayPrice = hasBundle ? Number(state.package.brandKitBundlePrice) : BASE_BRAND_KIT_PRICE;

  // Show bundle pricing visually even if not selected yet (so it’s “shown at discounted price”)
  if (hasBundle && displayPrice !== BASE_BRAND_KIT_PRICE) {
    if (ogPriceEl) {
      ogPriceEl.textContent = `$${BASE_BRAND_KIT_PRICE.toLocaleString()}`;
      ogPriceEl.style.display = 'inline';
    }
    if (discountLabelEl) discountLabelEl.style.display = 'block';
  } else {
    if (ogPriceEl) ogPriceEl.style.display = 'none';
    if (discountLabelEl) discountLabelEl.style.display = 'none';
  }

  finalPriceEl.textContent = `$${displayPrice.toLocaleString()}`;
  bar.classList.toggle('selected', !!state.brandKit);
}

// --- ADDONS ---
function toggleAddon(id, name, price, element) {
  if (element) element.classList.toggle('selected');

  const idx = state.addons.findIndex(a => a.id === id);
  if (idx === -1) state.addons.push({ id, name, price: Number(price) || 0 });
  else state.addons.splice(idx, 1);

  calculateTotal();
  saveState();
}

// Helpers for custom-priced addons
function upsertAddon(id, name, price) {
  const idx = state.addons.findIndex(a => a.id === id);
  const cleanPrice = Number(price) || 0;

  if (cleanPrice <= 0) return;

  if (idx === -1) state.addons.push({ id, name, price: cleanPrice });
  else {
    state.addons[idx].name = name;
    state.addons[idx].price = cleanPrice;
  }

  calculateTotal();
  saveState();
}

function removeAddonById(id) {
  const idx = state.addons.findIndex(a => a.id === id);
  if (idx !== -1) {
    state.addons.splice(idx, 1);
    calculateTotal();
    saveState();
  }
}

// --- INVOICE CALCULATION ---
function calculateTotal() {
  const fwItems = document.getElementById('fw-items');
  if (!fwItems) return;

  let html = '';
  let total = 0;

  if (state.package) {
    html += `<div class="fw-item"><span>${state.package.name}</span><span>$${state.package.price.toLocaleString()}</span></div>`;
    total += state.package.price;
  }

  if (state.brandKit) {
    let kitPrice = BASE_BRAND_KIT_PRICE;
    let label = 'Brand Kit';
    if (state.package && state.package.brandKitBundlePrice) {
      kitPrice = Number(state.package.brandKitBundlePrice);
      label += ' (Bundled)';
    }
    html += `<div class="fw-item"><span>+ ${label}</span><span>$${kitPrice.toLocaleString()}</span></div>`;
    total += kitPrice;
  }

  state.addons.forEach(addon => {
    html += `<div class="fw-item"><span>+ ${addon.name}</span><span>$${Number(addon.price).toLocaleString()}</span></div>`;
    total += Number(addon.price) || 0;
  });

  if (!html) html = '<p class="empty-state">Select a package to start...</p>';
  fwItems.innerHTML = html;

  const headerTotalEl = document.getElementById('fw-header-total');
  if (headerTotalEl) headerTotalEl.textContent = `$${total.toLocaleString()}`;

  const fullTotalEl = document.getElementById('fw-full-total');
  if (fullTotalEl) fullTotalEl.textContent = `$${total.toLocaleString()}`;

  const depositEl = document.getElementById('fw-deposit');
  if (depositEl) depositEl.textContent = `$${(total / 2).toLocaleString()}`;
}

// --- WIDGET ---
function toggleWidget() {
  const widget = document.getElementById('floating-widget');
  if (!widget) return;
  widget.classList.toggle('collapsed');
}

// --- COLLAPSIBLE SECTIONS (shared) ---
function initCollapsibles() {
  const sections = document.querySelectorAll('[data-collapsible]');
  sections.forEach(section => {
    const header = section.querySelector('[data-collapsible-header]');
    if (!header) return;

    // Prevent adding multiple listeners if re-initialized
    if (header.hasAttribute('data-has-listener')) return;
    header.setAttribute('data-has-listener', 'true');

    const key = section.getAttribute('data-key') || section.id;
    const storageKey = key ? `collapsible:${key}` : null;

    // Restore state from local storage
    if (storageKey) {
      const saved = localStorage.getItem(storageKey);
      if (saved === 'collapsed') {
        section.classList.add('collapsed');
      } else if (saved === 'open') {
        section.classList.remove('collapsed');
      }
    }

    // Click handler to toggle state
    header.addEventListener('click', (e) => {
      e.preventDefault(); // Prevent weird form submissions if any
      const collapsed = section.classList.toggle('collapsed');
      if (storageKey) localStorage.setItem(storageKey, collapsed ? 'collapsed' : 'open');
    });
  });
}
document.addEventListener('DOMContentLoaded', initCollapsibles);

// --- PACKAGE DETAILS TOGGLE (Step 2 cards) ---
function togglePackageDetails(buttonEl) {
  const card = buttonEl.closest('.package-card');
  if (!card) return;

  const expanded = card.classList.toggle('expanded');
  buttonEl.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  buttonEl.textContent = expanded ? 'Close Details' : 'View Details';
}

// Expose globals
window.state = state;
window.BASE_BRAND_KIT_PRICE = BASE_BRAND_KIT_PRICE;
window.saveState = saveState;
window.loadState = loadState;
window.nextStep = nextStep;
window.selectPackage = selectPackage;
window.toggleBrandKit = toggleBrandKit;
window.toggleAddon = toggleAddon;
window.calculateTotal = calculateTotal;
window.updateBrandKitDisplay = updateBrandKitDisplay;
window.toggleWidget = toggleWidget;
window.initCollapsibles = initCollapsibles;
window.togglePackageDetails = togglePackageDetails;
window.upsertAddon = upsertAddon;
window.removeAddonById = removeAddonById;
