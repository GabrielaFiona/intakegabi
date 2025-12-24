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

/* =========================================
   CONFIG & DATA
   ========================================= */
const CONSTANTS = {
  EXTRA_PAGE_PRICE: 150, // Easy to change
  PACKAGES: {
    basic: { name: "Basic Website", included: 2, price: 1500 },
    standard: { name: "Standard Website", included: 5, price: 2500 },
    advanced: { name: "Advanced Website", included: 10, price: 4500 }
  }
};

const INDUSTRY_DATA = {
  "Restaurant / Cafe": {
    basic: ["Home", "Contact", "Menu"],
    standard: ["Home", "About", "Menu", "Reservations", "Contact", "Gallery"],
    advanced: ["Home", "About", "Menu", "Reservations", "Online Ordering", "Events", "Reviews", "FAQ", "Contact", "Location"]
  },
  "Contractor / Trades": {
    basic: ["Home", "Contact", "Services"],
    standard: ["Home", "About", "Services", "Projects", "Testimonials", "Contact"],
    advanced: ["Home", "About", "Services", "Service Areas", "Gallery", "Reviews", "Estimates", "FAQ", "Blog", "Contact"]
  },
  "Boutique / Retail": {
    basic: ["Home", "Contact", "Products"],
    standard: ["Home", "About", "Products", "New Arrivals", "FAQ", "Contact"],
    advanced: ["Home", "About", "Shop", "Collections", "Lookbook", "Size Guide", "Reviews", "Contact", "Press"]
  },
  "E-commerce Brand": {
    basic: ["Home", "Contact", "Shop"],
    standard: ["Home", "About", "Shop", "Shipping/Returns", "FAQ", "Contact"],
    advanced: ["Home", "About", "Shop", "Collections", "Support", "Returns", "Reviews", "Contact", "Order Tracking"]
  },
  "Hotel / Rental": {
    basic: ["Home", "Contact", "Rooms"],
    standard: ["Home", "Rooms", "Amenities", "Location", "Contact"],
    advanced: ["Home", "Rooms", "Booking", "Amenities", "Gallery", "Local Guide", "Reviews", "FAQ", "Contact"]
  },
  "Real Estate": {
    basic: ["Home", "Contact", "Listings"],
    standard: ["Home", "About", "Listings", "Buyers", "Sellers", "Contact"],
    advanced: ["Home", "About", "Listings", "Neighborhoods", "Testimonials", "FAQ", "Blog", "Contact", "Home Valuation"]
  },
  "Health / Wellness": {
    basic: ["Home", "Contact", "Services"],
    standard: ["Home", "About", "Services", "Pricing", "Contact"],
    advanced: ["Home", "About", "Services", "Booking", "Team", "Gallery", "Reviews", "FAQ", "Contact"]
  },
  "General Business": { // Fallback
    basic: ["Home", "Contact", "About"],
    standard: ["Home", "About", "Services", "Testimonials", "Contact", "FAQ"],
    advanced: ["Home", "About", "Services", "Case Studies", "Testimonials", "FAQ", "Blog", "Contact", "Privacy Policy"]
  }
};

// Global State
let state = {
  client: { name: "", industry: "", industryPreview: [] },
  package: { id: null, price: 0, included: 0 },
  pages: [],
  planning: {}, // Stores step 3 data
  addons: [] // Branding, etc.
};

/* =========================================
   CORE FUNCTIONS (Load/Save/Init)
   ========================================= */
document.addEventListener('DOMContentLoaded', () => {
  loadState();
  initCollapsibles();
  initWidget();
  
  if (document.body.classList.contains('step1')) initStep1();
  if (document.body.classList.contains('step2')) initStep2();
  if (document.body.classList.contains('step3')) initStep3();
  
  calculateTotal();
});

function saveState() {
  localStorage.setItem('onboardingState', JSON.stringify(state));
  calculateTotal();
}

function loadState() {
  const raw = localStorage.getItem('onboardingState');
  if (raw) {
    state = JSON.parse(raw);
  }
}

function nextStep(step) {
  saveState();
  window.location.href = `step${step}.html`;
}

