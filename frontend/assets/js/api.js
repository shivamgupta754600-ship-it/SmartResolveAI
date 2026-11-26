/**
 * SmartResolve AI — API Client
 * Wraps fetch with JWT Bearer tokens and automatic refresh.
 */

const API_BASE = location.origin;

const TOKEN_KEY   = 'sr_access_token';
const REFRESH_KEY = 'sr_refresh_token';
const USER_KEY    = 'sr_user';

// Remove credentials cached by earlier versions on shared devices.
for (const key of [TOKEN_KEY, REFRESH_KEY, USER_KEY]) localStorage.removeItem(key)

// ---- Token helpers ----

export function getToken() {
    return sessionStorage.getItem(TOKEN_KEY);
}

export function setTokens(access, refresh) {
    sessionStorage.setItem(TOKEN_KEY, access);
    if (refresh) sessionStorage.setItem(REFRESH_KEY, refresh);
}

export function setUser(user) {
    sessionStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getUser() {
    try { return JSON.parse(sessionStorage.getItem(USER_KEY)); }
    catch { return null; }
}

export function clearSession() {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(REFRESH_KEY);
    sessionStorage.removeItem(USER_KEY);
}

export function isLoggedIn() {
    return !!getToken();
}

export function requireAuth() {
    if (!isLoggedIn()) {
        window.location.href = 'index.html';
    }
}

export function requireAdmin() {
    const user = getUser();
    if (!user || !user.is_admin) {
        showToast('Admin access required.', 'error');
        setTimeout(() => window.location.href = 'dashboard.html', 1500);
    }
}

// ---- Core request function ----

async function _attempt(endpoint, options, withToken) {
    const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(withToken && getToken() ? { 'Authorization': `Bearer ${getToken()}` } : {}),
        ...(options.headers || {}),
    };

    const res = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers,
    });

    return res;
}

async function _refresh() {
    const refreshToken = sessionStorage.getItem(REFRESH_KEY);
    if (!refreshToken) return false;
    try {
        const res = await fetch(`${API_BASE}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: refreshToken }),
        });
        if (!res.ok) return false;
        const data = await res.json();
        setTokens(data.access_token, null);
        return true;
    } catch {
        return false;
    }
}

export async function apiRequest(endpoint, options = {}) {
    let res = await _attempt(endpoint, options, true);

    if (res.status === 401) {
        const refreshed = await _refresh();
        if (!refreshed) {
            clearSession();
            window.location.href = 'index.html';
            return;
        }
        res = await _attempt(endpoint, options, true);
    }

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
        const msg = data.detail || `Request failed (${res.status})`;
        throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }

    return data;
}

// ---- Auth helpers ----

export async function login(username, password) {
    const data = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
    });
    setTokens(data.access_token, data.refresh_token);
    return data;
}

export async function register(username, email, password, full_name = '') {
    return apiRequest('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username, email, password, full_name }),
    });
}

export async function fetchMe() {
    const user = await apiRequest('/auth/me');
    setUser(user);
    return user;
}

export async function logout() {
    const token = sessionStorage.getItem(REFRESH_KEY) || getToken();
    if (token) fetch(API_BASE + '/auth/logout', {
        method: 'POST', headers: {Authorization: 'Bearer ' + token}, keepalive: true,
    }).catch(() => {});
    clearSession();
    window.location.href = 'index.html';
}

// ---- Grievance helpers ----

export async function predict(text) {
    return apiRequest('/grievances/predict', {
        method: 'POST',
        body: JSON.stringify({ text }),
    });
}

export async function fetchHistory() {
    return apiRequest('/grievances/history');
}

// ---- Admin helpers ----

export async function fetchAllPredictions() {
    return apiRequest('/grievances/admin/all');
}

export async function fetchReviewQueue() {
    return apiRequest('/grievances/admin/review');
}

export async function submitReview(id, review_status, review_notes = '') {
    return apiRequest(`/grievances/admin/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ review_status, review_notes }),
    });
}

// ---- Toast notifications (global) ----

export function showToast(message, type = 'info', duration = 3500) {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
    const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = `${icons[type] || 'ℹ️'} ${message}`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), duration);
}

// Encode values used in HTML text and quoted attributes of the legacy tables.
export function escapeHtml(value) {
    const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return String(value ?? '').replace(/[&<>"']/g, char => entities[char]);
}
