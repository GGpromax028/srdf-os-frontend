// ═══════════════════════════════════════════════════════════
// Navigation
// ═══════════════════════════════════════════════════════════
const TABS = [
  { id: 'dashboard', icon: '◉', label: 'Übersicht' },
  { id: 'shopify', icon: '◫', label: 'Shopify' },
  { id: 'social', icon: '◈', label: 'Social' },
  { id: 'ai', icon: '✦', label: 'KI' },
  { id: 'settings', icon: '⚙', label: 'Einstellungen' },
];

function renderTabbar() {
  const bar = document.getElementById('tabbar');
  bar.innerHTML = TABS.map(t => `
    <button class="tab ${state.tab === t.id ? 'on' : ''}" data-tab="${t.id}">
      <div class="tab-icon">${t.icon}</div>
      <div class="tab-label">${t.label}</div>
    </button>`).join('');

  bar.querySelectorAll('.tab').forEach(btn => {
    btn.onclick = () => navigateTo(btn.dataset.tab);
  });
}

const VIEW_TITLES = {
  dashboard: ['Übersicht', 'Alles im Blick'],
  shopify: ['Shopify', 'Produkte & Bestellungen'],
  social: ['Social Media', 'Verbindungen & Beiträge'],
  ai: ['KI-Werkzeuge', 'Echte Claude-Generierung'],
  settings: ['Einstellungen', 'Volle Kontrolle'],
};

async function navigateTo(tab) {
  state.tab = tab;
  renderTabbar();
  const [title, sub] = VIEW_TITLES[tab];
  document.getElementById('topbarTitle').textContent = title;
  document.getElementById('topbarSub').textContent = sub;

  const view = document.getElementById('view');
  view.innerHTML = `<div class="empty"><div class="spinner" style="margin:0 auto"></div></div>`;

  try {
    if (tab === 'dashboard') await renderDashboard(view);
    else if (tab === 'shopify') await renderShopify(view);
    else if (tab === 'social') await renderSocial(view);
    else if (tab === 'ai') await renderAi(view);
    else if (tab === 'settings') await renderSettings(view);
  } catch (err) {
    view.innerHTML = `<div class="empty"><div class="empty-icon">⚠</div><div class="empty-title">Etwas ist schiefgelaufen</div><div class="empty-sub">${escapeHtml(err.message)}</div></div>`;
  }
}

// ═══════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════
async function renderDashboard(view) {
  const [posts, history, lowStock, dailyReport] = await Promise.all([
    api('/social/posts').catch(() => []),
    api('/ai/history').catch(() => []),
    api('/stats/low-stock').catch(() => []),
    api('/ai/daily-report').catch(() => null),
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