function calculateTotal() {
  const fwItems = document.getElementById('fw-items');
  const fwTotal = document.getElementById('fw-full-total');
  const fwDeposit = document.getElementById('fw-deposit');
  if (!fwItems) return;

  let total = 0;
  let html = '';

  // Package Base
  if (state.package.id) {
    total += state.package.price;
    html += `<div class="fw-item"><span>${CONSTANTS.PACKAGES[state.package.id].name}</span><span>$${state.package.price.toLocaleString()}</span></div>`;
  }

  // Extra Pages
  const extraPages = Math.max(0, state.pages.length - state.package.included);
  if (extraPages > 0) {
    const cost = extraPages * CONSTANTS.EXTRA_PAGE_PRICE;
    total += cost;
    html += `<div class="fw-item"><span>Extra Pages (${extraPages})</span><span>$${cost.toLocaleString()}</span></div>`;
  }

  // Addons
  state.addons.forEach(addon => {
    total += addon.price;
    html += `<div class="fw-item"><span>${addon.name}</span><span>$${addon.price}</span></div>`;
  });

  if (html === '') html = '<p class="empty-state" style="font-size:0.8rem; font-style:italic;">Select a package...</p>';
  
  fwItems.innerHTML = html;
  fwTotal.textContent = `$${total.toLocaleString()}`;
  fwDeposit.textContent = `$${(total/2).toLocaleString()}`;
  
  // Header Total
  const headerTotal = document.getElementById('fw-header-total');
  if (headerTotal) headerTotal.textContent = `$${total.toLocaleString()}`;
}

/* =========================================
   STEP 1: GOALS & INDUSTRY PREVIEW
   ========================================= */
function initStep1() {
  const indInput = document.getElementById('industryInput');
  const previewBox = document.getElementById('industryPreviewChips');
  
  // Restore
  if (state.client.industry) indInput.value = state.client.industry;
  updateIndustryPreview(indInput.value);

  indInput.addEventListener('input', (e) => {
    state.client.industry = e.target.value;
    updateIndustryPreview(e.target.value);
    saveState();
  });
}

function updateIndustryPreview(val) {
  const previewBox = document.getElementById('industryPreviewChips');
  if (!previewBox) return;
  
  // Fuzzy match industry
  let match = "General Business";
  const search = val.toLowerCase();
  for (const key in INDUSTRY_DATA) {
    if (search && key.toLowerCase().includes(search)) {
      match = key;
      break;
    }
  }
  
  // Just show Standard list as a teaser
  const suggestions = INDUSTRY_DATA[match].standard;
  previewBox.innerHTML = suggestions.map(s => `<span class="chip" style="cursor:default; opacity:0.8;">${s}</span>`).join('');
}

/* =========================================
   STEP 2: PACKAGE & PAGE BUILDER
   ========================================= */
function initStep2() {
  // 1. Package Selection
  const cards = document.querySelectorAll('.package-card');
  cards.forEach(card => {
    card.addEventListener('click', () => {
      const pid = card.dataset.packageId;
      cards.forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      
      const def = CONSTANTS.PACKAGES[pid];
      state.package = { id: pid, price: def.price, included: def.included };
      
      // Auto-populate default pages if empty
      if (state.pages.length === 0) {
        state.pages = getDefaultPagesForPackage(pid, state.client.industry);
      }
      
      updatePageBuilderUI();
      saveState();
    });
  });

  // Restore Package
  if (state.package.id) {
    const sel = document.querySelector(`.package-card[data-package-id="${state.package.id}"]`);
    if (sel) sel.classList.add('selected');
  }

  // 2. Page Builder Inputs
  const input = document.getElementById('pageInput');
  const addBtn = document.getElementById('addPageBtn');
  
  addBtn.addEventListener('click', () => {
    if (input.value.trim()) addPage(input.value.trim());
    input.value = '';
  });

  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      if (input.value.trim()) addPage(input.value.trim());
      input.value = '';
    }
  });

  updatePageBuilderUI();
}

function getDefaultPagesForPackage(pid, industryVal) {
  let match = "General Business";
  const search = (industryVal || "").toLowerCase();
  for (const key in INDUSTRY_DATA) {
    if (search && key.toLowerCase().includes(search)) {
      match = key;
      break;
    }
  }
  // Return a slice so we don't modify the master list
  return [...INDUSTRY_DATA[match][pid]]; 
}

