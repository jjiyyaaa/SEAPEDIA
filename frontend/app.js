const API_BASE_URL = 'http://localhost:5000/api';

// Application State
let state = {
  token: localStorage.getItem('seapedia_token') || null,
  activeRole: localStorage.getItem('seapedia_active_role') || null,
  user: JSON.parse(localStorage.getItem('seapedia_user')) || null,
  selectedReviewRating: 5,
  products: [],
  cart: { items: [], subtotal: 0 },
  appliedDiscount: null
};

// Role Descriptions and Icons for Selection Page
const roleInfo = {
  BUYER: { icon: '🛒', desc: 'Shop premium sea products, hire logistics drivers, and manage orders.' },
  SELLER: { icon: '🏪', desc: 'Sell sea products, manage inventory, list boat rentals, and track income.' },
  DRIVER: { icon: '🚚', desc: 'Manage shipments, check logistics orders, and update delivery status.' },
  ADMIN: { icon: '🛡️', desc: 'Monitor application, verify sellers, and oversee platform status.' }
};

// DOM Elements
const pages = document.querySelectorAll('.page-section');
const navLinks = document.querySelectorAll('.nav-link');
const logo = document.getElementById('nav-logo');
const navGuestItem = document.getElementById('nav-guest-item');
const navUserItem = document.getElementById('nav-user-item');
const navUsername = document.getElementById('nav-username');
const navActiveRole = document.getElementById('nav-active-role');
const alertBanner = document.getElementById('alert-banner');
const navDashboardItem = document.getElementById('nav-dashboard-item');

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  renderProducts(); 
  fetchReviews();
  verifySession();
});

// Event Listeners Configuration
function setupEventListeners() {
  // Navigation Links
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const target = link.getAttribute('data-target');
      if (target === 'auth-section' && state.token && state.activeRole) {
        navigateTo('dashboard-section');
      } else {
        navigateTo(target);
      }
    });
  });

  logo.addEventListener('click', (e) => {
    e.preventDefault();
    navigateTo('landing-section');
  });

  // Hero Actions
  document.getElementById('btn-hero-explore').addEventListener('click', () => navigateTo('shop-section'));
  document.getElementById('btn-hero-login').addEventListener('click', () => navigateTo('auth-section'));

  // Auth Tabs (Login / Register)
  const tabLogin = document.getElementById('tab-login');
  const tabRegister = document.getElementById('tab-register');
  const viewLogin = document.getElementById('login-form-container');
  const viewRegister = document.getElementById('register-form-container');

  tabLogin.addEventListener('click', () => {
    tabLogin.classList.add('active');
    tabRegister.classList.remove('active');
    viewLogin.style.display = 'block';
    viewRegister.style.display = 'none';
  });

  tabRegister.addEventListener('click', () => {
    tabRegister.classList.add('active');
    tabLogin.classList.remove('active');
    viewRegister.style.display = 'block';
    viewLogin.style.display = 'none';
  });

  // Star Rating Selector Logic
  const stars = document.querySelectorAll('#rating-select .rating-star');
  stars.forEach(star => {
    star.addEventListener('click', () => {
      const rating = parseInt(star.getAttribute('data-rating'), 10);
      state.selectedReviewRating = rating;
      
      stars.forEach(s => {
        const sRating = parseInt(s.getAttribute('data-rating'), 10);
        if (sRating <= rating) {
          s.classList.add('selected');
        } else {
          s.classList.remove('selected');
        }
      });
    });
  });
  if (stars && stars.length >= 5) {
    stars[4].click();
  }

  // Review Form Submit
  document.getElementById('form-review').addEventListener('submit', handleReviewSubmit);

  // Authentication Forms Submit
  document.getElementById('form-register').addEventListener('submit', handleRegisterSubmit);
  document.getElementById('form-login').addEventListener('submit', handleLoginSubmit);

  // Logout Button
  document.getElementById('btn-logout').addEventListener('click', handleLogout);

  // Modals Close
  document.getElementById('btn-close-modal').addEventListener('click', () => {
    closeModal('product-detail-modal');
  });

  document.getElementById('btn-close-product-modal').addEventListener('click', () => {
    closeModal('product-form-modal');
  });

  document.getElementById('btn-close-checkout-modal').addEventListener('click', () => {
    closeModal('checkout-modal');
  });

  // Add Product Button Click (Seller)
  document.getElementById('btn-add-product').addEventListener('click', () => {
    document.getElementById('form-product').reset();
    document.getElementById('product-id-input').value = '';
    document.getElementById('product-modal-title').textContent = 'Add New Product';
    openModal('product-form-modal');
  });

  // Product Form Submit (Create / Edit)
  document.getElementById('form-product').addEventListener('submit', handleProductFormSubmit);

  // Wallet topup form (Buyer)
  document.getElementById('form-topup').addEventListener('submit', handleTopupSubmit);

  // Shipping address form (Buyer)
  document.getElementById('form-address').addEventListener('submit', handleAddressSubmit);

  // Clear Cart button (Buyer)
  document.getElementById('btn-clear-cart').addEventListener('click', handleClearCart);

  // Checkout trigger (Buyer)
  document.getElementById('btn-cart-checkout').addEventListener('click', handleCheckoutTrigger);

  // Delivery Method selector change (Buyer)
  document.getElementById('checkout-delivery-method').addEventListener('change', updateCheckoutSummaryBreakdown);

  // Apply Discount Code click (Buyer)
  document.getElementById('btn-apply-discount').addEventListener('click', handleApplyDiscount);

  // Checkout confirmation payment (Buyer)
  document.getElementById('btn-confirm-checkout').addEventListener('click', handleConfirmCheckout);

  // Admin Workspace event listeners
  const btnSimulateNextDay = document.getElementById('btn-simulate-next-day');
  if (btnSimulateNextDay) {
    btnSimulateNextDay.addEventListener('click', triggerTimeSimulation);
  }

  const formGenerateDiscount = document.getElementById('form-generate-discount');
  if (formGenerateDiscount) {
    formGenerateDiscount.addEventListener('submit', handleAdminDiscountSubmit);
  }

  const discountTypeSelect = document.getElementById('discount-type');
  const discountUsageContainer = document.getElementById('discount-usage-container');
  if (discountTypeSelect && discountUsageContainer) {
    discountTypeSelect.addEventListener('change', (e) => {
      if (e.target.value === 'promo') {
        discountUsageContainer.style.display = 'none';
      } else {
        discountUsageContainer.style.display = 'block';
      }
    });
  }
}

// Router/Navigation Helper
function navigateTo(sectionId) {
  pages.forEach(page => {
    if (page.id === sectionId) {
      page.classList.add('active');
    } else {
      page.classList.remove('active');
    }
  });

  navLinks.forEach(link => {
    const target = link.getAttribute('data-target');
    if (target === sectionId || (sectionId === 'landing-section' && target === 'landing-section')) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });

  if (sectionId === 'shop-section') {
    renderProducts();
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Modal Helper Functions
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('active');
    document.body.classList.add('modal-open');
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active');
    if (document.querySelectorAll('.modal.active').length === 0) {
      document.body.classList.remove('modal-open');
    }
  }
}

// Alert notifications
function showAlert(message, type = 'success') {
  alertBanner.textContent = message;
  alertBanner.className = `alert-banner ${type}`;
  alertBanner.style.display = 'block';
  
  setTimeout(() => {
    alertBanner.style.display = 'none';
  }, 4000);
}

