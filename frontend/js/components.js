// Dynamic Navigation Renderer based on session state
function renderHeader() {
  const user = api.getUser();
  const token = api.getToken();
  const currentPath = window.location.pathname;

  const headerContainer = document.getElementById('main-header');
  if (!headerContainer) return;

  const navLinks = [
    { label: 'Home', href: '/index.html', i18n: 'nav_home' },
    { label: 'About', href: '/about.html', i18n: 'nav_about' },
    { label: 'How It Works', href: '/how-it-works.html', i18n: 'nav_how_it_works' },
    { label: 'Public Issues', href: '/public-issues.html', i18n: 'nav_public_issues' },
    { label: 'Map', href: '/public-map.html', i18n: 'nav_public_map' },
    { label: 'Contact', href: '/contact.html', i18n: 'nav_contact' }
  ];

  let authButtonsHtml = '';
  if (token && user) {
    const isAdm = user.role === 'Admin';
    const dashboardUrl = isAdm ? '/admin-dashboard.html' : '/citizen-dashboard.html';
    const dashboardLabel = isAdm ? 'Command Center' : 'Dashboard';
    const dashboardIcon = isAdm ? 'fa-shield-alt' : 'fa-columns';
    authButtonsHtml = `
      <a href="${dashboardUrl}" class="btn ${isAdm ? 'btn-primary' : 'btn-secondary'} btn-sm" style="${isAdm ? 'background:#0f172a;border-color:#38bdf8;color:#38bdf8;' : ''}">
        <i class="fas ${dashboardIcon}"></i> <span>${dashboardLabel}</span>
      </a>
      <button onclick="api.logout()" class="btn btn-outline btn-sm" style="color: #cbd5e1; border-color: rgba(255,255,255,0.2);">
        <i class="fas fa-sign-out-alt"></i> <span data-i18n="nav_logout">Logout</span>
      </button>
    `;
  } else {
    authButtonsHtml = `
      <a href="/login.html" class="cp-nav-link" data-i18n="nav_login">Login</a>
      <a href="/register.html" class="btn btn-primary btn-sm" data-i18n="nav_register">Get Started</a>
    `;
  }

  headerContainer.innerHTML = `
    <nav class="cp-navbar">
      <a href="/index.html" class="cp-brand">
        <div class="cp-brand-logo">
          <i class="fas fa-city"></i>
        </div>
        <div>Civic<span>Pulse</span></div>
      </a>

      <button class="mobile-nav-toggle" onclick="document.querySelector('.cp-nav-links').classList.toggle('open')">
        <i class="fas fa-bars"></i>
      </button>

      <ul class="cp-nav-links">
        ${navLinks.map(link => {
          const isActive = currentPath.endsWith(link.href) || (link.href === '/index.html' && (currentPath === '/' || currentPath.endsWith('/')));
          return `
            <li>
              <a href="${link.href}" class="cp-nav-link ${isActive ? 'active' : ''}" data-i18n="${link.i18n}">
                ${link.label}
              </a>
            </li>
          `;
        }).join('')}
      </ul>

      <div class="cp-nav-actions">
        <select class="lang-selector" aria-label="Select Language">
          <option value="en">English (EN)</option>
          <option value="te">తెలుగు (TE)</option>
        </select>
        ${authButtonsHtml}
      </div>
    </nav>
  `;

  // Re-bind i18n
  if (window.i18n) {
    window.i18n.init();
  }
}

function renderFooter() {
  const footerContainer = document.getElementById('main-footer');
  if (!footerContainer) return;

  footerContainer.innerHTML = `
    <footer class="cp-footer">
      <div class="footer-grid">
        <div class="footer-brand">
          <h4><i class="fas fa-city" style="color: var(--teal-light); margin-right: 8px;"></i> CivicPulse</h4>
          <p style="margin-bottom: 1rem; max-width: 380px; font-size: 0.95rem;">
            AI-Powered Smart Civic Issue Detection & Accountability Platform. Connecting citizens, municipal engineering departments, and city governance.
          </p>
          <div style="display: flex; gap: 0.75rem;">
            <span class="status-badge Resolved" style="text-transform: none; font-size: 0.75rem;"><i class="fas fa-shield-alt"></i> University Innovation Project</span>
            <span class="status-badge Assigned" style="text-transform: none; font-size: 0.75rem;"><i class="fas fa-bolt"></i> Gemini & OSM Integrated</span>
          </div>
        </div>

        <div class="footer-links">
          <h5>Platform</h5>
          <ul>
            <li><a href="/public-issues.html">Public Issues</a></li>
            <li><a href="/public-map.html">Interactive Map</a></li>
            <li><a href="/how-it-works.html">How It Works</a></li>
            <li><a href="/about.html">About Initiative</a></li>
          </ul>
        </div>

        <div class="footer-links">
          <h5>Citizens</h5>
          <ul>
            <li><a href="/report-issue.html">Report Grievance</a></li>
            <li><a href="/citizen-dashboard.html">My Dashboard</a></li>
            <li><a href="/notifications.html">Notifications</a></li>
            <li><a href="/contact.html">Support Desk</a></li>
          </ul>
        </div>

        <div class="footer-links">
          <h5>Administration</h5>
          <ul>
            <li><a href="/admin-dashboard.html">Municipal Portal</a></li>
            <li><a href="/analytics.html">Civic Analytics</a></li>
            <li><a href="/manage-departments.html">Departments</a></li>
            <li><a href="/admin-login.html">Official Login</a></li>
          </ul>
        </div>
      </div>

      <div class="footer-bottom">
        <div>&copy; 2026 CivicPulse Smart Civic Ecosystem. All rights reserved.</div>
        <div style="display: flex; gap: 1.5rem;">
          <a href="/about.html">Privacy Policy</a>
          <a href="/about.html">Terms of Service</a>
          <a href="/contact.html">Contact Us</a>
        </div>
      </div>
    </footer>
  `;
}

function loadChatbot() {
  if (document.getElementById('civicbot-script')) return;
  const script = document.createElement('script');
  script.id = 'civicbot-script';
  script.src = '/js/chatbot.js';
  document.body.appendChild(script);
}

document.addEventListener('DOMContentLoaded', () => {
  renderHeader();
  renderFooter();
  loadChatbot();
});