function addPage(name) {
  if (!state.pages.includes(name)) {
    state.pages.push(name);
    updatePageBuilderUI();
    saveState();
  }
}

function removePage(name) {
  state.pages = state.pages.filter(p => p !== name);
  updatePageBuilderUI();
  saveState();
}

function updatePageBuilderUI() {
  const container = document.getElementById('addedPagesContainer');
  const suggestionContainer = document.getElementById('pageSuggestions');
  const counterEl = document.getElementById('pageCountDisplay');
  
  if (!container) return; // Not on step 2

  // Render Added Pages
  container.innerHTML = '';
  state.pages.forEach(page => {
    const pill = document.createElement('div');
    pill.className = 'page-pill';
    pill.innerHTML = `${page} <span class="remove-page" onclick="removePage('${page}')">&times;</span>`;
    container.appendChild(pill);
  });

  // Calculate Cost Logic
  const included = state.package.included || 0;
  const count = state.pages.length;
  const extra = Math.max(0, count - included);
  
  let costHtml = `Pages: <strong>${count}</strong>`;
  if (state.package.id) {
    costHtml += ` / ${included} Included`;
    if (extra > 0) {
      costHtml += `<span class="cost-badge extra">+${extra} Extra ($${extra * CONSTANTS.EXTRA_PAGE_PRICE})</span>`;
    } else {
      costHtml += `<span class="cost-badge included">Included ✅</span>`;
    }
  }
  counterEl.innerHTML = costHtml;

  // Render Suggestions
  if (state.package.id) {
    let match = "General Business";
    const search = (state.client.industry || "").toLowerCase();
    for (const key in INDUSTRY_DATA) {
      if (search && key.toLowerCase().includes(search)) {
        match = key; break;
      }
    }
    
    // Get list for current package tier
    const potential = INDUSTRY_DATA[match][state.package.id];
    
    // Filter out already added
    const suggestions = potential.filter(p => !state.pages.includes(p));
    
    suggestionContainer.innerHTML = suggestions.map(s => 
      `<span class="chip" onclick="addPage('${s}')"><span>+</span> ${s}</span>`
    ).join('');
  }
}

/* =========================================
   STEP 3: PLANNING (DYNAMIC GENERATOR)
   ========================================= */
function initStep3() {
  const container = document.getElementById('planningContainer');
  const summary = document.getElementById('planSummary');
  
  if (!state.package.id) {
    container.innerHTML = "<p>Please select a package in Step 2 first.</p>";
    return;
  }

  // Summary
  const extra = Math.max(0, state.pages.length - state.package.included);
  summary.innerHTML = `
    <strong>${CONSTANTS.PACKAGES[state.package.id].name}</strong> Plan<br/>
    ${state.pages.length} Pages (${state.package.included} included, ${extra} extra)
  `;

  // Render Strategy
  if (state.package.id === 'basic') renderBasicPlanning(container);
  else if (state.package.id === 'standard') renderStandardPlanning(container);
  else if (state.package.id === 'advanced') renderAdvancedPlanning(container);
}

// --- BASIC: Notes Only ---
function renderBasicPlanning(container) {
  state.pages.forEach(page => {
    const id = page.replace(/\s+/g, '-').toLowerCase();
    const existing = state.planning[id] || {};
    
    const html = `
      <div class="collapsible">
        <button class="collapsible-header">
          <div class="collapsible-title" style="font-size:1.2rem;">${page}</div>
          <span class="collapsible-chevron">▾</span>
        </button>
        <div class="collapsible-body" style="grid-template-rows: 1fr;"> <div class="collapsible-inner">
            <label>Goal of this page</label>
            <input type="text" placeholder="e.g. Get them to call me" onchange="savePlan('${id}', 'goal', this.value)" value="${existing.goal || ''}">
            <label style="margin-top:15px;">Main Notes</label>
            <textarea rows="3" onchange="savePlan('${id}', 'notes', this.value)">${existing.notes || ''}</textarea>
            <label style="margin-top:15px;">Call to Action</label>
            <select onchange="savePlan('${id}', 'cta', this.value)">
              <option value="">Select...</option>
              <option value="Call" ${existing.cta === 'Call' ? 'selected' : ''}>Call Us</option>
              <option value="Form" ${existing.cta === 'Form' ? 'selected' : ''}>Fill Form</option>
              <option value="Buy" ${existing.cta === 'Buy' ? 'selected' : ''}>Buy Now</option>
            </select>
          </div>
        </div>
      </div>
    `;
    container.insertAdjacentHTML('beforeend', html);
  });
  initCollapsibles(); // Re-bind listeners
}

