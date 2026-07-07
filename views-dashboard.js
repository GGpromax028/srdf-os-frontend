// ═══════════════════════════════════════════════════════════
// Navigation · Dock (Desktop-OS)
// ═══════════════════════════════════════════════════════════
// Die App wird als "Betriebssystem" bedient: der Home-Screen (⊞ Apps)
// zeigt alle Abteilungen als Kacheln (siehe views-desktop.js). Das Dock
// unten bleibt schlank und daumenfreundlich — nur die Dauerbrenner. Jede
// weitere Abteilung erreichst du über den Home-Screen.
const DOCK = [
  { id: 'desktop',  icon: '⊞', label: 'Apps' },
  { id: 'overview', icon: '◉', label: 'Übersicht' },
  { id: 'approvals', icon: '✓', label: 'Freigabe' },
  { id: 'chat',     icon: '◔', label: 'Chat' },
  { id: 'settings', icon: '⚙', label: 'Mehr' },
];

function renderTabbar() {
  const bar = document.getElementById('tabbar');
  bar.innerHTML = DOCK.map(t => `
    <button class="tab ${state.tab === t.id ? 'on' : ''}" data-tab="${t.id}">
      <div class="tab-icon">${t.icon}${t.id === 'approvals' && state.pendingApprovals > 0 ? `<span class="tab-dot">${state.pendingApprovals > 9 ? '9+' : state.pendingApprovals}</span>` : ''}</div>
      <div class="tab-label">${t.label}</div>
    </button>`).join('');

  bar.querySelectorAll('.tab').forEach(btn => {
    btn.onclick = () => navigateTo(btn.dataset.tab);
  });
}

// Lädt nur den kleinen Zähler für das Badge auf dem Freigabe-Tab und
// zeichnet die Tab-Leiste neu. Bewusst leise: schlägt der Aufruf fehl,
// bleibt einfach das alte Badge stehen, statt einen Fehler zu zeigen.
async function refreshApprovalBadge() {
  try {
    const { actionableCount } = await api('/approvals/count');
    state.pendingApprovals = actionableCount;
    renderTabbar();
  } catch { /* still ignorieren */ }
}

const VIEW_TITLES = {
  desktop: ['SRDF-OS', 'Deine Apps'],
  overview: ['Übersicht', 'Dein ganzes System auf einen Blick'],
  dashboard: ['Übersicht', 'Alles im Blick'],
  approvals: ['Freigabe-Center', 'Was auf dich wartet'],
  vertrieb: ['Vertrieb & Kunden', 'Mails & Beziehungen'],
  buchhaltung: ['Buchhaltung', 'Zahlen, Belege, USt'],
  chat: ['Chat-Assistent', 'Fragen zu deinem Shop'],
  shopify: ['Shopify', 'Produkte & Bestellungen'],
  social: ['Social Media', 'Verbindungen & Beiträge'],
  analytics: ['Analytics-Cockpit', 'Was bringt wirklich Geld?'],
  ai: ['KI-Werkzeuge', 'Echte Claude-Generierung'],
  settings: ['Einstellungen', 'Volle Kontrolle'],
};