// Render Products List (Fetch from Live DB)
async function renderProducts() {
  const grid = document.getElementById('products-grid');
  grid.innerHTML = '<div style="text-align:center; grid-column: 1/-1; color: var(--text-secondary);">Loading catalog...</div>';

  try {
    const res = await fetch(`${API_BASE_URL}/products`);
    if (!res.ok) throw new Error('Could not load products');
    state.products = await res.json();

    grid.innerHTML = '';

    if (state.products.length === 0) {
      grid.innerHTML = `
        <div style="text-align: center; color: var(--text-secondary); padding: 2rem; grid-column: 1/-1;">
          No products listed in the marketplace yet.
        </div>
      `;
      document.getElementById('shop-count').textContent = 'Showing 0 products';
      return;
    }

    state.products.forEach(prod => {
      const card = document.createElement('div');
      card.className = 'product-card';
      
      let icon = '🐟';
      const nameLower = prod.name.toLowerCase();
      if (nameLower.includes('lobster')) icon = '🦞';
      else if (nameLower.includes('crab')) icon = '🦀';
      else if (nameLower.includes('shrimp') || nameLower.includes('udang')) icon = '🦐';
      else if (nameLower.includes('rod') || nameLower.includes('pancing') || nameLower.includes('gear')) icon = '🎣';
      else if (nameLower.includes('boat') || nameLower.includes('kapal') || nameLower.includes('sewa')) icon = '⛵';
      else if (nameLower.includes('box') || nameLower.includes('cooler') || nameLower.includes('cargo')) icon = '📦';
      else if (nameLower.includes('octopus') || nameLower.includes('gurita')) icon = '🐙';
      else if (nameLower.includes('squid') || nameLower.includes('cumi')) icon = '🦑';

      card.innerHTML = `
        <div class="product-img-wrapper">
          ${icon}
          <span class="product-tag">${escapeHTML(prod.store.name)}</span>
        </div>
        <div class="product-info">
          <h3 class="product-title">${escapeHTML(prod.name)}</h3>
          <p class="product-desc">${escapeHTML(prod.description.substring(0, 75))}...</p>
          <div class="product-meta">
            <span class="product-price">${formatRupiah(prod.price)}</span>
            <button class="btn btn-secondary btn-sm" onclick="showProductDetails(${prod.id})">Details</button>
          </div>
        </div>
      `;
      grid.appendChild(card);
    });

    document.getElementById('shop-count').textContent = `Showing ${state.products.length} products`;

  } catch (error) {
    console.error('Error fetching catalog:', error);
    grid.innerHTML = `<div style="text-align:center; grid-column: 1/-1; color: var(--color-error);">Error loading catalog: ${error.message}</div>`;
  }
}

// Format currency
function formatRupiah(amount) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(amount);
}

// Show Product Details Modal (Fetch Live Detail from API)
window.showProductDetails = async function(productId) {
  try {
    const res = await fetch(`${API_BASE_URL}/products/${productId}`);
    if (!res.ok) throw new Error('Product details not found');
    const prod = await res.json();

    let icon = '🐟';
    const nameLower = prod.name.toLowerCase();
    if (nameLower.includes('lobster')) icon = '🦞';
    else if (nameLower.includes('crab')) icon = '🦀';
    else if (nameLower.includes('shrimp')) icon = '🦐';
    else if (nameLower.includes('rod') || nameLower.includes('gear')) icon = '🎣';
    else if (nameLower.includes('boat')) icon = '⛵';
    else if (nameLower.includes('box') || nameLower.includes('cooler')) icon = '📦';

    document.getElementById('modal-product-img').textContent = icon;
    document.getElementById('modal-product-tag').textContent = `Seller Store`;
    document.getElementById('modal-product-title').textContent = prod.name;
    document.getElementById('modal-product-desc').textContent = prod.description;
    
    document.getElementById('modal-product-seller').textContent = prod.store.name;
    document.getElementById('modal-product-origin').textContent = `Seller ID: ${prod.store.userId}`;
    document.getElementById('modal-product-freshness').textContent = prod.stock > 0 ? `In Stock (${prod.stock} unit)` : 'Out of Stock';
    document.getElementById('modal-product-price').textContent = formatRupiah(prod.price);

    const modalActionBtn = document.getElementById('btn-modal-action');
    
    if (state.token && state.activeRole) {
      if (state.activeRole === 'BUYER') {
        if (prod.stock <= 0) {
          modalActionBtn.textContent = 'Out of Stock';
          modalActionBtn.disabled = true;
        } else {
          modalActionBtn.textContent = `Add to Cart (Sold by ${prod.store.name})`;
          modalActionBtn.disabled = false;
          modalActionBtn.onclick = () => handleAddToCart(prod.id);
        }
      } else {
        // Logged in but not Buyer (e.g. Seller)
        modalActionBtn.textContent = `Active role: ${state.activeRole}`;
        modalActionBtn.disabled = true;
      }
    } else {
      modalActionBtn.textContent = "Login to Purchase";
      modalActionBtn.disabled = false;
      modalActionBtn.onclick = () => {
        closeModal('product-detail-modal');
        navigateTo('auth-section');
        showAlert("Please login or register to perform transactions.", "error");
      };
    }

    openModal('product-detail-modal');

  } catch (error) {
    showAlert(`Error loading product details: ${error.message}`, 'error');
  }
};