// --- STANDARD: Visual Section Builder ---
function renderStandardPlanning(container) {
  // Create Tabs
  const tabsHtml = `
    <div class="plan-tabs" id="stdPlanTabs">
      ${state.pages.map((p, i) => `<button class="plan-tab ${i===0?'active':''}" onclick="switchTab('${i}')">${p}</button>`).join('')}
    </div>
    <div id="stdPlanContent"></div>
  `;
  container.innerHTML = tabsHtml;
  
  // Render Modules (Hidden except first)
  const contentBox = document.getElementById('stdPlanContent');
  state.pages.forEach((page, i) => {
    const id = page.replace(/\s+/g, '-').toLowerCase();
    const html = `
      <div class="plan-module ${i===0?'active':''}" id="module-${i}">
        <h4>Planning: ${page}</h4>
        <div class="section-builder-container">
          <div class="section-palette">
            <p style="font-size:0.8rem; text-transform:uppercase;">Click to Add Section</p>
            ${['Hero Section', 'Text Block', 'Gallery', 'Services List', 'Testimonials', 'FAQ', 'Contact Form', 'Map'].map(s => 
              `<div class="draggable-section" onclick="addSectionToPage('${id}', '${s}')">+ ${s}</div>`
            ).join('')}
          </div>
          <div class="page-canvas" id="canvas-${id}">
            ${(state.planning[id]?.sections || []).map(s => renderSectionCard(s)).join('')}
            ${(!state.planning[id]?.sections) ? '<p style="opacity:0.5; text-align:center; padding-top:40px;">Add sections from the left...</p>' : ''}
          </div>
        </div>
      </div>
    `;
    contentBox.insertAdjacentHTML('beforeend', html);
  });
}

function addSectionToPage(pageId, sectionName) {
  if (!state.planning[pageId]) state.planning[pageId] = { sections: [] };
  if (!state.planning[pageId].sections) state.planning[pageId].sections = [];
  
  state.planning[pageId].sections.push(sectionName);
  saveState();
  
  // Update UI immediately
  const canvas = document.getElementById(`canvas-${pageId}`);
  // Clear placeholder if exists
  if (canvas.innerHTML.includes('Add sections')) canvas.innerHTML = '';
  canvas.insertAdjacentHTML('beforeend', renderSectionCard(sectionName));
}

function renderSectionCard(name) {
  return `<div class="canvas-item"><strong>${name}</strong><br/><input type="text" placeholder="Notes for this section..." style="margin-top:5px; font-size:0.85rem; padding:8px;"></div>`;
}