// navigateTo(tab, opts)
// opts.focusCluster: Emoji einer Freigabe-Center-Cluster-Überschrift
//   (🛍/📈/✉️/📒) — nach dem Rendern wird dorthin gescrollt. So fühlen
//   sich "Vertrieb" und "Buchhaltung" wie eigene Apps an, obwohl sie
//   denselben, bereits geprüften Freigabe-Center-Code nutzen.
async function navigateTo(tab, opts = {}) {
  // "Vertrieb"/"Buchhaltung" sind eigene Apps, laufen aber über das
  // Freigabe-Center und springen zu ihrem Cluster.
  let renderTab = tab;
  let focusCluster = opts.focusCluster || null;
  if (tab === 'vertrieb')    { renderTab = 'approvals'; focusCluster = focusCluster || '✉'; }
  if (tab === 'buchhaltung') { renderTab = 'approvals'; focusCluster = focusCluster || '📒'; }

  state.tab = tab;
  renderTabbar();
  const [title, sub] = VIEW_TITLES[tab] || VIEW_TITLES.desktop;
  document.getElementById('topbarTitle').textContent = title;
  document.getElementById('topbarSub').textContent = sub;

  const view = document.getElementById('view');
  view.innerHTML = `<div class="empty"><div class="spinner" style="margin:0 auto"></div></div>`;

  try {
    if (renderTab === 'desktop') await renderDesktop(view);
    else if (renderTab === 'overview') await renderSystemOverview(view);
    else if (renderTab === 'dashboard') await renderDashboard(view);
    else if (renderTab === 'approvals') await renderApprovals(view);
    else if (renderTab === 'chat') await renderChat(view);
    else if (renderTab === 'shopify') await renderShopify(view);
    else if (renderTab === 'social') await renderSocial(view);
    else if (renderTab === 'analytics') await renderAnalytics(view);
    else if (renderTab === 'ai') await renderAi(view);
    else if (renderTab === 'settings') await renderSettings(view);
    if (focusCluster) scrollToClusterEmoji(view, focusCluster);
  } catch (err) {
    view.innerHTML = `<div class="empty"><div class="empty-icon">⚠</div><div class="empty-title">Etwas ist schiefgelaufen</div><div class="empty-sub">${escapeHtml(err.message)}</div></div>`;
  }

  // Badge auf dem Freigabe-Tab nach jeder Navigation aktualisieren -
  // so verschwindet der Zähler direkt, nachdem du etwas freigegeben hast.
  refreshApprovalBadge();
}

