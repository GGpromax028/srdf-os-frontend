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
      <button class="row" style="width:100%;text-align:left" id="twoFactorRow">
        <div class="row-icon">🔐</div>
        <div class="row-text"><div class="row-title">Zwei-Faktor-Authentifizierung</div><div class="row-sub" id="twoFactorStatusSub">Lädt…</div></div>
      </button>
      <button class="row" style="width:100%;text-align:left" id="logoutRow">
        <div class="row-icon">⏏</div>
        <div class="row-text"><div class="row-title" style="color:var(--danger)">Abmelden</div></div>
      </button>
      <button class="row" style="width:100%;text-align:left" id="invalidateAllRow">
        <div class="row-icon">⚠</div>
        <div class="row-text"><div class="row-title" style="color:var(--danger)">Alle Geräte abmelden</div><div class="row-sub">Notfall, z.B. bei gestohlenem Handy</div></div>
      </button>
    </div>

    <div class="section-h">Verbindungsstatus</div>
    <div class="glass">
      <div class="row"><div class="row-icon">◫</div><div class="row-text"><div class="row-title">Shopify</div></div>${statusBadgeFor(state.shopifyConfigured)}</div>
      <div class="row"><div class="row-icon">✦</div><div class="row-text"><div class="row-title">Claude-KI</div></div>${statusBadgeFor(state.aiConfigured)}</div>
      <div class="row"><div class="row-icon">▶</div><div class="row-text"><div class="row-title">Higgsfield (Video)</div></div>${statusBadgeFor(state.higgsfieldConfigured)}</div>
      <div class="row"><div class="row-icon">◈</div><div class="row-text"><div class="row-title">Instagram</div></div>${statusBadgeFor(state.instagramConfigured)}</div>
    </div>

    <div class="section-h">System &amp; Datenschutz</div>
    <div class="glass">
      <button class="row" style="width:100%;text-align:left" id="systemHealthRow">
        <div class="row-icon">♥</div>
        <div class="row-text"><div class="row-title">System-Gesundheit</div><div class="row-sub">Live-Check aller Sicherheitseinstellungen</div></div>
      </button>
      <button class="row" style="width:100%;text-align:left" id="backupsRow">
        <div class="row-icon">⟲</div>
        <div class="row-text"><div class="row-title">Backups</div><div class="row-sub">Automatisch täglich, 7 Tage aufbewahrt</div></div>
      </button>
      <button class="row" style="width:100%;text-align:left" id="notificationsRow">
        <div class="row-icon">✉</div>
        <div class="row-text"><div class="row-title">Benachrichtigungen</div><div class="row-sub">E-Mail bei kritischen Fehlern</div></div>
      </button>
      <button class="row" style="width:100%;text-align:left" id="privacyAuditRow">
        <div class="row-icon">🔒</div>
        <div class="row-text"><div class="row-title">Datenschutz-Übersicht</div><div class="row-sub">Was wird gespeichert, was wird geteilt</div></div>
      </button>
      <button class="row" style="width:100%;text-align:left" id="clearChatRow">
        <div class="row-icon">💬</div>
        <div class="row-text"><div class="row-title">Chat-Verlauf löschen</div><div class="row-sub">Löscht dein gesamtes Gespräch mit dem Assistenten</div></div>
      </button>
    </div>
  `;

  renderPermsList(perms);
  document.getElementById('changePwRow').onclick = openChangePasswordSheet;
  loadTwoFactorStatus();
  document.getElementById('twoFactorRow').onclick = openTwoFactorSheet;
  document.getElementById('logoutRow').onclick = () => {
    openSheet(`
      <div class="sheet-title">Wirklich abmelden?</div>
      <button class="btn btn-danger btn-full" style="margin-bottom:10px" onclick="logout();closeSheet()">Ja, abmelden</button>
      <button class="btn btn-glass btn-full" onclick="closeSheet()">Abbrechen</button>
    `);
  };
  document.getElementById('invalidateAllRow').onclick = () => {
    openSheet(`
      <div class="sheet-title">Alle Geräte abmelden?</div>
      <div class="sheet-sub">Jedes aktuell eingeloggte Gerät (auch dieses hier) wird sofort abgemeldet. Nutze das nur im Notfall, z.B. wenn dein Handy gestohlen wurde. Du musst dich danach selbst neu einloggen.</div>
      <div class="field" style="margin-bottom:18px">
        <label class="field-label">Passwort zur Bestätigung</label>
        <input class="input" id="invalidateAllPw" type="password" autocomplete="current-password">
      </div>
      <button class="btn btn-danger btn-full" id="confirmInvalidateAllBtn" style="margin-bottom:10px">Ja, alle Geräte abmelden</button>
      <button class="btn btn-glass btn-full" onclick="closeSheet()">Abbrechen</button>
    `);
    document.getElementById('confirmInvalidateAllBtn').onclick = async () => {
      const password = document.getElementById('invalidateAllPw').value;
      const btn = document.getElementById('confirmInvalidateAllBtn');
      btn.disabled = true;
      btn.innerHTML = '<div class="spinner"></div>';
      try {
        await api('/auth/invalidate-all-sessions', { method: 'POST', body: { password } });
        closeSheet();
        toast('Alle Geräte abgemeldet', 'Du wirst jetzt zum Login weitergeleitet.', 'success');
        setTimeout(() => logout(), 1200);
      } catch (err) {
        toast('Fehlgeschlagen', err.message, 'error');
        btn.disabled = false;
        btn.textContent = 'Ja, alle Geräte abmelden';
      }
    };
  };
  document.getElementById('systemHealthRow').onclick = openSystemHealthSheet;
  document.getElementById('backupsRow').onclick = openBackupsSheet;
  document.getElementById('notificationsRow').onclick = openNotificationsSheet;
  document.getElementById('privacyAuditRow').onclick = openPrivacyAuditSheet;
  document.getElementById('clearChatRow').onclick = () => {
    openSheet(`
      <div class="sheet-title">Chat-Verlauf wirklich löschen?</div>
      <div class="sheet-sub">Dein gesamtes bisheriges Gespräch mit dem Assistenten wird endgültig gelöscht. Das lässt sich nicht zurücknehmen.</div>
      <button class="btn btn-danger btn-full" id="confirmClearChatBtn" style="margin-bottom:10px">Ja, Verlauf löschen</button>
      <button class="btn btn-glass btn-full" onclick="closeSheet()">Abbrechen</button>
    `);
    document.getElementById('confirmClearChatBtn').onclick = async () => {
      const btn = document.getElementById('confirmClearChatBtn');
      btn.disabled = true;
      btn.innerHTML = '<div class="spinner"></div>';
      try {
        await api('/chat/history', { method: 'DELETE' });
        closeSheet();
        toast('Chat-Verlauf gelöscht', '', 'success');
      } catch (err) {
        toast('Fehlgeschlagen', err.message, 'error');
        btn.disabled = false;
        btn.textContent = 'Ja, Verlauf löschen';
      }
    };
  };
}

async function openNotificationsSheet() {
  openSheet(`<div class="sheet-title">Benachrichtigungen</div><div class="empty"><div class="spinner" style="margin:0 auto"></div></div>`);

  try {
    const status = await api('/system/notifications/status');

    openSheet(`
      <div class="sheet-title">E-Mail-Benachrichtigungen</div>
      <div class="sheet-sub">Bei kritischen Fehlern (z.B. fehlgeschlagener Beitrag, Backup-Problem) bekommst du automatisch eine E-Mail - höchstens eine pro 30 Minuten je Problem, damit es dich nicht überflutet.</div>
      <div class="glass" style="margin-bottom:16px; padding:14px">
        <div class="row-sub">${status.configured
          ? '✓ Eingerichtet und aktiv'
          : 'Noch nicht eingerichtet. Trage RESEND_API_KEY und NOTIFICATION_EMAIL in die .env-Datei des Backends ein (kostenloser Account auf resend.com).'}</div>
      </div>
      ${status.configured ? '<button class="btn btn-primary btn-full" id="sendTestEmailBtn">Test-E-Mail senden</button>' : ''}
    `);

    const testBtn = document.getElementById('sendTestEmailBtn');
    if (testBtn) {
      testBtn.onclick = async () => {
        testBtn.disabled = true;
        testBtn.innerHTML = '<div class="spinner"></div>';
        try {
          await api('/system/notifications/test', { method: 'POST' });
          toast('Test-E-Mail gesendet', 'Prüfe dein Postfach (auch den Spam-Ordner).', 'success');
        } catch (err) {
          toast('Fehlgeschlagen', err.message, 'error');
        } finally {
          testBtn.disabled = false;
          testBtn.textContent = 'Test-E-Mail senden';
        }
      };
    }
  } catch (err) {
    openSheet(`<div class="sheet-title">Fehler</div><div class="sheet-sub">${escapeHtml(err.message)}</div>`);
  }
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
        sw.classList.toggle('on');
        toast('Änderung fehlgeschlagen', err.message, 'error');
      }
    };
  });
}

// ═══════════════════════════════════════════════════════════
// SYSTEM-GESUNDHEIT
// ═══════════════════════════════════════════════════════════
async function openSystemHealthSheet() {
  openSheet(`<div class="sheet-title">System-Gesundheit</div><div class="empty"><div class="spinner" style="margin:0 auto"></div></div>`);

  try {
    const result = await api('/system/health-detail');
    const rows = result.checks.map(c => `
      <div class="row">
        <div class="row-icon">${c.ok ? '✓' : '⚠'}</div>
        <div class="row-text">
          <div class="row-title">${escapeHtml(c.name)}</div>
          <div class="row-sub">${escapeHtml(c.detail)}</div>
        </div>
      </div>`).join('');

    openSheet(`
      <div class="sheet-title">System-Gesundheit</div>
      <div class="sheet-sub">
        <span class="badge badge-${result.healthy ? 'green' : 'amber'}">${result.healthy ? 'Alles in Ordnung' : 'Achtung nötig'}</span>
      </div>
      <div class="glass" style="margin-top:4px">${rows}</div>
    `);
  } catch (err) {
    openSheet(`<div class="sheet-title">Fehler</div><div class="sheet-sub">${escapeHtml(err.message)}</div>`);
  }
}

// ═══════════════════════════════════════════════════════════
// BACKUPS
// ═══════════════════════════════════════════════════════════
async function openBackupsSheet() {
  openSheet(`<div class="sheet-title">Backups</div><div class="empty"><div class="spinner" style="margin:0 auto"></div></div>`);

  try {
    const backups = await api('/backup/list');
    const rows = backups.length === 0
      ? emptyState('⟲', 'Noch kein Backup', 'Das erste Backup wird automatisch beim nächsten Server-Start erstellt.')
      : backups.map(b => `
        <div class="row">
          <div class="row-icon">⟲</div>
          <div class="row-text">
            <div class="row-title">${formatRelativeTime(b.createdAt.replace('T', ' ').slice(0, 19))}</div>
            <div class="row-sub">${b.sizeKb} KB</div>
          </div>
          <button class="btn btn-glass" style="padding:8px 12px;font-size:12px" data-download-backup="${escapeHtml(b.name)}">Download</button>
        </div>`).join('');

    openSheet(`
      <div class="sheet-title">Backups</div>
      <div class="sheet-sub">Automatisch jede Nacht, die letzten 7 werden aufbewahrt. Lade dir regelmäßig eines herunter und speichere es z.B. auf Google Drive — falls Railway jemals komplett ausfällt, ist das deine einzige echte Rettung.</div>
      <div class="glass" style="margin-bottom:16px">${rows}</div>
      <button class="btn btn-glass btn-full" id="runBackupBtn">Jetzt manuell sichern</button>
    `);

    document.getElementById('runBackupBtn').onclick = async () => {
      const btn = document.getElementById('runBackupBtn');
      btn.disabled = true;
      btn.innerHTML = '<div class="spinner"></div>';
      try {
        await api('/backup/run', { method: 'POST' });
        toast('Backup gestartet', 'Läuft im Hintergrund, kurz warten und neu öffnen.', 'success');
        closeSheet();
      } catch (err) {
        toast('Fehlgeschlagen', err.message, 'error');
        btn.disabled = false;
        btn.textContent = 'Jetzt manuell sichern';
      }
    };

    document.querySelectorAll('[data-download-backup]').forEach(btn => {
      btn.onclick = () => downloadBackup(btn.dataset.downloadBackup, btn);
    });
  } catch (err) {
    openSheet(`<div class="sheet-title">Fehler</div><div class="sheet-sub">${escapeHtml(err.message)}</div>`);
  }
}

// Lädt eine Backup-Datei herunter. Ein normaler <a href> würde nicht
// funktionieren, weil die Route requireAuth nutzt (braucht den
// Bearer-Token im Header) - Browser-Navigation sendet sowas nicht mit.
// Deshalb: per fetch mit Header laden, als Blob in einen unsichtbaren
// Link packen und automatisch "klicken".
async function downloadBackup(filename, btn) {
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = '…';
  try {
    const res = await fetch(`${API_BASE}/backup/download/${encodeURIComponent(filename)}`, {
      headers: { Authorization: `Bearer ${state.token}` },
    });
    if (!res.ok) throw new Error('Download fehlgeschlagen.');

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    toast('Download fehlgeschlagen', err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

// ═══════════════════════════════════════════════════════════
// DATENSCHUTZ-AUDIT
// ═══════════════════════════════════════════════════════════
const SENSITIVITY_BADGE = { 'sehr hoch': 'red', hoch: 'amber', niedrig: 'gray' };

async function openPrivacyAuditSheet() {
  openSheet(`<div class="sheet-title">Datenschutz-Übersicht</div><div class="empty"><div class="spinner" style="margin:0 auto"></div></div>`);

  try {
    const audit = await api('/privacy/audit');
    const rows = audit.dataInventory.map(item => `
      <div style="padding:14px 16px;border-bottom:1px solid var(--glass-edge-soft)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <div style="font-size:13.5px;font-weight:700">${escapeHtml(item.category)}</div>
          <span class="badge badge-${SENSITIVITY_BADGE[item.sensitivity] || 'gray'}">${escapeHtml(item.sensitivity)}</span>
        </div>
        <div style="font-size:12px;color:var(--ink-dim);line-height:1.5;margin-bottom:4px">${escapeHtml(item.whatIsStored)}</div>
        <div style="font-size:11px;color:${item.sharedWithThirdParties ? 'var(--signal-amber)' : 'var(--success)'}">
          ${item.sharedWithThirdParties ? '⚠ ' + escapeHtml(typeof item.sharedWithThirdParties === 'string' ? item.sharedWithThirdParties : 'Wird an Dritte weitergegeben') : '✓ Bleibt vollständig privat'}
        </div>
        ${item.note ? `<div style="font-size:11px;color:var(--depth-blue);margin-top:4px">${escapeHtml(item.note)}</div>` : ''}
      </div>`).join('');

    openSheet(`
      <div class="sheet-title">Datenschutz-Übersicht</div>
      <div class="sheet-sub">Ehrlich, was wirklich gespeichert wird — keine Marketing-Sprache.</div>
      <div class="glass" style="margin-bottom:16px">${rows}</div>
      <button class="btn btn-glass btn-full" id="purgeDataBtn">Alte Protokolldaten löschen (1 Jahr+)</button>
    `);

    document.getElementById('purgeDataBtn').onclick = async () => {
      try {
        const result = await api('/privacy/purge', { method: 'POST', body: { olderThanDays: 365 } });
        toast('Aufgeräumt', `${result.activityLogDeleted + result.aiGenerationsDeleted} alte Einträge entfernt`, 'success');
        closeSheet();
      } catch (err) {
        toast('Fehlgeschlagen', err.message, 'error');
      }
    };
  } catch (err) {
    openSheet(`<div class="sheet-title">Fehler</div><div class="sheet-sub">${escapeHtml(err.message)}</div>`);
  }
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
// ZWEI-FAKTOR-AUTHENTIFIZIERUNG
// ═══════════════════════════════════════════════════════════
async function loadTwoFactorStatus() {
  const sub = document.getElementById('twoFactorStatusSub');
  if (!sub) return;
  try {
    const status = await api('/auth/2fa/status');
    state.twoFactorEnabled = status.enabled;
    sub.textContent = status.enabled ? '✓ Aktiv' : 'Nicht aktiv — empfohlen';
    sub.style.color = status.enabled ? 'var(--signal-green, #30d158)' : '';
  } catch (err) {
    sub.textContent = 'Status konnte nicht geladen werden';
  }
}

async function openTwoFactorSheet() {
  if (!state.twoFactorEnabled) {
    openTwoFactorSetupSheet();
    return;
  }

  let remaining = '…';
  try {
    const status = await api('/auth/2fa/recovery-codes/status');
    remaining = status.remaining;
  } catch {
    remaining = '?';
  }

  openSheet(`
    <div class="sheet-title">Zwei-Faktor-Authentifizierung</div>
    <div class="sheet-sub">✓ Aktiv. Du hast noch ${remaining} Wiederherstellungscode(s) übrig.</div>
    <button class="btn btn-glass btn-full" id="regenerateRecoveryBtn" style="margin-bottom:10px">Wiederherstellungscodes neu erstellen</button>
    <button class="btn btn-danger btn-full" id="openDisable2faBtn">2FA deaktivieren</button>
  `);

  document.getElementById('regenerateRecoveryBtn').onclick = openRegenerateRecoveryCodesSheet;
  document.getElementById('openDisable2faBtn').onclick = openTwoFactorDisableSheet;
}

// Schritt 1 der Einrichtung: QR-Code anzeigen, den du mit dem
// iPhone-Schlüsselbund (Einstellungen > Passwörter > + > QR-Code
// scannen) oder einer Authenticator-App scannst.
async function openTwoFactorSetupSheet() {
  openSheet(`<div class="sheet-title">2FA einrichten</div><div class="empty"><div class="spinner" style="margin:0 auto"></div></div>`);

  try {
    const { qrCodeDataUrl, secret } = await api('/auth/2fa/setup', { method: 'POST' });

    openSheet(`
      <div class="sheet-title">2FA einrichten</div>
      <div class="sheet-sub">Scanne diesen Code mit deinem iPhone-Schlüsselbund (Einstellungen → Passwörter → Mit Schlüsselbund einrichten → QR-Code scannen) oder einer Authenticator-App.</div>
      <div style="text-align:center; margin:16px 0">
        <img src="${qrCodeDataUrl}" alt="QR-Code für 2FA" style="width:200px; height:200px; border-radius:12px">
      </div>
      <div class="sheet-sub" style="font-size:11px; word-break:break-all; text-align:center; margin-bottom:16px">Funktioniert das Scannen nicht? Manuell eintragen: ${escapeHtml(secret)}</div>
      <div class="field" style="margin-bottom:18px">
        <label class="field-label">Bestätigungscode aus dem Schlüsselbund</label>
        <input class="input" id="twoFaConfirmCode" placeholder="123456" inputmode="numeric" maxlength="6" style="text-align:center;font-size:18px;letter-spacing:3px;font-family:var(--font-mono)">
      </div>
      <button class="btn btn-primary btn-full" id="twoFaConfirmBtn">2FA aktivieren</button>
      <div id="twoFaSetupError" style="color:var(--danger);font-size:12px;margin-top:10px;text-align:center"></div>
    `);

    document.getElementById('twoFaConfirmBtn').onclick = async () => {
      const code = document.getElementById('twoFaConfirmCode').value.trim();
      const errEl = document.getElementById('twoFaSetupError');
      const btn = document.getElementById('twoFaConfirmBtn');
      btn.disabled = true;
      btn.innerHTML = '<div class="spinner"></div>';
      try {
        const { recoveryCodes } = await api('/auth/2fa/confirm', { method: 'POST', body: { code } });
        toast('2FA aktiviert', '', 'success');
        loadTwoFactorStatus();
        showRecoveryCodesSheet(recoveryCodes, { isFirstTime: true });
      } catch (err) {
        errEl.textContent = err.message;
        btn.disabled = false;
        btn.textContent = '2FA aktivieren';
      }
    };
  } catch (err) {
    openSheet(`<div class="sheet-title">Fehler</div><div class="sheet-sub">${escapeHtml(err.message)}</div>`);
  }
}

// 2FA deaktivieren braucht das aktuelle Passwort zur Bestätigung -
// sonst könnte jemand mit kurzem Geräte-Zugriff einfach deinen
// zweiten Schutzfaktor abschalten, ohne das Passwort zu kennen.
function openTwoFactorDisableSheet() {
  openSheet(`
    <div class="sheet-title">2FA deaktivieren?</div>
    <div class="sheet-sub">Dein Konto ist dann nur noch durch dein Passwort geschützt, ohne den zweiten Faktor.</div>
    <div class="field" style="margin-bottom:18px">
      <label class="field-label">Passwort zur Bestätigung</label>
      <input class="input" id="twoFaDisablePw" type="password" autocomplete="current-password">
    </div>
    <button class="btn btn-danger btn-full" id="twoFaDisableBtn" style="margin-bottom:10px">2FA deaktivieren</button>
    <button class="btn btn-glass btn-full" onclick="closeSheet()">Abbrechen</button>
  `);

  document.getElementById('twoFaDisableBtn').onclick = async () => {
    const password = document.getElementById('twoFaDisablePw').value;
    const btn = document.getElementById('twoFaDisableBtn');
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div>';
    try {
      await api('/auth/2fa/disable', { method: 'POST', body: { password } });
      closeSheet();
      toast('2FA deaktiviert', '', 'success');
      loadTwoFactorStatus();
    } catch (err) {
      toast('Fehlgeschlagen', err.message, 'error');
      btn.disabled = false;
      btn.textContent = '2FA deaktivieren';
    }
  };
}

// Neue Codes erzeugen - macht alle bisherigen sofort ungültig.
// Braucht das Passwort, genau wie das Deaktivieren von 2FA.
function openRegenerateRecoveryCodesSheet() {
  openSheet(`
    <div class="sheet-title">Neue Wiederherstellungscodes</div>
    <div class="sheet-sub">Alle bisherigen Codes werden dadurch sofort ungültig. Du bekommst 8 neue Codes, die du dir sicher aufschreiben solltest.</div>
    <div class="field" style="margin-bottom:18px">
      <label class="field-label">Passwort zur Bestätigung</label>
      <input class="input" id="regenRecoveryPw" type="password" autocomplete="current-password">
    </div>
    <button class="btn btn-primary btn-full" id="regenRecoveryBtn">Neue Codes erstellen</button>
  `);

  document.getElementById('regenRecoveryBtn').onclick = async () => {
    const password = document.getElementById('regenRecoveryPw').value;
    const btn = document.getElementById('regenRecoveryBtn');
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div>';
    try {
      const { recoveryCodes } = await api('/auth/2fa/recovery-codes/regenerate', { method: 'POST', body: { password } });
      showRecoveryCodesSheet(recoveryCodes, { isFirstTime: false });
    } catch (err) {
      toast('Fehlgeschlagen', err.message, 'error');
      btn.disabled = false;
      btn.textContent = 'Neue Codes erstellen';
    }
  };
}

// Zeigt die Codes EINMALIG im Klartext, mit Kopier-Möglichkeit.
// Danach gibt es keine Möglichkeit mehr, sie erneut anzusehen -
// nur durch Neu-Erstellen (was die alten ungültig macht).
function showRecoveryCodesSheet(codes, { isFirstTime }) {
  openSheet(`
    <div class="sheet-title">Deine Wiederherstellungscodes</div>
    <div class="sheet-sub" style="color:var(--danger)">Wichtig: Diese Codes werden nur JETZT angezeigt. Schreib sie dir an einem sicheren Ort auf (z.B. Passwort-Manager oder Papier) — danach kannst du sie nicht mehr ansehen.</div>
    <div class="glass" style="padding:14px; margin:14px 0; font-family:var(--font-mono); font-size:14px; line-height:1.9; text-align:center">
      ${codes.map(c => escapeHtml(c)).join('<br>')}
    </div>
    <button class="btn btn-glass btn-full" id="copyRecoveryCodesBtn" style="margin-bottom:10px">In Zwischenablage kopieren</button>
    <button class="btn btn-primary btn-full" id="recoveryDoneBtn">${isFirstTime ? 'Ich habe sie gesichert' : 'Fertig'}</button>
  `);

  document.getElementById('copyRecoveryCodesBtn').onclick = async () => {
    try {
      await navigator.clipboard.writeText(codes.join('\n'));
      toast('Kopiert', 'In die Zwischenablage kopiert.', 'success');
    } catch {
      toast('Kopieren nicht möglich', 'Bitte die Codes manuell abschreiben.', 'error');
    }
  };

  document.getElementById('recoveryDoneBtn').onclick = () => {
    closeSheet();
    if (isFirstTime) {
      toast('2FA aktiviert', 'Beim nächsten Login wird der Code abgefragt.', 'success');
    } else {
      toast('Neue Codes gespeichert', 'Alte Codes sind jetzt ungültig.', 'success');
    }
  };
}

// ═══════════════════════════════════════════════════════════
// START
// ═══════════════════════════════════════════════════════════
initAuth();

const healthUrl = API_BASE.replace(/\/api\/?$/, '/health');
setInterval(() => {
  fetch(healthUrl).catch(() => {});
}, 4 * 60 * 1000);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