// --- ADVANCED: Advanced Tabs + Flowchart ---
function renderAdvancedPlanning(container) {
  // Tabs: Pages + System Map
  const tabsHtml = `
    <div class="plan-tabs">
      <button class="plan-tab active" onclick="switchTab('map')">System Flowchart</button>
      ${state.pages.map((p, i) => `<button class="plan-tab" onclick="switchTab('${i}')">${p}</button>`).join('')}
    </div>
    
    <div class="plan-module active" id="module-map">
      <p>Map your business flow (Integrations & Automations).</p>
      <div style="margin-bottom:10px;">
        <button class="btn btn-secondary" onclick="addFlowNode('Page')">+ Page</button>
        <button class="btn btn-secondary" onclick="addFlowNode('Form')">+ Form</button>
        <button class="btn btn-secondary" onclick="addFlowNode('Email')">+ Email</button>
        <button class="btn btn-secondary" onclick="addFlowNode('Payment')">+ Payment</button>
      </div>
      <div class="flowchart-canvas" id="flowCanvas">
        </div>
    </div>
    
    <div id="advPageModules"></div>
  `;
  container.innerHTML = tabsHtml;

  // Render Page Planner Modules
  const modContainer = document.getElementById('advPageModules');
  state.pages.forEach((page, i) => {
    const id = page.replace(/\s+/g, '-').toLowerCase();
    modContainer.insertAdjacentHTML('beforeend', `
      <div class="plan-module" id="module-${i}">
        <h4>Advanced Strategy: ${page}</h4>
        <div class="form-grid">
          <div><label>SEO Focus Keyword</label><input type="text"></div>
          <div><label>Conversion Action</label>
            <select><option>Book Call</option><option>Buy Product</option><option>Submit Form</option></select>
          </div>
          <div class="full-width">
            <label>Integrations Required</label>
            <div style="display:flex; gap:10px; flex-wrap:wrap;">
              ${['Booking', 'Payment', 'CRM', 'Analytics', 'Live Chat'].map(opt => `<label style="display:inline-flex; align-items:center; gap:5px; border:1px solid #333; padding:5px 10px; border-radius:4px;"><input type="checkbox"> ${opt}</label>`).join('')}
            </div>
          </div>
        </div>
      </div>
    `);
  });
  
  // Init default flow nodes based on pages
  if (!state.planning.flowNodes) {
    state.planning.flowNodes = [];
    // Smart suggestions
    state.pages.forEach((p, idx) => {
      addFlowNode('Page', p, 20 + (idx*190), 50, false); // Stagger positions
    });
  }
  renderFlowNodes();
}

// Simple Flowchart Logic
function addFlowNode(type, label = '', x=20, y=20, save=true) {
  if (!state.planning.flowNodes) state.planning.flowNodes = [];
  const node = { id: Date.now(), type, label: label || type, x, y };
  state.planning.flowNodes.push(node);
  if (save) { saveState(); renderFlowNodes(); }
}

function renderFlowNodes() {
  const canvas = document.getElementById('flowCanvas');
  if (!canvas || !state.planning.flowNodes) return;
  
  canvas.innerHTML = state.planning.flowNodes.map(node => `
    <div class="flow-node" style="left:${node.x}px; top:${node.y}px;" draggable="true" ondragend="updateNodePos(${node.id}, event)">
      <div class="flow-node-header"><span>${node.type}</span> <span>::</span></div>
      <input type="text" value="${node.label}" style="background:transparent; border:none; color:white; width:100%; font-size:0.9rem;" onchange="updateNodeLabel(${node.id}, this.value)">
      <div class="flow-connector">Connects to... ▼</div>
    </div>
  `).join('');
}

function updateNodePos(id, e) {
  const rect = document.getElementById('flowCanvas').getBoundingClientRect();
  const nodeIdx = state.planning.flowNodes.findIndex(n => n.id === id);
  if (nodeIdx > -1) {
    state.planning.flowNodes[nodeIdx].x = e.clientX - rect.left - 90; // center offset
    state.planning.flowNodes[nodeIdx].y = e.clientY - rect.top - 20;
    saveState();
    renderFlowNodes();
  }
}

// Helpers
function savePlan(pageId, field, value) {
  if (!state.planning[pageId]) state.planning[pageId] = {};
  state.planning[pageId][field] = value;
  saveState();
}

function switchTab(idx) {
  document.querySelectorAll('.plan-tab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.plan-module').forEach(m => m.classList.remove('active'));
  
  // Handle string ID (map) or index
  if (idx === 'map') {
    document.querySelector('button[onclick="switchTab(\'map\')"]').classList.add('active');
    document.getElementById('module-map').classList.add('active');
  } else {
    document.querySelectorAll('.plan-tab')[parseInt(idx) + (document.getElementById('module-map')?1:0)].classList.add('active');
    document.getElementById(`module-${idx}`).classList.add('active');
  }
}

// Shared Collapsibles (keep existing logic)
function initCollapsibles() {
  document.querySelectorAll('.collapsible-header').forEach(btn => {
    btn.onclick = () => {
      const parent = btn.closest('.collapsible');
      parent.classList.toggle('collapsed');
    }
  });
}
function initWidget() {
  document.querySelector('.fw-header').onclick = () => {
    document.getElementById('floating-widget').classList.toggle('collapsed');
  }
}