// Scrollt sanft zur Cluster-Überschrift, die mit dem Emoji beginnt. Die
// Überschriften im Freigabe-Center tragen kein festes id-Attribut, darum
// suchen wir das kleine Emoji-<span> und scrollen dessen Überschrift an.
// Fehlt der Cluster (weil dort nichts ansteht), bleibt die Seite oben —
// bewusst leise, kein Fehler.
function scrollToClusterEmoji(view, emoji) {
  requestAnimationFrame(() => {
    const spans = view.querySelectorAll('span');
    for (const s of spans) {
      const t = (s.textContent || '').trim();
      const styled = (s.parentElement && s.parentElement.getAttribute('style')) || '';
      if (t.startsWith(emoji) && /uppercase/.test(styled)) {
        s.parentElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    }
  });
}

// ═══════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════
async function renderDashboard(view) {
  const [posts, history, lowStock, dailyReport, briefing] = await Promise.all([
    api('/social/posts').catch(() => []),
    api('/ai/history').catch(() => []),
    api('/stats/low-stock').catch(() => []),
    api('/ai/daily-report').catch(() => null),
    api('/ai/briefing').catch(() => null),
  ]);

  const pendingPosts = posts.filter(p => p.status === 'draft' || p.status === 'scheduled');
  const failedPosts = posts.filter(p => p.status === 'failed');
  const publishedToday = posts.filter(p => p.status === 'published' &&
    new Date(p.published_at).toDateString() === new Date().toDateString());

  const configuredCount = [state.shopifyConfigured, state.aiConfigured, state.instagramConfigured].filter(Boolean).length;

  let headline, badgeKind, badgeText;
  if (configuredCount === 0) {
    headline = 'Bereit zum Start — verbinde deine ersten echten Dienste.';
    badgeKind = 'gray'; badgeText = 'Einrichtung ausstehend';
  } else if (failedPosts.length > 0) {
    headline = `${failedPosts.length} Beitrag konnte nicht veröffentlicht werden.`;
    badgeKind = 'red'; badgeText = 'Achtung nötig';
  } else if (lowStock.some(p => p.urgency === 'ausverkauft')) {
    headline = `${lowStock.filter(p => p.urgency === 'ausverkauft').length} Produkt ausverkauft.`;
    badgeKind = 'red'; badgeText = 'Bestand kritisch';
  } else if (pendingPosts.length > 0 || lowStock.length > 0) {
    headline = pendingPosts.length > 0
      ? `${pendingPosts.length} Entwurf wartet auf deine Freigabe.`
      : `${lowStock.length} Produkt mit niedrigem Bestand.`;
    badgeKind = 'amber'; badgeText = 'Wartet auf dich';
  } else {
    headline = 'Alles läuft reibungslos. Kein Handlungsbedarf.';
    badgeKind = 'green'; badgeText = 'Im grünen Bereich';
  }

  const briefingHtml = state.aiConfigured ? `
    <div class="glass fade-up" style="margin-bottom:14px; padding:16px; background:linear-gradient(135deg, rgba(255,159,10,.08), rgba(10,132,255,.08))">
      <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px">
        <span style="font-size:18px">☀️</span>
        <span style="font-weight:600; font-size:14px">Morgen-Briefing</span>
      </div>
      ${briefing ? `
        <div class="row-sub" style="margin-bottom:8px">Erstellt ${formatRelativeTime(briefing.created_at)}</div>
        <div style="white-space:pre-wrap; line-height:1.5; font-size:14px">${escapeHtml(briefing.output)}</div>
        <button class="btn btn-ghost" id="regenBriefing" style="margin-top:10px; font-size:13px">Neu erstellen</button>
      ` : `
        <div class="empty-sub" style="margin-bottom:10px">Noch kein Briefing vorhanden. Läuft automatisch jeden Morgen um 7:15 Uhr — oder jetzt manuell erstellen:</div>
        <button class="btn btn-primary" id="regenBriefing">Briefing jetzt erstellen</button>
      `}
    </div>` : '';

  const dailyReportHtml = state.aiConfigured ? `
    <div class="section-h">Tages-Report</div>
    <div class="glass" style="margin-bottom:14px; padding:14px">
      ${dailyReport ? `
        <div class="row-sub" style="margin-bottom:8px">Für ${formatDateDe(dailyReport.date)} · erstellt ${formatRelativeTime(dailyReport.created_at)}</div>
        <div style="white-space:pre-wrap; line-height:1.5">${escapeHtml(dailyReport.output)}</div>
        <button class="btn btn-ghost" id="regenReport" style="margin-top:10px; font-size:13px">Neu erstellen</button>
      ` : `
        <div class="empty-sub" style="margin-bottom:10px">Noch kein Report vorhanden. Läuft automatisch jeden Morgen um 7:30 Uhr — oder jetzt manuell erstellen:</div>
        <button class="btn btn-primary" id="regenReport">Report jetzt erstellen</button>
      `}
    </div>` : '';

  const lowStockHtml = (state.shopifyConfigured && lowStock.length > 0) ? `
    <div class="section-h">Lagerbestand-Warnungen</div>
    <div class="glass" style="margin-bottom:14px">
      ${lowStock.map(p => `
        <div class="row">
          <div class="row-icon" style="color:${p.urgency === 'ausverkauft' ? 'var(--danger)' : p.urgency === 'kritisch' ? 'var(--signal-amber)' : 'var(--ink-dim)'}">
            ${p.urgency === 'ausverkauft' ? '✕' : '⚠'}
          </div>
          <div class="row-text">
            <div class="row-title">${escapeHtml(p.title)}</div>
            <div class="row-sub">${p.urgency === 'ausverkauft' ? 'Ausverkauft' : `Noch ${p.inventoryQty} auf Lager`} · ${p.price != null ? p.price.toFixed(2) + ' €' : ''}</div>
          </div>
          <span class="badge badge-${p.urgency === 'ausverkauft' ? 'red' : p.urgency === 'kritisch' ? 'amber' : 'gray'}">${escapeHtml(p.urgency)}</span>
        </div>`).join('')}
    </div>` : '';

  view.innerHTML = `
    ${briefingHtml}
    <div class="vital-card glass fade-up">
      <div class="vital-top">
        <div>
          <div class="vital-label">Status</div>
          <div class="vital-headline">${headline}</div>
        </div>
        <span class="badge badge-${badgeKind}">${badgeText}</span>
      </div>
      <div class="vital-metrics">
        <div><div class="vital-metric-num">${configuredCount}/3</div><div class="vital-metric-label">Dienste live</div></div>
        <div><div class="vital-metric-num">${publishedToday.length}</div><div class="vital-metric-label">Heute gepostet</div></div>
        <div><div class="vital-metric-num">${history.length}</div><div class="vital-metric-label">KI-Texte erstellt</div></div>
      </div>
    </div>

    ${dailyReportHtml}
    ${lowStockHtml}

    <div class="grid2">
      <div class="card glass fade-up" id="quickShopify">
        <span class="card-icon">◫</span>
        <div class="card-title">Shopify</div>
        <div class="card-sub">${state.shopifyConfigured ? 'Verbunden' : 'Noch nicht verbunden'}</div>
      </div>
      <div class="card glass fade-up" id="quickAi">
        <span class="card-icon">✦</span>
        <div class="card-title">KI generieren</div>
        <div class="card-sub">${state.aiConfigured ? 'Bereit' : 'API-Key fehlt'}</div>
      </div>
    </div>

    <div class="section-h">Letzte Aktivität</div>
    <div class="glass" id="activityList"></div>
  `;

  document.getElementById('quickShopify').onclick = () => navigateTo('shopify');
  document.getElementById('quickAi').onclick = () => navigateTo('ai');

  const regenBtn = document.getElementById('regenReport');
  if (regenBtn) {
    regenBtn.onclick = async () => {
      regenBtn.disabled = true;
      regenBtn.textContent = 'Erstelle...';
      try {
        await api('/ai/daily-report/generate', { method: 'POST' });
        await renderDashboard(view);
      } catch (err) {
        toast('Report konnte nicht erstellt werden', err.message, 'error');
        regenBtn.disabled = false;
        regenBtn.textContent = 'Erneut versuchen';
      }
    };
  }

  const regenBriefingBtn = document.getElementById('regenBriefing');
  if (regenBriefingBtn) {
    regenBriefingBtn.onclick = async () => {
      regenBriefingBtn.disabled = true;
      regenBriefingBtn.textContent = 'Erstelle...';
      try {
        await api('/ai/briefing/generate', { method: 'POST' });
        await renderDashboard(view);
      } catch (err) {
        toast('Briefing konnte nicht erstellt werden', err.message, 'error');
        regenBriefingBtn.disabled = false;
        regenBriefingBtn.textContent = 'Erneut versuchen';
      }
    };
  }

  loadActivityList();
}

async function loadActivityList() {
  const el = document.getElementById('activityList');
  if (!el) return;
  try {
    const log = await api('/settings/activity?limit=8');
    if (log.length === 0) {
      el.innerHTML = `<div class="empty"><div class="empty-icon">○</div><div class="empty-title">Noch keine Aktivität</div><div class="empty-sub">Sobald du etwas tust, erscheint es hier — echt protokolliert, nichts simuliert.</div></div>`;
      return;
    }
    el.innerHTML = log.map(entry => `
      <div class="row">
        <div class="row-icon">${entry.success ? '✓' : '⚠'}</div>
        <div class="row-text">
          <div class="row-title">${escapeHtml(formatActionLabel(entry.action))}</div>
          <div class="row-sub">${escapeHtml(entry.detail || '')} · ${formatRelativeTime(entry.created_at)}</div>
        </div>
      </div>`).join('');
  } catch (err) {
    el.innerHTML = `<div class="empty"><div class="empty-sub">${escapeHtml(err.message)}</div></div>`;
  }
}

function formatActionLabel(action) {
  const map = {
    login_success: 'Erfolgreich angemeldet',
    login_failed: 'Anmeldung fehlgeschlagen',
    shopify_sync_products: 'Shopify-Produkte synchronisiert',
    shopify_sync_orders: 'Shopify-Bestellungen synchronisiert',
    ai_generate_product_description: 'Produktbeschreibung erstellt',
    ai_generate_caption: 'Social-Caption erstellt',
    ai_sales_analysis: 'Verkaufsanalyse erstellt',
    ai_trend_research: 'Trend-Recherche durchgeführt',
    instagram_post_published: 'Instagram-Beitrag veröffentlicht',
    instagram_post_failed: 'Instagram-Beitrag fehlgeschlagen',
    post_draft_created: 'Entwurf erstellt',
    permission_changed: 'Berechtigung geändert',
    owner_password_changed: 'Passwort geändert',
    low_stock_alert: '⚠ Lagerbestand-Warnung',
    backup_completed: 'Backup erstellt',
    health_check_warning: '⚠ System-Gesundheitswarnung',
  };
  return map[action] || action;
}

function formatRelativeTime(iso) {
  const diffMs = Date.now() - new Date(iso.replace(' ', 'T') + 'Z').getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'gerade jetzt';
  if (mins < 60) return `vor ${mins} Min.`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  return `vor ${Math.floor(hours / 24)} Tg.`;
}

function formatDateDe(dateStr) {
  // dateStr im Format YYYY-MM-DD
  const [y, m, d] = dateStr.split('-');
  return `${d}.${m}.${y}`;
}
