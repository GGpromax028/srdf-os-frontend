// ═══════════════════════════════════════════════════════════
// SRDF-OS Frontend · Kern (API-Client, State, Auth)
// ═══════════════════════════════════════════════════════════
// WICHTIG: Spricht mit dem echten Backend aus backend/.
// Kein localStorage für Geschäftsdaten — nur das Auth-Token wird
// hier lokal gehalten, alles andere kommt live vom Server.

const API_BASE = (() => {
  const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname);
  return isLocal ? 'http://localhost:3000/api' : 'https://srdf-os-backend-production.up.railway.app/api';
})();

const state = {
  token: null,
  tab: 'dashboard',
  permissions: [],
  socialAccounts: [],
  aiConfigured: false,
  shopifyConfigured: false,
  instagramConfigured: false,
  higgsfieldConfigured: false,
  backgroundActive: false,
  twoFactorEnabled: false,
};

// ── Hilfsfunktion: fetch mit Timeout ──
// Verhindert, dass die App ewig "hängt", falls Railway gerade aus dem
// Ruhezustand aufwacht oder die Verbindung komplett tot ist.
function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

// ── API-Client ──
async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;

  let res;
  try {
    res = await fetchWithTimeout(`${API_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    }, 15000);
  } catch (err) {
    const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname);
    if (err.name === 'AbortError') {
      throw new Error('Server antwortet nicht. Falls er gerade "aufgewacht" ist (nach Inaktivität), versuch es in 10–15 Sekunden nochmal.');
    }
    throw new Error(
      isLocal
        ? 'Backend nicht erreichbar. Läuft der Server lokal? (npm start im backend-Ordner)'
        : 'Backend nicht erreichbar. Prüfe, ob der Server bei Railway noch läuft (Railway-Dashboard → Deployments).'
    );
  }

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json() : null;

  if (!res.ok) {
    if (res.status === 401) {
      logout();
    }
    throw new Error(data?.error || `Fehler ${res.status}`);
  }
  return data;
}

// ── Toast (echtes Feedback zu echten Server-Antworten, kein Fake-Timer) ──
let toastTimer = null;
function toast(title, body = '', kind = 'info') {
  const el = document.getElementById('toast');
  const icon = { success: '✓', error: '⚠', info: 'ℹ' }[kind] || 'ℹ';
  el.innerHTML = `
    <div style="display:flex;gap:10px;align-items:flex-start">
      <div style="font-size:16px;line-height:1.3">${icon}</div>
      <div>
        <div class="toast-title">${escapeHtml(title)}</div>
        ${body ? `<div class="toast-body">${escapeHtml(body)}</div>` : ''}
      </div>
    </div>`;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3800);
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str ?? '';
  return d.innerHTML;
}

// ── Sheet (Bottom-Modal) ──
function openSheet(html) {
  document.getElementById('sheetContent').innerHTML = `<div class="sheet-handle"></div>${html}`;
  document.getElementById('sheetOverlay').classList.add('show');
}
function closeSheet() {
  document.getElementById('sheetOverlay').classList.remove('show');
}
document.getElementById('sheetOverlay').addEventListener('click', (e) => {
  if (e.target.id === 'sheetOverlay') closeSheet();
});

// ── Hintergrund-Aktivitäts-Ring ──
let activeBackgroundTasks = 0;
function pushBackgroundTask() {
  activeBackgroundTasks++;
  document.getElementById('statusRing').classList.add('active');
}
function popBackgroundTask() {
  activeBackgroundTasks = Math.max(0, activeBackgroundTasks - 1);
  if (activeBackgroundTasks === 0) {
    document.getElementById('statusRing').classList.remove('active');
  }
}
async function withActivity(fn) {
  pushBackgroundTask();
  try { return await fn(); }
  finally { popBackgroundTask(); }
}

// ═══════════════════════════════════════════════════════════
// AUTH / LOCK-SCREEN
// ═══════════════════════════════════════════════════════════
async function initAuth() {
  const saved = sessionStorage.getItem('srdf_token');
  if (saved) {
    state.token = saved;
    try {
      await api('/settings/permissions');
      return showMain();
    } catch {
      sessionStorage.removeItem('srdf_token');
      state.token = null;
    }
  }
  renderLock();
}

function logout() {
  state.token = null;
  sessionStorage.removeItem('srdf_token');
  document.getElementById('main').style.display = 'none';
  document.getElementById('lock').style.display = 'flex';
  renderLock();
}

async function renderLock() {
  const lock = document.getElementById('lock');
  lock.style.display = 'flex';

  let status;
  let attempt = 0;
  const maxAttempts = 4;

  while (attempt < maxAttempts) {
    if (attempt > 0) {
      lock.innerHTML = `
        <div class="lock-icon"><div class="spinner" style="border-top-color:#1a1000"></div></div>
        <div class="lock-title">Verbinde…</div>
        <div style="color:var(--ink-dim);font-size:13px;text-align:center">Server startet, einen Moment.</div>`;
    }
    try {
      status = await api('/auth/status');
      break;
    } catch (err) {
      attempt++;
      if (attempt >= maxAttempts) {
        const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname);
        lock.innerHTML = `
          <div class="lock-icon">⚠</div>
          <div class="lock-title">Server antwortet nicht</div>
          <div class="lock-card glass" style="text-align:center;color:var(--ink-dim);font-size:13px;line-height:1.6">
            ${escapeHtml(err.message)}
            ${isLocal ? `<br><br><span style="font-family:var(--font-mono);font-size:12px">cd backend && npm start</span>` : ''}
          </div>
          <button class="btn btn-primary" id="retryConnectBtn" style="margin-top:18px">Erneut versuchen</button>`;
        document.getElementById('retryConnectBtn').onclick = () => renderLock();
        return;
      }
      await new Promise((r) => setTimeout(r, 1200 * attempt));
    }
  }

  if (!status.configured) {
    renderSetup(lock);
  } else {
    renderLogin(lock);
  }
}

function renderSetup(lock) {
  lock.innerHTML = `
    <div class="lock-icon">✦</div>
    <div class="lock-title">Willkommen</div>
    <div style="color:var(--ink-dim);font-size:13.5px;text-align:center;max-width:280px">
      Lege jetzt dein Passwort fest. Es wird sicher verschlüsselt gespeichert — niemand, auch nicht du selbst später, kann es im Klartext nachsehen.
    </div>
    <div class="lock-card glass">
      <div class="field">
        <label class="field-label">Neues Passwort (mind. 10 Zeichen)</label>
        <input type="password" id="setupPw" class="input" placeholder="Buchstaben + Zahlen">
      </div>
      <div class="field" style="margin-bottom:18px">
        <label class="field-label">Wiederholen</label>
        <input type="password" id="setupPw2" class="input" placeholder="Nochmal eingeben">
      </div>
      <button class="btn btn-primary btn-full" id="setupBtn">Einrichten</button>
      <div id="setupError" style="color:var(--danger);font-size:12px;margin-top:10px;text-align:center"></div>
    </div>`;

  document.getElementById('setupBtn').onclick = async () => {
    const pw = document.getElementById('setupPw').value;
    const pw2 = document.getElementById('setupPw2').value;
    const errEl = document.getElementById('setupError');
    errEl.textContent = '';

    if (pw !== pw2) { errEl.textContent = 'Passwörter stimmen nicht überein.'; return; }

    try {
      await api('/auth/setup', { method: 'POST', body: { password: pw } });
      toast('Passwort gesetzt', 'Du kannst dich jetzt anmelden.', 'success');
      renderLogin(lock);
    } catch (err) {
      errEl.textContent = err.message;
    }
  };
}

function renderLogin(lock) {
  lock.innerHTML = `
    <div class="lock-icon">⬡</div>
    <div class="lock-title">SRDF-OS</div>
    <div style="color:var(--ink-dim);font-size:13px">Dein privates Business-Cockpit</div>
    <div class="lock-card glass">
      <div class="field" style="margin-bottom:18px">
        <label class="field-label">Passwort</label>
        <input type="password" id="loginPw" class="input" placeholder="••••••••••" autofocus autocomplete="current-password">
      </div>
      <button class="btn btn-primary btn-full" id="loginBtn">Entsperren</button>
      <div id="loginError" style="color:var(--danger);font-size:12px;margin-top:10px;text-align:center"></div>
    </div>`;

  const doLogin = async () => {
    const pw = document.getElementById('loginPw').value;
    const errEl = document.getElementById('loginError');
    const btn = document.getElementById('loginBtn');
    errEl.textContent = '';
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div>';

    try {
      const result = await api('/auth/login', { method: 'POST', body: { password: pw } });
      if (result.requiresTwoFactor) {
        renderTwoFactorPrompt(lock, result.preAuthToken);
        return;
      }
      state.token = result.token;
      sessionStorage.setItem('srdf_token', result.token);
      showMain();
    } catch (err) {
      errEl.textContent = err.message;
      btn.disabled = false;
      btn.textContent = 'Entsperren';
    }
  };

  document.getElementById('loginBtn').onclick = doLogin;
  document.getElementById('loginPw').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doLogin();
  });
}

// Zweiter Login-Schritt, nur wenn 2FA aktiv ist: Passwort war schon
// korrekt (Schritt 1), jetzt fehlt noch der 6-stellige Code aus dem
// Schlüsselbund/Authenticator. Wichtig: hier gibt es noch KEIN
// volles Session-Token - das passiert erst nach erfolgreicher
// Code-Prüfung in verifyTwoFactorLogin auf dem Server.
function renderTwoFactorPrompt(lock, preAuthToken) {
  lock.innerHTML = `
    <div class="lock-icon">🔐</div>
    <div class="lock-title">Bestätigungscode</div>
    <div style="color:var(--ink-dim);font-size:13px;text-align:center;max-width:280px">
      Öffne deinen Schlüsselbund/Authenticator und gib den aktuellen 6-stelligen Code ein.
    </div>
    <div class="lock-card glass">
      <div class="field" style="margin-bottom:18px">
        <label class="field-label">Code</label>
        <input type="text" id="twoFaCode" class="input" placeholder="123456" inputmode="numeric" maxlength="6" autocomplete="one-time-code" autofocus style="text-align:center;font-size:20px;letter-spacing:4px;font-family:var(--font-mono)">
      </div>
      <button class="btn btn-primary btn-full" id="twoFaBtn">Bestätigen</button>
      <button class="btn btn-glass btn-full" id="twoFaBackBtn" style="margin-top:10px">Zurück zum Passwort</button>
      <button class="btn-link" id="twoFaRecoveryLink" style="margin-top:14px;background:none;border:none;color:var(--depth-blue);font-size:12.5px;text-decoration:underline;cursor:pointer;display:block;width:100%;text-align:center">Schlüsselbund nicht verfügbar?</button>
      <div id="twoFaError" style="color:var(--danger);font-size:12px;margin-top:10px;text-align:center"></div>
    </div>`;

  const doVerify = async () => {
    const code = document.getElementById('twoFaCode').value.trim();
    const errEl = document.getElementById('twoFaError');
    const btn = document.getElementById('twoFaBtn');
    errEl.textContent = '';
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div>';

    try {
      const { token } = await api('/auth/login/verify-2fa', { method: 'POST', body: { preAuthToken, code } });
      state.token = token;
      sessionStorage.setItem('srdf_token', token);
      showMain();
    } catch (err) {
      errEl.textContent = err.message;
      btn.disabled = false;
      btn.textContent = 'Bestätigen';
    }
  };

  document.getElementById('twoFaBtn').onclick = doVerify;
  document.getElementById('twoFaBackBtn').onclick = () => renderLogin(lock);
  document.getElementById('twoFaRecoveryLink').onclick = () => renderRecoveryCodePrompt(lock, preAuthToken);
  document.getElementById('twoFaCode').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doVerify();
  });
}

// Notfall-Alternative zum normalen 2FA-Code: ein einmaliger
// Wiederherstellungscode, falls der Schlüsselbund/das iPhone nicht
// verfügbar ist. Jeder Code funktioniert nur EIN einziges Mal.
function renderRecoveryCodePrompt(lock, preAuthToken) {
  lock.innerHTML = `
    <div class="lock-icon">🗝</div>
    <div class="lock-title">Wiederherstellungscode</div>
    <div style="color:var(--ink-dim);font-size:13px;text-align:center;max-width:280px">
      Gib einen deiner gesicherten Wiederherstellungscodes ein. Jeder Code funktioniert nur ein einziges Mal.
    </div>
    <div class="lock-card glass">
      <div class="field" style="margin-bottom:18px">
        <label class="field-label">Code</label>
        <input type="text" id="recoveryCodeInput" class="input" placeholder="XXXXXX-XXXXXX" autocomplete="off" autofocus style="text-align:center;font-size:16px;letter-spacing:1px;font-family:var(--font-mono)">
      </div>
      <button class="btn btn-primary btn-full" id="recoveryBtn">Bestätigen</button>
      <button class="btn btn-glass btn-full" id="recoveryBackBtn" style="margin-top:10px">Zurück zum Code aus dem Schlüsselbund</button>
      <div id="recoveryError" style="color:var(--danger);font-size:12px;margin-top:10px;text-align:center"></div>
    </div>`;

  const doVerify = async () => {
    const recoveryCode = document.getElementById('recoveryCodeInput').value.trim();
    const errEl = document.getElementById('recoveryError');
    const btn = document.getElementById('recoveryBtn');
    errEl.textContent = '';
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div>';

    try {
      const { token, remaining } = await api('/auth/login/verify-recovery-code', { method: 'POST', body: { preAuthToken, recoveryCode } });
      state.token = token;
      sessionStorage.setItem('srdf_token', token);
      showMain();
      if (remaining <= 2) {
        setTimeout(() => toast('Wenige Wiederherstellungscodes übrig', `Nur noch ${remaining} Code(s) übrig. Erstelle bald neue in den Einstellungen.`, 'error'), 800);
      }
    } catch (err) {
      errEl.textContent = err.message;
      btn.disabled = false;
      btn.textContent = 'Bestätigen';
    }
  };

  document.getElementById('recoveryBtn').onclick = doVerify;
  document.getElementById('recoveryBackBtn').onclick = () => renderTwoFactorPrompt(lock, preAuthToken);
  document.getElementById('recoveryCodeInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doVerify();
  });
}

async function showMain() {
  const lockEl = document.getElementById('lock');
  lockEl.innerHTML = '';
  lockEl.style.display = 'none';
  document.getElementById('main').style.display = 'flex';
  await loadGlobalStatus();
  renderTabbar();
  navigateTo('dashboard');
}

async function loadGlobalStatus() {
  try {
    const [perms, social, aiStatus, shopifyStatus, igStatus, higgsfieldStatus] = await Promise.all([
      api('/settings/permissions'),
      api('/social/accounts'),
      api('/ai/status'),
      api('/shopify/status'),
      api('/social/instagram/status'),
      api('/higgsfield/status'),
    ]);
    state.permissions = perms;
    state.socialAccounts = social;
    state.aiConfigured = aiStatus.configured;
    state.shopifyConfigured = shopifyStatus.configured;
    state.instagramConfigured = igStatus.configured;
    state.higgsfieldConfigured = higgsfieldStatus.configured;
  } catch (err) {
    toast('Status konnte nicht geladen werden', err.message, 'error');
  }
}