// Add product to cart (API)
async function handleAddToCart(productId) {
  try {
    const res = await fetch(`${API_BASE_URL}/buyer/cart`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({ productId, quantity: 1 })
    });

    const data = await res.json();

    if (!res.ok) {
      // Handle Single-Store Cart Rule Mismatch
      if (data.requiresClearCart) {
        if (confirm('Your cart contains items from a different store. Would you like to clear your cart so you can add this item?')) {
          // Clear cart first
          const clearRes = await fetch(`${API_BASE_URL}/buyer/cart/clear`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${state.token}` }
          });
          if (clearRes.ok) {
            // Re-attempt addition
            handleAddToCart(productId);
          } else {
            showAlert('Failed to clear cart.', 'error');
          }
        }
      } else {
        throw new Error(data.message || 'Failed to add item to cart');
      }
      return;
    }

    showAlert(data.message || 'Product added to cart!', 'success');
    closeModal('product-detail-modal');
    
    // Refresh cart database details
    if (state.activeRole === 'BUYER') {
      loadBuyerCartDetails();
    }

  } catch (error) {
    showAlert(error.message, 'error');
  }
}

// Fetch Public Application Reviews
async function fetchReviews() {
  try {
    const res = await fetch(`${API_BASE_URL}/reviews`);
    if (!res.ok) throw new Error('Failed to fetch reviews');
    const reviews = await res.json();
    
    const grid = document.getElementById('reviews-grid');
    grid.innerHTML = '';

    if (reviews.length === 0) {
      grid.innerHTML = `
        <div style="text-align: center; color: var(--text-secondary); padding: 2rem;">
          No reviews submitted yet. Be the first to leave feedback!
        </div>
      `;
      return;
    }

    reviews.forEach(rev => {
      const card = document.createElement('div');
      card.className = 'review-item';
      
      let starsHtml = '';
      for (let i = 1; i <= 5; i++) {
        starsHtml += i <= rev.rating ? '★' : '☆';
      }

      card.innerHTML = `
        <div class="review-header">
          <span class="reviewer-name">${escapeHTML(rev.reviewerName)}</span>
          <span class="review-date">${new Date(rev.createdAt).toLocaleDateString()}</span>
        </div>
        <div class="review-rating">${starsHtml}</div>
        <p class="review-comment">${escapeHTML(rev.comment)}</p>
      `;
      grid.appendChild(card);
    });

  } catch (error) {
    console.error('Error fetching reviews:', error);
  }
}

// Submit Public Review
async function handleReviewSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('review-name').value;
  const comment = document.getElementById('review-comment').value;

  try {
    const res = await fetch(`${API_BASE_URL}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reviewerName: name,
        rating: state.selectedReviewRating,
        comment
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Error submitting review');

    showAlert(data.message || 'Review submitted successfully!', 'success');
    document.getElementById('form-review').reset();
    document.querySelectorAll('#rating-select .rating-star')[4].click();
    
    fetchReviews();

  } catch (error) {
    showAlert(error.message, 'error');
  }
}

// User Registration
async function handleRegisterSubmit(e) {
  e.preventDefault();
  const username = document.getElementById('register-username').value;
  const email = document.getElementById('register-email').value;
  const password = document.getElementById('register-password').value;

  const roleCheckboxes = document.querySelectorAll('input[name="register-roles"]:checked');
  const roles = Array.from(roleCheckboxes).map(cb => cb.value);

  if (roles.length === 0) {
    showAlert('Please select at least one role for your account.', 'error');
    return;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password, roles })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Registration failed');

    showAlert('Registration successful! Please login with your credentials.', 'success');
    document.getElementById('form-register').reset();
    document.getElementById('tab-login').click();

  } catch (error) {
    showAlert(error.message, 'error');
  }
}

// User Login
async function handleLoginSubmit(e) {
  e.preventDefault();
  const username = document.getElementById('login-username').value;
  const password = document.getElementById('login-password').value;

  try {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Login failed');

    document.getElementById('form-login').reset();

    if (data.requireRoleSelection) {
      state.token = data.token; 
      renderRoleSelectionCards(data.roles);
      navigateTo('role-selection-section');
      showAlert('Multi-role detected. Please select your active session role.', 'success');
    } else {
      saveSession(data.token, data.activeRole, data.user);
      updateNavbarUI();
      renderDashboard();
      navigateTo('dashboard-section');
      showAlert('Login successful!', 'success');
    }

  } catch (error) {
    showAlert(error.message, 'error');
  }
}

// Render active role selector cards
function renderRoleSelectionCards(roles) {
  const container = document.getElementById('role-selection-cards');
  container.innerHTML = '';

  roles.forEach(role => {
    const rInfo = roleInfo[role] || { icon: '👤', desc: 'Access your workspace dashboard.' };
    const card = document.createElement('div');
    card.className = 'role-select-card';
    card.innerHTML = `
      <div class="role-select-icon">${rInfo.icon}</div>
      <h3>${role}</h3>
      <p>${rInfo.desc}</p>
    `;
    card.addEventListener('click', () => handleRoleSelection(role));
    container.appendChild(card);
  });
}

// Select active role from login screen
async function handleRoleSelection(role) {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/select-role`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({ role })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Role selection failed');

    saveSession(data.token, data.activeRole, data.user);
    updateNavbarUI();
    renderDashboard();
    navigateTo('dashboard-section');
    showAlert(`Session activated as: ${role}`, 'success');

  } catch (error) {
    showAlert(error.message, 'error');
  }
}

// Switch active role from dashboard
async function handleRoleSwitch(role) {
  if (role === state.activeRole) return;

  try {
    const res = await fetch(`${API_BASE_URL}/auth/switch-role`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({ role })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Switching role failed');

    saveSession(data.token, data.activeRole, data.user);
    updateNavbarUI();
    renderDashboard();
    showAlert(`Switched active workspace to: ${role}`, 'success');

  } catch (error) {
    showAlert(error.message, 'error');
  }
}

// Verify Session on startup
async function verifySession() {
  if (!state.token || !state.activeRole) {
    updateNavbarUI();
    return;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/auth/me`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${state.token}` }
    });

    const data = await res.json();
    if (!res.ok) throw new Error('Session expired');

    state.activeRole = data.activeRole;
    state.user = { 
      id: data.id, 
      username: data.username, 
      email: data.email, 
      roles: data.roles,
      walletBalance: data.walletBalance,
      address: data.address
    };
    localStorage.setItem('seapedia_active_role', state.activeRole);
    localStorage.setItem('seapedia_user', JSON.stringify(state.user));

    updateNavbarUI();
    renderDashboard();

  } catch (error) {
    console.warn('Session verification failed, logging out:', error);
    clearSession();
    updateNavbarUI();
  }
}

// User Dashboard View Rendering
function renderDashboard() {
  if (!state.user) return;

  document.getElementById('profile-avatar').textContent = state.user.username.charAt(0).toUpperCase();
  document.getElementById('profile-username').textContent = state.user.username;
  document.getElementById('profile-email').textContent = state.user.email;
  document.getElementById('profile-active-role').textContent = state.activeRole;

  // Render role switchers
  const switcherGrid = document.getElementById('dashboard-role-switcher');
  switcherGrid.innerHTML = '';
  
  const allRolesList = document.getElementById('dashboard-all-roles');
  allRolesList.innerHTML = '';

  state.user.roles.forEach(role => {
    const badge = document.createElement('span');
    badge.className = `role-badge ${role === state.activeRole ? 'active' : ''}`;
    badge.textContent = role;
    allRolesList.appendChild(badge);

    if (state.user.roles.length > 1) {
      const btn = document.createElement('button');
      btn.className = `switcher-btn ${role === state.activeRole ? 'active' : ''}`;
      btn.textContent = role;
      btn.addEventListener('click', () => handleRoleSwitch(role));
      switcherGrid.appendChild(btn);
    }
  });

  if (state.user.roles.length === 1) {
    switcherGrid.innerHTML = `
      <div style="color: var(--text-secondary); font-size: 0.85rem; padding: 0.5rem 0;">
        Only one role assigned to this account. Role switching disabled.
      </div>
    `;
  }

  // Handle Workspaces Dynamic display
  const sellerWorkspace = document.getElementById('seller-workspace');
  const buyerWorkspace = document.getElementById('buyer-workspace');
  const driverWorkspace = document.getElementById('driver-workspace');
  const adminWorkspace = document.getElementById('admin-workspace');

  if (state.activeRole === 'SELLER') {
    sellerWorkspace.style.display = 'block';
    buyerWorkspace.style.display = 'none';
    if (driverWorkspace) driverWorkspace.style.display = 'none';
    if (adminWorkspace) adminWorkspace.style.display = 'none';
    loadSellerDashboardDetails();
  } else if (state.activeRole === 'BUYER') {
    sellerWorkspace.style.display = 'none';
    buyerWorkspace.style.display = 'block';
    if (driverWorkspace) driverWorkspace.style.display = 'none';
    if (adminWorkspace) adminWorkspace.style.display = 'none';
    loadBuyerWorkspaceDetails();
  } else if (state.activeRole === 'DRIVER') {
    sellerWorkspace.style.display = 'none';
    buyerWorkspace.style.display = 'none';
    if (driverWorkspace) driverWorkspace.style.display = 'block';
    if (adminWorkspace) adminWorkspace.style.display = 'none';
    loadDriverWorkspaceDetails();
  } else if (state.activeRole === 'ADMIN') {
    sellerWorkspace.style.display = 'none';
    buyerWorkspace.style.display = 'none';
    if (driverWorkspace) driverWorkspace.style.display = 'none';
    if (adminWorkspace) adminWorkspace.style.display = 'block';
    loadAdminWorkspaceDetails();
  } else {
    sellerWorkspace.style.display = 'none';
    buyerWorkspace.style.display = 'none';
    if (driverWorkspace) driverWorkspace.style.display = 'none';
    if (adminWorkspace) adminWorkspace.style.display = 'none';
  }
}

/* ==========================================
   SELLER EXPERIENCE WORKSPACE (LEVEL 2)
   ========================================== */

// Load Seller Dashboard details
async function loadSellerDashboardDetails() {
  const storeProfileContainer = document.getElementById('store-profile-container');
  const storeProductsContainer = document.getElementById('store-products-container');
  const sellerOrdersContainer = document.getElementById('seller-orders-container');
  
  storeProfileContainer.innerHTML = 'Loading Store details...';
  storeProductsContainer.style.display = 'none';
  sellerOrdersContainer.style.display = 'none';

  // Load Income Report
  try {
    const reportRes = await fetch(`${API_BASE_URL}/seller/reports/income`, {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    if (reportRes.ok) {
      const reportData = await reportRes.json();
      document.getElementById('seller-income-display').textContent = formatRupiah(reportData.totalIncome);
    }
  } catch (err) {
    console.error('Error fetching income report:', err);
  }

  try {
    const res = await fetch(`${API_BASE_URL}/seller/dashboard`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${state.token}` }
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to load seller store');

    if (!data.hasStore) {
      storeProfileContainer.innerHTML = `
        <h4 style="margin-bottom: 0.5rem; color: #fff;">Open Your Seller Store</h4>
        <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1.25rem;">
          To start selling products, you must register a unique store name in the SEAPEDIA marketplace.
        </p>
        <form id="form-create-store" style="display:flex; gap:0.75rem;">
          <input type="text" id="create-store-name" class="form-control" placeholder="Enter store name..." required style="max-width:350px;">
          <button type="submit" class="btn btn-primary" style="padding:0.6rem 1.5rem;">Register Store</button>
        </form>
      `;
      document.getElementById('form-create-store').addEventListener('submit', handleCreateStore);
    } else {
      storeProfileContainer.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
          <div>
            <span style="font-size: 0.75rem; color: var(--text-secondary); font-weight: bold; text-transform: uppercase;">Store Profile</span>
            <h3 style="font-size: 1.6rem; color: var(--color-accent);">${escapeHTML(data.store.name)}</h3>
            <p style="font-size: 0.8rem; color: var(--text-secondary);">Registered on: ${new Date(data.store.createdAt).toLocaleDateString()}</p>
          </div>
          <form id="form-update-store" style="display: flex; gap: 0.5rem; align-items: center;">
            <input type="text" id="update-store-name" class="form-control" value="${escapeHTML(data.store.name)}" required style="max-width: 200px; padding: 0.5rem 0.75rem; font-size: 0.9rem;">
            <button type="submit" class="btn btn-secondary" style="padding: 0.5rem 1rem; font-size: 0.85rem;">Update Name</button>
          </form>
        </div>
      `;
      document.getElementById('form-update-store').addEventListener('submit', handleUpdateStore);

      renderSellerProductsTable(data.store.products);
      storeProductsContainer.style.display = 'block';

      // Load Inbound Orders
      loadSellerOrders();
      sellerOrdersContainer.style.display = 'block';
    }

  } catch (error) {
    storeProfileContainer.innerHTML = `<div style="color:var(--color-error);">Error: ${error.message}</div>`;
  }
}

// Create Store
async function handleCreateStore(e) {
  e.preventDefault();
  const name = document.getElementById('create-store-name').value;

  try {
    const res = await fetch(`${API_BASE_URL}/seller/store`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({ name })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Store registration failed');

    showAlert('Store profile created successfully!', 'success');
    loadSellerDashboardDetails();
    renderProducts();

  } catch (error) {
    showAlert(error.message, 'error');
  }
}

// Update Store Name
async function handleUpdateStore(e) {
  e.preventDefault();
  const name = document.getElementById('update-store-name').value;

  try {
    const res = await fetch(`${API_BASE_URL}/seller/store`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({ name })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Store profile update failed');

    showAlert('Store profile updated successfully!', 'success');
    loadSellerDashboardDetails();
    renderProducts();

  } catch (error) {
    showAlert(error.message, 'error');
  }
}

// Render Products Inventory Table
function renderSellerProductsTable(products) {
  const tbody = document.getElementById('seller-products-body');
  tbody.innerHTML = '';

  if (products.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align: center; color: var(--text-secondary); padding: 2rem;">
          No products listed. Click "+ Add Product" to add.
        </td>
      </tr>
    `;
    return;
  }

  products.forEach(prod => {
    const tr = document.createElement('tr');
    
    let stockClass = 'ok';
    if (prod.stock <= 5) stockClass = 'low';
    const stockPill = `<span class="stock-pill ${stockClass}">${prod.stock} unit</span>`;

    tr.innerHTML = `
      <td style="padding: 1rem; font-weight: 500; color: #fff;">${escapeHTML(prod.name)}</td>
      <td style="padding: 1rem;">${formatRupiah(prod.price)}</td>
      <td style="padding: 1rem;">${stockPill}</td>
      <td style="padding: 1rem; text-align: right;">
        <button class="btn btn-secondary btn-warning btn-sm" onclick="openEditProductModal(${prod.id}, '${escapeJS(prod.name)}', '${escapeJS(prod.description)}', ${prod.price}, ${prod.stock})">Edit</button>
        <button class="btn btn-secondary btn-danger btn-sm" onclick="handleDeleteProduct(${prod.id})">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Open Edit Product Modal
window.openEditProductModal = function(id, name, description, price, stock) {
  document.getElementById('product-id-input').value = id;
  document.getElementById('product-name-input').value = name;
  document.getElementById('product-desc-input').value = description;
  document.getElementById('product-price-input').value = price;
  document.getElementById('product-stock-input').value = stock;
  
  document.getElementById('product-modal-title').textContent = 'Edit Product Details';
  openModal('product-form-modal');
};

// Create / Update Product Form submission
async function handleProductFormSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('product-id-input').value;
  const name = document.getElementById('product-name-input').value;
  const description = document.getElementById('product-desc-input').value;
  const price = parseInt(document.getElementById('product-price-input').value, 10);
  const stock = parseInt(document.getElementById('product-stock-input').value, 10);

  const isEditing = id !== '';
  const url = isEditing 
    ? `${API_BASE_URL}/seller/products/${id}` 
    : `${API_BASE_URL}/seller/products`;
  
  const method = isEditing ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({ name, description, price, stock })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Product save failed');

    showAlert(data.message || 'Product saved successfully!', 'success');
    closeModal('product-form-modal');
    
    loadSellerDashboardDetails();
    renderProducts();

  } catch (error) {
    showAlert(error.message, 'error');
  }
}

// Delete Product
window.handleDeleteProduct = async function(id) {
  if (!confirm('Are you sure you want to delete this product? This action cannot be undone.')) {
    return;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/seller/products/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${state.token}` }
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to delete product');

    showAlert(data.message || 'Product deleted successfully!', 'success');
    loadSellerDashboardDetails();
    renderProducts();

  } catch (error) {
    showAlert(error.message, 'error');
  }
};

