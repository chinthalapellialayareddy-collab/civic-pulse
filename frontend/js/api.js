// Central API Configuration & HTTP client
const API_BASE = (() => {
  const hostname = window.location.hostname;
  const port = window.location.port;

  // Local standalone development
  if (port === '3000' || port === '5173' || port === '8080') {
    return 'http://localhost:5000/api';
  }

  // When served directly on Render backend or local port 5000
  if (hostname.includes('onrender.com') || port === '5000') {
    return '/api';
  }

  // Deployed on Vercel or any remote mobile/laptop browser
  return 'https://civic-pulse-19kr.onrender.com/api';
})();

const api = {
  // Token handling
  getToken() {
    return localStorage.getItem('civicpulse_token');
  },
  setToken(token) {
    localStorage.setItem('civicpulse_token', token);
  },
  getUser() {
    const userStr = localStorage.getItem('civicpulse_user');
    try {
      return userStr ? JSON.parse(userStr) : null;
    } catch {
      return null;
    }
  },
  setUser(user) {
    localStorage.setItem('civicpulse_user', JSON.stringify(user));
  },
  clearAuth() {
    localStorage.removeItem('civicpulse_token');
    localStorage.removeItem('civicpulse_user');
  },
  logout() {
    this.clearAuth();
    window.location.href = '/login.html';
  },

  // Check if token is locally valid (non-expired) without server call
  isTokenValid() {
    const token = this.getToken();
    if (!token) return false;
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return false;
      const payload = JSON.parse(atob(parts[1]));
      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
        this.clearAuth();
        return false;
      }
      return true;
    } catch (e) {
      return false;
    }
  },

  // Generic fetch wrapper with auth header injection
  async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const headers = options.headers || {};
    const token = this.getToken();

    if (token && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    let response;
    try {
      response = await fetch(url, {
        ...options,
        headers
      });
    } catch (networkErr) {
      throw new Error('Cannot reach server. Make sure the backend is running on port 5000.');
    }

    const data = await response.json().catch(() => ({}));

    if ((response.status === 401 || response.status === 403) && !url.includes('/auth/login') && !url.includes('/auth/register')) {
      this.clearAuth();
      showToast('Session expired. Please log in again.', 'warning');
      setTimeout(() => {
        window.location.href = `/login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
      }, 1200);
      return { success: false, message: 'Session expired. Please log in again.' };
    }

    if (!response.ok) {
      throw new Error(data.message || `Request failed with status ${response.status}`);
    }

    return data;
  },

  get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  },

  post(endpoint, body) {
    return this.request(endpoint, {
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body)
    });
  },

  patch(endpoint, body) {
    return this.request(endpoint, {
      method: 'PATCH',
      body: body instanceof FormData ? body : JSON.stringify(body)
    });
  },

  put(endpoint, body) {
    return this.request(endpoint, {
      method: 'PUT',
      body: body instanceof FormData ? body : JSON.stringify(body)
    });
  },

  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }
};

// Global Toast Notifications
function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  const icon = type === 'success' ? 'fa-check-circle' :
               type === 'error' ? 'fa-exclamation-triangle' :
               type === 'warning' ? 'fa-exclamation-circle' : 'fa-info-circle';

  toast.innerHTML = `
    <i class="fas ${icon}" style="font-size: 1.25rem; margin-top: 2px;"></i>
    <div style="flex: 1;">
      <p style="font-weight: 600; font-size: 0.95rem; margin: 0; color: #1e293b;">${message}</p>
    </div>
    <button style="background: none; border: none; cursor: pointer; color: #94a3b8;" onclick="this.parentElement.remove()">
      <i class="fas fa-times"></i>
    </button>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(120%)';
    toast.style.transition = 'all 0.35s ease';
    setTimeout(() => toast.remove(), 350);
  }, 4500);
}

// Authentication guard helpers
function requireAuth(roleRequired = null) {
  const token = api.getToken();
  const user = api.getUser();

  // No token or user data at all → redirect to appropriate login portal
  if (!token || !user) {
    const loginTarget = roleRequired === 'Admin' ? '/admin-login.html' : '/login.html';
    window.location.href = `${loginTarget}?redirect=${encodeURIComponent(window.location.pathname)}`;
    return null;
  }

  // Client-side token expiry check
  if (!api.isTokenValid()) {
    showToast('Your session has expired. Please log in again.', 'warning');
    const loginTarget = roleRequired === 'Admin' ? '/admin-login.html' : '/login.html';
    setTimeout(() => {
      window.location.href = `${loginTarget}?redirect=${encodeURIComponent(window.location.pathname)}`;
    }, 800);
    return null;
  }

  // Role check: If Admin is required but user is Citizen
  if (roleRequired === 'Admin' && user.role !== 'Admin') {
    showToast('Access Restricted: Official Administrator privileges required.', 'error');
    setTimeout(() => {
      window.location.href = `/admin-login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
    }, 900);
    return null;
  }

  // Role check: If Citizen is required but user is Admin
  if (roleRequired === 'Citizen' && user.role !== 'Citizen') {
    window.location.href = '/admin-dashboard.html';
    return null;
  }

  return user;
}

// Optional auth — returns user if logged in, null if not, no redirect
function optionalAuth() {
  if (!api.isTokenValid()) return null;
  return api.getUser();
}
