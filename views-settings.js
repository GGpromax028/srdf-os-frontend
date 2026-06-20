// ═══════════════════════════════════════════════════════════
// EINSTELLUNGEN-VIEW
// ═══════════════════════════════════════════════════════════
async function renderSettings(view) {
  const perms = await api('/settings/permissions');

  view.innerHTML = `
    <div class="section-h">Automatisierung — nur mit deiner Erlaubnis</div>
    <div class="glass" id="permsList"></div>
    <div style="font-size:11.5px;color:var(--ink-dim);padding:10px 6px;line-height:1.5">
      Solange ein Schalter aus ist, tut das System in diesem Bereich nichts von selbst — auch wenn alle Schlüssel verbunden sind.
    </div>

    <div class="section-h">Konto</div>
    <div class="glass">
      <button class="row" style="width:100%;text-align:left" id="changePwRow">
        <div class="row-icon">⚿</div>
        <div class="row-text"><div class="row-title">Passwort ändern</div></div>
      </button>
      <button class="row" style="width:100%;text-align:left" id="logoutRow">
        <div class="row-icon">⏏</div>
        <div class="row-text"><div class="row-title" style="color:var(--danger)">Abmelden</div></div>
      </button>
    </div>

    <div class="section-h">Verbindungsstatus</div>
    <div class="glass">
      <div class="row"><div class="row-icon">◫</div><div class="row-text"><div class="row-title">Shopify</div></div>${statusBadgeFor(state.shopifyConfigured)}</div>
      <div class="row"><div class="row-icon">✦</div><div class="row-text"><div class="row-title">Claude-KI</div></div>${statusBadgeFor(state.aiConfigured)}</div>
      <div class="row"><div class="row-icon">▶</div><div class="row-text"><div class="row-title">Higgsfield (Video)</div></div>${statusBadgeFor(state.higgsfieldConfigured)}</div>
      <div class="row"><div class="row-icon">◈</div><div class="row-text"><div class="row-title">Instagram</div></div>${statusBadgeFor(state.instagramConfigured)}</div>
    </div>
  `;

  renderPermsList(perms);
  document.getElementById('changePwRow').onclick = openChangePasswordSheet;
  document.getElementById('logoutRow').onclick = () => {
    openSheet(`
      <div class="sheet-title">Wirklich abmelden?</div>
      <button class="btn btn-danger btn-full" style="margin-bottom:10px" onclick="logout();closeSheet()">Ja, abmelden</button>
      <button class="btn btn-glass btn-full" onclick="closeSheet()">Abbrechen</button>
    `);
  };
}

function statusBadgeFor(configured) {
  return configured ? `<span class="badge badge-green">Verbunden</span>` : `<span class="badge badge-gray">Nicht verbunden</span>`;
}

function renderPermsList(perms) {
  const el = document.getElementById('permsList');
  el.innerHTML = perms.map(p => `
    <div class="row">
      <div class="row-text"><div class="row-title">${escapeHtml(p.label)}</div></div>
      <button class="switch ${p.enabled ? 'on' : ''}" data-perm-key="${p.perm_key}"></button>
    </div>`).join('');

  el.querySelectorAll('[data-perm-key]').forEach(sw => {
    sw.onclick = async () => {
      const key = sw.dataset.permKey;
      const newState = !sw.classList.contains('on');
      sw.classList.toggle('on');
      try {
        await api(`/settings/permissions/${key}`, { method: 'PUT', body: { enabled: newState } });
        toast(newState ? 'Aktiviert' : 'Deaktiviert', '', 'success');
      } catch (err) {
        sw.classList.toggle('on'); // zurücksetzen bei Fehler
        toast('Änderung fehlgeschlagen', err.message, 'error');
      }
    };
  });
}

function openChangePasswordSheet() {
  openSheet(`
    <div class="sheet-title">Passwort ändern</div>
    <div class="field"><label class="field-label">Aktuelles Passwort</label><input type="password" class="input" id="curPw"></div>
    <div class="field"><label class="field-label">Neues Passwort</label><input type="password" class="input" id="newPw"></div>
    <div class="field" style="margin-bottom:18px"><label class="field-label">Wiederholen</label><input type="password" class="input" id="newPw2"></div>
    <button class="btn btn-primary btn-full" id="changePwBtn">Ändern</button>
    <div id="changePwError" style="color:var(--danger);font-size:12px;margin-top:10px;text-align:center"></div>
  `);

  document.getElementById('changePwBtn').onclick = async () => {
    const cur = document.getElementById('curPw').value;
    const n1 = document.getElementById('newPw').value;
    const n2 = document.getElementById('newPw2').value;
    const errEl = document.getElementById('changePwError');

    if (n1 !== n2) { errEl.textContent = 'Neue Passwörter stimmen nicht überein.'; return; }

    try {
      await api('/auth/change-password', { method: 'POST', body: { currentPassword: cur, newPassword: n1 } });
      closeSheet();
      toast('Passwort geändert', '', 'success');
    } catch (err) {
      errEl.textContent = err.message;
    }
  };
}

// ═══════════════════════════════════════════════════════════
// START
// ═══════════════════════════════════════════════════════════
initAuth();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