// Load Seller Inbound Customer Orders
async function loadSellerOrders() {
  const container = document.getElementById('seller-orders-list');
  container.innerHTML = 'Loading inbound orders...';

  try {
    const res = await fetch(`${API_BASE_URL}/seller/orders`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${state.token}` }
    });

    const orders = await res.json();
    if (!res.ok) throw new Error('Failed to load orders');

    container.innerHTML = '';

    if (orders.length === 0) {
      container.innerHTML = `
        <div style="color: var(--text-secondary); text-align: center; padding: 1.5rem; border: 1px dashed var(--border-glass); border-radius: 8px;">
          No inbound orders received yet.
        </div>
      `;
      return;
    }

    orders.forEach(order => {
      const card = document.createElement('div');
      card.className = 'order-card';
      
      let itemsHtml = '';
      order.items.forEach(item => {
        itemsHtml += `
          <div class="order-card-item">
            <span>${escapeHTML(item.product.name)} x ${item.quantity}</span>
            <span>${formatRupiah(item.price * item.quantity)}</span>
          </div>
        `;
      });

      const timelineHtml = generateTimelineHtml(order.status);
      
      let actionButtonHtml = '';
      if (order.status === 'Sedang Dikemas') {
        actionButtonHtml = `
          <div style="display: flex; justify-content: flex-end; margin-top: 1rem; border-top: 1px solid var(--border-glass); padding-top: 1rem;">
            <button class="btn btn-primary btn-sm" onclick="processSellerOrder(${order.id})">Proses Pesanan</button>
          </div>
        `;
      }

      card.innerHTML = `
        <div class="order-card-header">
          <div>
            <span class="order-card-id">Order #${order.id}</span>
            <div style="font-size:0.75rem; color:var(--text-secondary);">Buyer: ${escapeHTML(order.buyer.username)} (${escapeHTML(order.buyer.email)})</div>
            <div style="font-size:0.75rem; color:var(--text-secondary);">Deliver to: ${escapeHTML(order.buyer.address)}</div>
          </div>
          <span class="order-card-status">${order.status}</span>
        </div>
        <div class="order-card-items">${itemsHtml}</div>
        <div class="order-card-total">
          <span>Final Paid Total:</span>
          <span>${formatRupiah(order.total)}</span>
        </div>
        <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.5rem;">
          Delivery Method: <strong>${order.deliveryMethod}</strong> (Fee: ${formatRupiah(order.deliveryFee)}, PPN 12%: ${formatRupiah(order.tax)})
        </div>
        ${timelineHtml}
        ${actionButtonHtml}
      `;
      container.appendChild(card);
    });

  } catch (error) {
    container.innerHTML = `<div style="color: var(--color-error);">Error: ${error.message}</div>`;
  }
}

/* ==========================================
   BUYER EXPERIENCE WORKSPACE (LEVEL 3)
   ========================================== */

// Load Buyer details (wallet, address, cart, history)
async function loadBuyerWorkspaceDetails() {
  if (!state.user) return;

  // Refresh wallet & address displays
  document.getElementById('wallet-balance-display').textContent = formatRupiah(state.user.walletBalance);
  document.getElementById('address-display').textContent = state.user.address || 'No shipping address set yet. Fill out the form below.';
  document.getElementById('shipping-address-input').value = state.user.address || '';

  // Load Spending Report
  try {
    const reportRes = await fetch(`${API_BASE_URL}/buyer/reports/spending`, {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    if (reportRes.ok) {
      const reportData = await reportRes.json();
      document.getElementById('buyer-spending-display').textContent = formatRupiah(reportData.totalSpending);
    }
  } catch (err) {
    console.error('Error fetching spending report:', err);
  }

  // Load Cart
  loadBuyerCartDetails();

  // Load Orders list
  loadBuyerOrders();
}

// Wallet topup submit handler
async function handleTopupSubmit(e) {
  e.preventDefault();
  const amount = parseInt(document.getElementById('topup-amount').value, 10);

  try {
    const res = await fetch(`${API_BASE_URL}/buyer/topup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({ amount })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Top-up failed');

    showAlert(data.message || 'Top-up successful!', 'success');
    document.getElementById('form-topup').reset();
    
    // Refresh user state
    state.user.walletBalance = data.walletBalance;
    localStorage.setItem('seapedia_user', JSON.stringify(state.user));

    // Update displays
    document.getElementById('wallet-balance-display').textContent = formatRupiah(state.user.walletBalance);
    updateNavbarUI();

  } catch (error) {
    showAlert(error.message, 'error');
  }
}

// Shipping address submit handler
async function handleAddressSubmit(e) {
  e.preventDefault();
  const address = document.getElementById('shipping-address-input').value;

  try {
    const res = await fetch(`${API_BASE_URL}/buyer/address`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({ address })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Updating address failed');

    showAlert('Shipping address updated!', 'success');
    
    // Refresh user state
    state.user.address = data.address;
    localStorage.setItem('seapedia_user', JSON.stringify(state.user));

    // Update display
    document.getElementById('address-display').textContent = state.user.address;

  } catch (error) {
    showAlert(error.message, 'error');
  }
}

// Fetch Cart Details
async function loadBuyerCartDetails() {
  const tbody = document.getElementById('buyer-cart-body');
  tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-secondary);">Loading cart details...</td></tr>';
  document.getElementById('cart-subtotal-display').textContent = 'Rp 0';

  try {
    const res = await fetch(`${API_BASE_URL}/buyer/cart`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${state.token}` }
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Could not fetch cart');

    state.cart = data; // Save to state

    tbody.innerHTML = '';

    if (data.items.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; color: var(--text-secondary); padding: 2rem;">
            Your shopping cart is empty. Explore our products and add them here!
          </td>
        </tr>
      `;
      return;
    }

    data.items.forEach(item => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="padding:0.75rem; color:#fff; font-weight:500;">${escapeHTML(item.product.name)}</td>
        <td style="padding:0.75rem; color:var(--text-secondary);">${escapeHTML(item.product.store.name)}</td>
        <td style="padding:0.75rem;">${formatRupiah(item.product.price)}</td>
        <td style="padding:0.75rem;">
          <div class="quantity-control" style="display: flex; align-items: center; gap: 0.5rem; width: max-content;">
            <button type="button" class="btn btn-secondary btn-sm" style="padding: 0; width: 24px; height: 24px; min-width: 24px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 0.9rem;" onclick="window.handleQtyDecrement(${item.id}, this)">-</button>
            <span class="qty-display" id="cart-qty-${item.id}" data-price="${item.product.price}" data-stock="${item.product.stock}" style="font-weight: 600; color: #fff; min-width: 20px; text-align: center; font-size: 0.95rem;">${item.quantity}</span>
            <button type="button" class="btn btn-secondary btn-sm" style="padding: 0; width: 24px; height: 24px; min-width: 24px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 0.9rem;" onclick="window.handleQtyIncrement(${item.id}, this)">+</button>
          </div>
        </td>
        <td style="padding:0.75rem; text-align: right; font-weight: 500; color:#fff;">${formatRupiah(item.product.price * item.quantity)}</td>
        <td style="padding:0.75rem; text-align: right;">
          <button class="btn btn-secondary btn-danger btn-sm" style="padding: 0.2rem 0.5rem !important;" onclick="removeCartItem(${item.id})">×</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    document.getElementById('cart-subtotal-display').textContent = formatRupiah(data.subtotal);

  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--color-error);">Error: ${error.message}</td></tr>`;
  }
}

// Update Cart Item quantity from Input field
window.updateCartQuantity = async function(cartItemId, quantity) {
  const qty = parseInt(quantity, 10);
  if (isNaN(qty) || qty <= 0) return;

  try {
    const res = await fetch(`${API_BASE_URL}/buyer/cart/${cartItemId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({ quantity: qty })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to update quantity');

    loadBuyerCartDetails(); // Refresh total prices

  } catch (error) {
    showAlert(error.message, 'error');
    loadBuyerCartDetails(); // Re-render to revert input to correct state
  }
};

// Remove Cart Item
window.removeCartItem = async function(cartItemId) {
  try {
    const res = await fetch(`${API_BASE_URL}/buyer/cart/${cartItemId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${state.token}` }
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to remove item');

    showAlert('Item removed from cart.', 'success');
    loadBuyerCartDetails();

  } catch (error) {
    showAlert(error.message, 'error');
  }
};

// Quantity Adjustment Handlers (Optimistic Updates)
window.handleQtyIncrement = function(cartItemId, btnElement) {
  const qtySpan = document.getElementById(`cart-qty-${cartItemId}`);
  if (!qtySpan) return;
  const currentQty = parseInt(qtySpan.textContent, 10);
  const maxStock = parseInt(qtySpan.getAttribute('data-stock'), 10);
  
  if (currentQty >= maxStock) {
    showAlert(`Cannot exceed available store stock (${maxStock} units).`, 'error');
    return;
  }
  
  const newQty = currentQty + 1;
  
  // Instantly update DOM text
  qtySpan.textContent = newQty;
  
  // Instantly update item subtotal in row
  const row = btnElement.closest('tr');
  if (row) {
    const price = parseInt(qtySpan.getAttribute('data-price'), 10);
    const totalCell = row.cells[4];
    if (totalCell) {
      totalCell.textContent = formatRupiah(price * newQty);
    }
  }

  // Local Client-Side Calculation
  if (state.cart && state.cart.items) {
    const itemInState = state.cart.items.find(i => i.id === cartItemId);
    if (itemInState) {
      itemInState.quantity = newQty;
    }
    
    let localSubtotal = 0;
    state.cart.items.forEach(item => {
      localSubtotal += item.product.price * item.quantity;
    });
    state.cart.subtotal = localSubtotal;
    
    const cartSubtotalDisplay = document.getElementById('cart-subtotal-display');
    if (cartSubtotalDisplay) {
      cartSubtotalDisplay.textContent = formatRupiah(localSubtotal);
    }
  }
  
  window.updateCartQuantitySilent(cartItemId, newQty);
};

window.handleQtyDecrement = function(cartItemId, btnElement) {
  const qtySpan = document.getElementById(`cart-qty-${cartItemId}`);
  if (!qtySpan) return;
  const currentQty = parseInt(qtySpan.textContent, 10);
  
  if (currentQty <= 1) {
    if (confirm('Do you want to remove this item from your shopping cart?')) {
      window.removeCartItem(cartItemId);
    }
    return;
  }
  
  const newQty = currentQty - 1;
  
  // Instantly update DOM text
  qtySpan.textContent = newQty;
  
  // Instantly update item subtotal in row
  const row = btnElement.closest('tr');
  if (row) {
    const price = parseInt(qtySpan.getAttribute('data-price'), 10);
    const totalCell = row.cells[4];
    if (totalCell) {
      totalCell.textContent = formatRupiah(price * newQty);
    }
  }

  // Local Client-Side Calculation
  if (state.cart && state.cart.items) {
    const itemInState = state.cart.items.find(i => i.id === cartItemId);
    if (itemInState) {
      itemInState.quantity = newQty;
    }
    
    let localSubtotal = 0;
    state.cart.items.forEach(item => {
      localSubtotal += item.product.price * item.quantity;
    });
    state.cart.subtotal = localSubtotal;
    
    const cartSubtotalDisplay = document.getElementById('cart-subtotal-display');
    if (cartSubtotalDisplay) {
      cartSubtotalDisplay.textContent = formatRupiah(localSubtotal);
    }
  }
  
  window.updateCartQuantitySilent(cartItemId, newQty);
};

// Silent Sync Quantity to API
window.updateCartQuantitySilent = async function(cartItemId, quantity) {
  const qty = parseInt(quantity, 10);
  try {
    const res = await fetch(`${API_BASE_URL}/buyer/cart/${cartItemId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({ quantity: qty })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to update quantity');

    state.cart = data;
    document.getElementById('cart-subtotal-display').textContent = formatRupiah(data.subtotal);

  } catch (error) {
    showAlert(error.message, 'error');
    loadBuyerCartDetails();
  }
};

// Clear Cart
async function handleClearCart() {
  if (state.cart.items.length === 0) return;
  if (!confirm('Are you sure you want to empty your shopping cart?')) return;

  try {
    const res = await fetch(`${API_BASE_URL}/buyer/cart/clear`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${state.token}` }
    });

    if (!res.ok) throw new Error('Failed to empty cart');

    showAlert('Shopping cart cleared.', 'success');
    loadBuyerCartDetails();

  } catch (error) {
    showAlert(error.message, 'error');
  }
}

// Checkout Trigger Modal view
function handleCheckoutTrigger() {
  if (!state.cart || state.cart.items.length === 0) {
    showAlert('Your shopping cart is empty.', 'error');
    return;
  }

  if (!state.user.address) {
    showAlert('Shipping address is required before checking out. Please save your address first.', 'error');
    return;
  }

  // Reset coupon state
  state.appliedDiscount = null;
  document.getElementById('checkout-discount-code').value = '';
  const statusDiv = document.getElementById('discount-validation-status');
  statusDiv.style.display = 'none';
  statusDiv.textContent = '';

  // Populate Summary values starting with Delivery: Regular
  document.getElementById('checkout-delivery-method').value = 'Regular';
  updateCheckoutSummaryBreakdown();

  // Show Modal
  openModal('checkout-modal');
}

// Apply Discount code via API
async function handleApplyDiscount() {
  const code = document.getElementById('checkout-discount-code').value.trim();
  const statusDiv = document.getElementById('discount-validation-status');

  if (!code) {
    statusDiv.style.display = 'block';
    statusDiv.style.color = 'var(--color-error)';
    statusDiv.textContent = 'Please enter a discount code.';
    state.appliedDiscount = null;
    updateCheckoutSummaryBreakdown();
    return;
  }

  statusDiv.style.display = 'block';
  statusDiv.style.color = '#fff';
  statusDiv.textContent = 'Validating code...';

  try {
    const res = await fetch(`${API_BASE_URL}/buyer/discount/validate?code=${encodeURIComponent(code)}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${state.token}` }
    });

    const data = await res.json();

    if (!res.ok) {
      statusDiv.style.color = 'var(--color-error)';
      statusDiv.textContent = data.message || 'Invalid discount code.';
      state.appliedDiscount = null;
    } else {
      statusDiv.style.color = '#10b981';
      statusDiv.textContent = `Applied! Discount value: ${formatRupiah(data.discountValue)}`;
      state.appliedDiscount = {
        code: data.code,
        value: data.discountValue
      };
    }
    updateCheckoutSummaryBreakdown();

  } catch (error) {
    statusDiv.style.color = 'var(--color-error)';
    statusDiv.textContent = 'Error validating coupon.';
    state.appliedDiscount = null;
    updateCheckoutSummaryBreakdown();
  }
}

// Recalculates and updates pricing breakdown in Checkout popup
function updateCheckoutSummaryBreakdown() {
  const method = document.getElementById('checkout-delivery-method').value;
  const subtotal = state.cart.subtotal;

  let fee = 10000;
  if (method === 'Instant') fee = 50000;
  else if (method === 'Next Day') fee = 25000;

  let discountApplied = 0;
  const discountRow = document.getElementById('checkout-discount-row');
  
  if (state.appliedDiscount) {
    discountApplied = Math.min(state.appliedDiscount.value, subtotal);
    discountRow.style.display = 'flex';
    document.getElementById('checkout-discount-label').textContent = state.appliedDiscount.code;
    document.getElementById('checkout-discount-fee').textContent = `-${formatRupiah(discountApplied)}`;
  } else {
    discountRow.style.display = 'none';
  }

  const taxableSubtotal = Math.max(0, subtotal - discountApplied);
  const tax = Math.round(taxableSubtotal * 0.12);
  const total = taxableSubtotal + fee + tax;

  document.getElementById('checkout-subtotal').textContent = formatRupiah(subtotal);
  document.getElementById('checkout-delivery-fee').textContent = formatRupiah(fee);
  document.getElementById('checkout-tax').textContent = formatRupiah(tax);
  document.getElementById('checkout-total').textContent = formatRupiah(total);
  
  const balanceStatus = document.getElementById('checkout-wallet-status');
  balanceStatus.innerHTML = `Your wallet balance: <strong>${formatRupiah(state.user.walletBalance)}</strong>`;
  
  if (state.user.walletBalance < total) {
    balanceStatus.innerHTML += ` <span style="color:var(--color-error); font-weight:bold;">(Insufficient Funds - Please top up)</span>`;
    document.getElementById('btn-confirm-checkout').disabled = true;
  } else {
    document.getElementById('btn-confirm-checkout').disabled = false;
  }
}

// Confirm and Pay Order (Checkout API call)
async function handleConfirmCheckout() {
  const deliveryMethod = document.getElementById('checkout-delivery-method').value;
  const discountCode = state.appliedDiscount ? state.appliedDiscount.code : null;

  try {
    const res = await fetch(`${API_BASE_URL}/buyer/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({ deliveryMethod, discountCode })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Checkout failed');

    showAlert(data.message || 'Checkout successful! Order placed.', 'success');
    closeModal('checkout-modal');

    // Refresh Session state to fetch new balance
    verifySession();

  } catch (error) {
    showAlert(error.message, 'error');
  }
}

// Fetch Buyer Orders History
async function loadBuyerOrders() {
  const container = document.getElementById('buyer-orders-list');
  container.innerHTML = 'Loading order logs...';

  try {
    const res = await fetch(`${API_BASE_URL}/buyer/orders`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${state.token}` }
    });

    const orders = await res.json();
    if (!res.ok) throw new Error('Could not fetch orders history');

    container.innerHTML = '';

    if (orders.length === 0) {
      container.innerHTML = `
        <div style="color: var(--text-secondary); text-align: center; padding: 1.5rem; border: 1px dashed var(--border-glass); border-radius: 8px;">
          No orders placed yet. Add items to your cart and checkout!
        </div>
      `;
      return;
    }

    orders.forEach(order => {
      const card = document.createElement('div');
      card.className = 'order-card';
      
      let itemsHtml = '';
      order.items.forEach(item => {
        itemsHtml += `
          <div class="order-card-item">
            <span>${escapeHTML(item.product.name)} x ${item.quantity}</span>
            <span>${formatRupiah(item.price * item.quantity)}</span>
          </div>
        `;
      });

      const timelineHtml = generateTimelineHtml(order.status);

      card.innerHTML = `
        <div class="order-card-header">
          <div>
            <span class="order-card-id">Order #${order.id}</span>
            <span style="font-size: 0.8rem; color: var(--text-secondary); margin-left: 0.5rem;">Store: ${escapeHTML(order.store.name)}</span>
          </div>
          <span class="order-card-status">${order.status}</span>
        </div>
        <div class="order-card-items">${itemsHtml}</div>
        <div class="order-card-total">
          <span>Paid Grand Total:</span>
          <span>${formatRupiah(order.total)}</span>
        </div>
        <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.5rem;">
          Delivery Method: <strong>${order.deliveryMethod}</strong> (Fee: ${formatRupiah(order.deliveryFee)}, PPN 12%: ${formatRupiah(order.tax)})
        </div>
        ${timelineHtml}
      `;
      container.appendChild(card);
    });

  } catch (error) {
    container.innerHTML = `<div style="color: var(--color-error);">Error: ${error.message}</div>`;
  }
}

// Generate Timeline Steps HTML based on status
function generateTimelineHtml(currentStatus) {
  if (currentStatus === 'Dikembalikan') {
    return `
      <div class="order-timeline" style="margin-top: 1rem;">
        <div class="timeline-step completed" style="flex: 1; text-align: center;">
          <div class="timeline-dot" style="background-color: var(--color-error); box-shadow: 0 0 8px var(--color-error);"></div>
          <div class="timeline-label" style="color: var(--color-error); font-weight: bold;">Pesanan Dibatalkan / Dikembalikan (SLA Overdue)</div>
        </div>
      </div>
    `;
  }

  const steps = ['Sedang Dikemas', 'Menunggu Pengirim', 'Sedang Dikirim', 'Pesanan Selesai'];
  const currentIndex = steps.indexOf(currentStatus);

  let stepsHtml = '';
  steps.forEach((step, idx) => {
    let statusClass = '';
    if (idx < currentIndex) statusClass = 'completed';
    else if (idx === currentIndex) statusClass = 'active';

    stepsHtml += `
      <div class="timeline-step ${statusClass}">
        <div class="timeline-dot"></div>
        <div class="timeline-label">${step}</div>
      </div>
    `;
  });

  return `<div class="order-timeline">${stepsHtml}</div>`;
}

// Save Session Credentials
function saveSession(token, activeRole, user) {
  state.token = token;
  state.activeRole = activeRole;
  state.user = user;
  localStorage.setItem('seapedia_token', token);
  localStorage.setItem('seapedia_active_role', activeRole);
  localStorage.setItem('seapedia_user', JSON.stringify(user));
}

// Clear Session Credentials
function clearSession() {
  state.token = null;
  state.activeRole = null;
  state.user = null;
  localStorage.removeItem('seapedia_token');
  localStorage.removeItem('seapedia_active_role');
  localStorage.removeItem('seapedia_user');
}

// Update navbar elements based on auth status
function updateNavbarUI() {
  if (state.token && state.activeRole && state.user) {
    navGuestItem.style.display = 'none';
    navUserItem.style.display = 'block';
    if (navDashboardItem) navDashboardItem.style.display = 'block';
    navUsername.textContent = state.user.username;
    navActiveRole.textContent = state.activeRole;
    
    // Display wallet balance next to active role if buyer
    if (state.activeRole === 'BUYER') {
      navActiveRole.textContent = `${state.activeRole} (${formatRupiah(state.user.walletBalance)})`;
    }
  } else {
    navGuestItem.style.display = 'block';
    navUserItem.style.display = 'none';
    if (navDashboardItem) navDashboardItem.style.display = 'none';
  }
}

// Handle Logout
function handleLogout() {
  clearSession();
  updateNavbarUI();
  showAlert('Logged out successfully.', 'success');
  navigateTo('landing-section');
}

// Escapes HTML content
function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

// Escapes JS string attributes for inside onclick parameters
function escapeJS(str) {
  return str.replace(/'/g, "\\'").replace(/"/g, '\\"');
}

// Process Order by Seller
window.processSellerOrder = async function(orderId) {
  if (!confirm('Are you sure you want to process this order?')) return;

  try {
    const res = await fetch(`${API_BASE_URL}/seller/orders/${orderId}/process`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${state.token}` }
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to process order.');

    showAlert('Order processed and marked as Menunggu Pengirim.', 'success');
    loadSellerDashboardDetails();

  } catch (error) {
    showAlert(error.message, 'error');
  }
};

// Load Driver Dashboard, Active Jobs, and Available Jobs
async function loadDriverWorkspaceDetails() {
  if (!state.user) return;

  const activeJobContainer = document.getElementById('driver-active-job-container');
  const activeJobContent = document.getElementById('driver-active-job-content');
  const jobsBody = document.getElementById('driver-jobs-body');
  const historyBody = document.getElementById('driver-history-body');

  activeJobContent.innerHTML = 'Loading active task...';
  jobsBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-secondary);">Loading available jobs...</td></tr>';
  historyBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-secondary);">Loading history...</td></tr>';

  try {
    // 1. Load Driver Dashboard (active job, history, earnings)
    const dashRes = await fetch(`${API_BASE_URL}/driver/dashboard`, {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    
    if (dashRes.ok) {
      const dashData = await dashRes.json();
      
      // Update Earnings Display
      document.getElementById('driver-earnings-display').textContent = formatRupiah(dashData.earnings);

      // Render Active Job
      if (!dashData.activeJob) {
        activeJobContent.innerHTML = `<div style="color: var(--text-secondary); font-size: 0.9rem;">No active delivery task at the moment. Accept a shipment from the job board below!</div>`;
      } else {
        const job = dashData.activeJob;
        let itemsHtml = '';
        job.items.forEach(item => {
          itemsHtml += `<div>• ${escapeHTML(item.product.name)} x ${item.quantity}</div>`;
        });

        activeJobContent.innerHTML = `
          <div class="order-card" style="margin-top: 0.5rem; background: rgba(255,255,255,0.01); border: 1px solid var(--border-glass);">
            <div class="order-card-header">
              <div>
                <span class="order-card-id">Order #${job.id}</span>
                <span style="font-size:0.85rem; color:var(--text-secondary); margin-left:0.5rem;">Store: <strong>${escapeHTML(job.store.name)}</strong></span>
              </div>
              <span class="order-card-status">${job.status}</span>
            </div>
            <div class="order-card-items" style="padding:0.75rem 0;">${itemsHtml}</div>
            <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1rem;">
              <strong>Delivery Method:</strong> ${job.deliveryMethod} (Fee: ${formatRupiah(job.deliveryFee)})<br>
              <strong>Destination:</strong> ${escapeHTML(job.buyer.username)} (${escapeHTML(job.buyer.address)})<br>
              <strong>Contact Email:</strong> ${escapeHTML(job.buyer.email)}
            </div>
            <div style="display: flex; justify-content: flex-end; border-top: 1px solid var(--border-glass); padding-top: 1rem;">
              <button class="btn btn-primary btn-sm" onclick="completeDriverJob(${job.id})">Konfirmasi Selesai</button>
            </div>
          </div>
        `;
      }

      // Render Completed History
      historyBody.innerHTML = '';
      if (dashData.history.length === 0) {
        historyBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-secondary); padding: 1.5rem;">No completed delivery tasks yet.</td></tr>`;
      } else {
        dashData.history.forEach(hist => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td style="padding: 0.75rem; font-weight: 500; color: #fff;">Order #${hist.id}</td>
            <td style="padding: 0.75rem;">${escapeHTML(hist.store.name)}</td>
            <td style="padding: 0.75rem;">${escapeHTML(hist.buyer.address)}</td>
            <td style="padding: 0.75rem;">${hist.deliveryMethod}</td>
            <td style="padding: 0.75rem; color: #10b981; font-weight: 500;">${formatRupiah(hist.deliveryFee)}</td>
            <td style="padding: 0.75rem;"><span class="stock-pill ok">${hist.status}</span></td>
          `;
          historyBody.appendChild(tr);
        });
      }
    }

    // 2. Load Available Jobs
    const jobsRes = await fetch(`${API_BASE_URL}/driver/jobs`, {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });

    if (jobsRes.ok) {
      const jobs = await jobsRes.json();
      jobsBody.innerHTML = '';

      if (jobs.length === 0) {
        jobsBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-secondary); padding: 1.5rem;">No shipments waiting for pickup. Check back later!</td></tr>`;
      } else {
        jobs.forEach(job => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td style="padding: 0.75rem; font-weight: 500; color: #fff;">Order #${job.id}</td>
            <td style="padding: 0.75rem;">${escapeHTML(job.store.name)}</td>
            <td style="padding: 0.75rem;">${escapeHTML(job.buyer.address)}</td>
            <td style="padding: 0.75rem; font-weight: 500;">${job.deliveryMethod}</td>
            <td style="padding: 0.75rem; color: var(--color-accent); font-weight: 500;">${formatRupiah(job.deliveryFee)}</td>
            <td style="padding: 0.75rem; text-align: right;">
              <button class="btn btn-primary btn-sm" onclick="takeDriverJob(${job.id})">Ambil Tugas</button>
            </td>
          `;
          jobsBody.appendChild(tr);
        });
      }
    }

  } catch (err) {
    console.error('Error fetching driver details:', err);
    showAlert('Failed to load driver dashboard.', 'error');
  }
}

// Take a shipment job
window.takeDriverJob = async function(orderId) {
  try {
    const res = await fetch(`${API_BASE_URL}/driver/jobs/${orderId}/take`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${state.token}` }
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to accept task.');

    showAlert('Job accepted successfully! Drive safely.', 'success');
    loadDriverWorkspaceDetails();

  } catch (error) {
    showAlert(error.message, 'error');
  }
};

// Complete a delivery job
window.completeDriverJob = async function(orderId) {
  if (!confirm('Confirm delivery complete? Make sure the package has been delivered.')) return;

  try {
    const res = await fetch(`${API_BASE_URL}/driver/jobs/${orderId}/complete`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${state.token}` }
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to complete delivery.');

    showAlert('Delivery completed successfully! Earning added.', 'success');
    loadDriverWorkspaceDetails();

  } catch (error) {
    showAlert(error.message, 'error');
  }
};

/* ==========================================
   ADMIN WORKSPACE (LEVEL 6)
   ========================================== */

async function loadAdminWorkspaceDetails() {
  if (!state.user || state.activeRole !== 'ADMIN') return;

  try {
    const res = await fetch(`${API_BASE_URL}/admin/dashboard`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${state.token}`
      }
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to load admin stats');

    document.getElementById('admin-total-users').textContent = data.totalUsers;
    document.getElementById('admin-total-stores').textContent = data.totalStores;
    document.getElementById('admin-total-products').textContent = data.totalProducts;
    document.getElementById('admin-total-orders').textContent = data.totalOrders;
    document.getElementById('admin-active-discounts').textContent = data.activeDiscounts;
    
    const overdueOrdersEl = document.getElementById('admin-overdue-orders');
    const overdueCardEl = document.getElementById('admin-overdue-card');
    overdueOrdersEl.textContent = data.overdueOrdersCount;

    if (data.overdueOrdersCount > 0) {
      overdueCardEl.style.border = '1px solid var(--color-error)';
      overdueCardEl.style.background = 'rgba(244,63,94,0.05)';
      overdueOrdersEl.style.color = 'var(--color-error)';
    } else {
      overdueCardEl.style.border = '1px solid var(--border-glass)';
      overdueCardEl.style.background = 'rgba(255,255,255,0.02)';
      overdueOrdersEl.style.color = '#fff';
    }

    const offsetDays = data.timeOffsetDays || 0;
    document.getElementById('admin-simulation-offset-display').textContent = `Virtual Offset: +${offsetDays} Days`;

  } catch (error) {
    console.error('Error loading admin details:', error);
    showAlert(error.message, 'error');
  }
}

async function handleAdminDiscountSubmit(e) {
  e.preventDefault();
  const type = document.getElementById('discount-type').value;
  const code = document.getElementById('discount-code').value;
  const discountValue = parseInt(document.getElementById('discount-value').value, 10);
  const expiryDate = new Date(document.getElementById('discount-expiry').value).toISOString();
  const remainingUsage = parseInt(document.getElementById('discount-usage').value, 10);

  try {
    const payload = {
      type,
      code,
      discountValue,
      expiryDate
    };
    if (type === 'voucher') {
      payload.remainingUsage = remainingUsage;
    }

    const res = await fetch(`${API_BASE_URL}/admin/discounts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to generate discount code.');

    showAlert(data.message || 'Discount generated successfully!', 'success');
    document.getElementById('form-generate-discount').reset();
    if (document.getElementById('discount-usage-container')) {
      document.getElementById('discount-usage-container').style.display = 'block';
    }
    loadAdminWorkspaceDetails();

  } catch (error) {
    showAlert(error.message, 'error');
  }
}

async function triggerTimeSimulation() {
  const btn = document.getElementById('btn-simulate-next-day');
  btn.disabled = true;
  btn.textContent = 'Simulating...';

  try {
    const res = await fetch(`${API_BASE_URL}/admin/simulate-next-day`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${state.token}`
      }
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Simulation failed.');

    showAlert(`Simulation complete! Moved 1 day forward. Overdue orders processed: ${data.overdueOrdersProcessed.length}`, 'success');
    
    // Refresh admin details
    loadAdminWorkspaceDetails();

  } catch (error) {
    showAlert(error.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Simulate Next Day';
  }
}
