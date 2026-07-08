// ═══════════════════════════════════════════════════════════
// SRDF-OS · Desktop-Ebene (App-Launcher + System-Übersicht)
// ═══════════════════════════════════════════════════════════
// Macht aus der flachen Tab-Leiste ein echtes "Betriebssystem":
// ein Home-Screen mit App-Kacheln je Abteilung + eine Übersichts-App,
// die das ganze System auf einer Seite zusammenfasst.
//
// WICHTIG: Rein Frontend. Ruft nur BESTEHENDE Endpunkte auf, zeigt nur
// echte Zahlen vom Server (nichts simuliert). Keine neue Aktion geht
// live — die Kacheln öffnen nur Ansichten, freigegeben wird weiter
// ausschließlich im Freigabe-Center.

// ── App-Register (FALLBACK) ──
// Die maßgebliche Quelle ist seit der App-Plattform der Server:
// GET /api/system/apps (backend/src/services/appRegistry.js). Dieses
// statische Register dient nur noch als Fallback, wenn der Aufruf
// ausfällt (offline/PWA-Start) — der Desktop bleibt immer benutzbar.
// tab = Ziel für navigateTo(). "vertrieb"/"buchhaltung" öffnen das
// Freigabe-Center, gezielt an ihrem Cluster (siehe navigateTo).
const APPS = {
  overview:    { icon: '◉',  label: 'Übersicht',     sub: 'Alles auf einen Blick',   tab: 'overview' },
  approvals:   { icon: '✓',  label: 'Freigabe',      sub: 'Was auf dich wartet',     tab: 'approvals', badge: true },
  automations: { icon: '⟳',  label: 'Automatik',     sub: 'Was von selbst läuft',    tab: 'automations' },
  ai:          { icon: '✦',  label: 'Marketing-KI',  sub: 'Texte & Bilder erstellen', tab: 'ai' },
  social:      { icon: '◈',  label: 'Social Media',  sub: 'Kanäle & Beiträge',        tab: 'social' },
  vertrieb:    { icon: '✉',  label: 'Vertrieb',      sub: 'Kunden & Mails',           tab: 'vertrieb' },
  shopify:     { icon: '◫',  label: 'Shopify',       sub: 'Produkte & Bestellungen',  tab: 'shopify' },
  analytics:   { icon: '◭',  label: 'Cockpit',       sub: 'Was bringt Geld?',         tab: 'analytics' },
  buchhaltung: { icon: '📒', label: 'Buchhaltung',   sub: 'Zahlen, Belege, USt',      tab: 'buchhaltung' },
  chat:        { icon: '◔',  label: 'Chat',          sub: 'Frag deinen Shop',         tab: 'chat' },
  settings:    { icon: '⚙',  label: 'Einstellungen', sub: 'Volle Kontrolle',          tab: 'settings' },
};

// Abteilungs-Struktur des Home-Screens (jede Gruppe = ein Bereich).
const APP_GROUPS = [
  { title: 'Zentrale',              apps: ['overview', 'approvals', 'automations'] },
  { title: 'Marketing & Vertrieb',  apps: ['ai', 'social', 'vertrieb'] },
  { title: 'Shop & Finanzen',       apps: ['shopify', 'analytics', 'buchhaltung'] },
  { title: 'System',                apps: ['chat', 'settings'] },
];

function greetingByHour() {
  const h = new Date().getHours();
  if (h < 5)  return 'Noch wach?';
  if (h < 11) return 'Guten Morgen';
  if (h < 17) return 'Guten Tag';
  if (h < 22) return 'Guten Abend';
  return 'Gute Nacht';
}

// ═══════════════════════════════════════════════════════════
// HOME-SCREEN (App-Launcher)
// ═══════════════════════════════════════════════════════════
// Eine App-Kachel. count = ehrlicher "wartet auf dich"-Zähler
// (null/0 = kein Badge — nie eine erfundene Zahl).
function appTileHtml(id, a, count) {
  const badge = (count > 0)
    ? `<span class="app-tile-badge">${count > 99 ? '99+' : count}</span>` : '';
  return `
    <button class="app-tile glass" data-app="${id}">
      <span class="app-tile-icon">${a.icon}${badge}</span>
      <span class="app-tile-label">${escapeHtml(a.label)}</span>
      <span class="app-tile-sub">${escapeHtml(a.sub)}</span>
    </button>`;
}

async function renderDesktop(view) {
  // Das App-Register kommt vom Server (App-Plattform): EINE Quelle für
  // Kacheln, Gruppen und Zähler — jede dort registrierte App erscheint
  // hier automatisch. Fällt der Aufruf aus, rendert das statische
  // Fallback-Register mit dem Freigabe-Zähler wie bisher.
  let registry = null;
  try { registry = await api('/system/apps'); } catch { /* Fallback unten */ }

  let groupsHtml;
  const tabById = {};

  if (registry && Array.isArray(registry.apps) && registry.apps.length) {
    const appById = {};
    registry.apps.forEach(a => { appById[a.id] = a; tabById[a.id] = a.tab; });
    if (appById.approvals && appById.approvals.pendingCount != null) {
      state.pendingApprovals = appById.approvals.pendingCount;
    }
    groupsHtml = (registry.groups || []).map(g => `
      <div class="desktop-section">${escapeHtml(g.title)}</div>
      <div class="app-grid">
        ${g.apps.map(id => appById[id]).filter(Boolean)
          .map(a => appTileHtml(a.id, a, a.pendingCount)).join('')}
      </div>
    `).join('');
  } else {
    // Fallback: statisches Register + schlanker Freigabe-Zähler.
    let pending = state.pendingApprovals || 0;
    try {
      const { actionableCount } = await api('/approvals/count');
      pending = actionableCount;
      state.pendingApprovals = actionableCount;
    } catch { /* still */ }
    Object.keys(APPS).forEach(id => { tabById[id] = APPS[id].tab; });
    groupsHtml = APP_GROUPS.map(g => `
      <div class="desktop-section">${g.title}</div>
      <div class="app-grid">
        ${g.apps.map(id => appTileHtml(id, APPS[id], APPS[id].badge ? pending : 0)).join('')}
      </div>
    `).join('');
  }

  view.innerHTML = `
    <div class="desktop fade-up">
      <div class="desktop-hero glass">
        <div class="desktop-hero-label">SRDF-OS</div>
        <div class="desktop-hero-title">${greetingByHour()}</div>
        <div class="desktop-hero-sub">Wähle eine App. Alles Zusammengehörige liegt an einem Ort — und nichts geht ohne deine Freigabe live.</div>
      </div>
      ${groupsHtml}
    </div>`;

  view.querySelectorAll('[data-app]').forEach(btn => {
    btn.onclick = () => navigateTo(tabById[btn.dataset.app] || 'desktop');
  });
}

// ═══════════════════════════════════════════════════════════
// SYSTEM-ÜBERSICHT (die "Übersichts-App" über das ganze System)
// ═══════════════════════════════════════════════════════════
// Eine Seite, die jede Abteilung zusammenfasst: was wartet, wie stehen
// die Finanzen, was lief zuletzt. Alles aus bestehenden Endpunkten,
// jeder Aufruf einzeln abgesichert, damit eine langsame Abteilung nicht
// die ganze Übersicht blockiert.
async function renderSystemOverview(view) {
  const [pending, bilanz, ust, cockpit, activity, automations, radar, registry] = await Promise.all([
    api('/approvals/pending').catch(() => ({})),
    api('/accounting/reports/bilanz').catch(() => null),
    api('/accounting/reports/ust').catch(() => null),
    api('/analytics/cockpit?days=30').catch(() => null),
    api('/settings/activity?limit=6').catch(() => []),
    api('/system/automations').catch(() => null),
    api('/analytics/radar').catch(() => null),
    api('/system/apps').catch(() => null),
  ]);

  const postDrafts             = pending.postDrafts || [];
  const failedPosts            = pending.failedPosts || [];
  const lowStock               = pending.lowStock || [];
  const seasonalIdeas          = pending.seasonalIdeas || [];
  const priceSuggestions       = pending.priceSuggestions || [];
  const storefrontSuggestions  = pending.storefrontSuggestions || [];
  const crmTasks               = pending.crmTasks || [];
  const bookingProposals       = pending.bookingProposals || [];
  const reorderTasks           = pending.reorderTasks || [];
  const orderedReorders        = pending.orderedReorders || [];

  const marketingCount   = postDrafts.length + failedPosts.length + seasonalIdeas.length + storefrontSuggestions.length;
  const vertriebCount    = crmTasks.length;
  const shopCount        = lowStock.length + priceSuggestions.length + reorderTasks.length + orderedReorders.length;
  const buchhaltungCount = bookingProposals.length;
  const totalWaiting     = marketingCount + vertriebCount + shopCount + buchhaltungCount;

  // ── Ehrliche Gesamtaussage ──
  let badgeKind = 'green', badgeText = 'Im grünen Bereich', headline = 'Alles erledigt — nichts wartet auf dich.';
  if (failedPosts.length > 0) {
    badgeKind = 'red'; badgeText = 'Achtung nötig';
    headline = `${failedPosts.length} Beitrag konnte nicht veröffentlicht werden.`;
  } else if (lowStock.some(p => p.urgency === 'ausverkauft')) {
    badgeKind = 'red'; badgeText = 'Bestand kritisch';
    headline = `${lowStock.filter(p => p.urgency === 'ausverkauft').length} Produkt ausverkauft.`;
  } else if (totalWaiting > 0) {
    badgeKind = 'amber'; badgeText = 'Wartet auf dich';
    headline = `${totalWaiting} ${totalWaiting === 1 ? 'Sache wartet' : 'Dinge warten'} auf deine Freigabe.`;
  }

  // ── Heutiger Fokus (Umsatz-Radar): das verkauft sich gerade wirklich ──
  // Ein Streifen mit der Nummer-1-Empfehlung aus der Datenanalyse. Tippen
  // führt ins Freigabe-Center, wo die passenden Vorschläge warten.
  const top = radar && Array.isArray(radar.focus) && radar.focus.length ? radar.focus[0] : null;
  const focusStripHtml = top ? `
    <div class="section-h">Heutiger Fokus</div>
    <button class="glass auto-strip" id="overviewToFocus">
      <div class="auto-strip-main">🎯 <b>${escapeHtml(top.title || 'Produkt')}</b>${radar.source === 'sales' ? '' : ' <span class="badge badge-gray">Näherung</span>'}</div>
      <div class="auto-strip-sub">
        ${escapeHtml((top.reasons || []).slice(0, 2).join(' · '))}
        ${radar.bestChannel ? ` · Stärkster Kanal: ${escapeHtml(radar.bestChannel.channel)}` : ''}
      </div>
    </button>` : '';

  // ── Abteilungs-Kacheln: Zahl = "wartet auf dich", Tippen = dorthin, wo du handelst ──
  // Die Karten kommen aus dem Server-Register (App-Plattform): eine neue
  // Abteilung erscheint hier automatisch. Fallback = die bekannten vier.
  let depts;
  if (registry && Array.isArray(registry.departments) && registry.departments.length) {
    depts = registry.departments.map(d => ({
      icon: d.icon, title: d.title, n: d.pendingCount, tab: d.tab, focus: d.focus,
      // Sonderfall: Buchhaltung ohne offene Buchungen zeigt die USt des
      // Zeitraums (die Info hat die Übersicht ohnehin schon geladen).
      hint: (d.id === 'buchhaltung' && d.pendingCount === 0 && ust && ust.zahllastAbs)
        ? `USt ${ust.periodLabel}: ${ust.zahllastAbs}` : d.hint,
    }));
  } else {
    depts = [
      { icon: '🛍', title: 'Marketing & Social', n: marketingCount,
        hint: marketingCount ? `${marketingCount} zur Freigabe` : 'Nichts offen',
        tab: 'approvals', focus: '🛍' },
      { icon: '✉️', title: 'Vertrieb & Kunden', n: vertriebCount,
        hint: vertriebCount ? `${vertriebCount} Kunden-Mail(s) im Entwurf` : 'Keine offenen Mails',
        tab: 'vertrieb' },
      { icon: '📈', title: 'Shop & Umsatz', n: shopCount,
        hint: shopCount ? `${shopCount}× Bestand / Preis / Einkauf` : 'Bestand ok',
        tab: 'approvals', focus: '📈' },
      { icon: '📒', title: 'Buchhaltung', n: buchhaltungCount,
        hint: buchhaltungCount ? `${buchhaltungCount} Buchung(en) zu bestätigen`
                               : (ust && ust.zahllastAbs ? `USt ${ust.periodLabel}: ${ust.zahllastAbs}` : 'Bereit'),
        tab: 'buchhaltung' },
    ];
  }

  const deptGridHtml = `
    <div class="section-h">Abteilungen</div>
    <div class="dept-grid">
      ${depts.map(d => `
        <button class="dept-card glass" data-dept-tab="${d.tab}" data-dept-focus="${d.focus || ''}">
          <div class="dept-card-top">
            <span class="dept-card-icon">${d.icon}</span>
            ${d.n == null ? `<span class="badge badge-gray">–</span>`
              : d.n > 0 ? `<span class="badge badge-amber">${d.n}</span>`
              : `<span class="badge badge-gray">ok</span>`}
          </div>
          <div class="dept-card-title">${escapeHtml(d.title)}</div>
          <div class="dept-card-hint">${escapeHtml(d.hint)}</div>
        </button>`).join('')}
    </div>`;

  // ── Finanz-Streifen (nur wenn es echte Buchungen gibt) ──
  const hasBooks = bilanz && bilanz.summeAktivaCents > 0;
  const hasUst = ust && ust.zahllastAbs != null;
  const financeHtml = hasBooks ? `
    <div class="section-h">Finanzen</div>
    <div class="glass fin-strip">
      <div class="fin-cell">
        <div class="fin-num">${cockpit && cockpit.roi ? cockpit.roi.revenue.toFixed(0) + ' €' : '–'}</div>
        <div class="fin-label">Umsatz 30 Tage</div>
      </div>
      <div class="fin-cell">
        <div class="fin-num" style="color:${bilanz.jahresergebnisCents >= 0 ? 'var(--success)' : 'var(--danger)'}">${escapeHtml(bilanz.jahresergebnis)}</div>
        <div class="fin-label">${bilanz.jahresergebnisCents >= 0 ? 'Gewinn (GuV)' : 'Verlust (GuV)'}</div>
      </div>
      <div class="fin-cell">
        <div class="fin-num" style="color:${hasUst && ust.zahllastCents < 0 ? 'var(--success)' : 'var(--ink)'}">${hasUst ? escapeHtml(ust.zahllastAbs) : '–'}</div>
        <div class="fin-label">${hasUst ? (ust.zahllastCents >= 0 ? 'USt-Zahllast' : 'USt-Erstattung') : 'USt'}</div>
      </div>
    </div>
    <div class="row-sub" style="margin:8px 6px 0">Buchungs-Zahlen aus deinem Journal. USt-Zeitraum: ${hasUst ? escapeHtml(ust.periodLabel) : 'aktueller Monat'} · ersetzt keine Steuerberatung.</div>
  ` : `
    <div class="section-h">Finanzen</div>
    <div class="glass" style="padding:18px">
      <div class="row-sub">Noch keine Buchungen erfasst. Sobald Umsätze, Einkäufe oder Ausgaben gebucht sind, erscheinen hier GuV, Umsatz und USt auf einen Blick.</div>
    </div>`;

  // ── Letzte Aktivität (echt protokolliert) ──
  const activityHtml = `
    <div class="section-h">Letzte Aktivität</div>
    <div class="glass">
      ${(activity && activity.length) ? activity.map(e => `
        <div class="row">
          <div class="row-icon">${e.success ? '✓' : '⚠'}</div>
          <div class="row-text">
            <div class="row-title">${escapeHtml(formatActionLabel(e.action))}</div>
            <div class="row-sub">${escapeHtml(e.detail || '')}${e.detail ? ' · ' : ''}${formatRelativeTime(e.created_at)}</div>
          </div>
        </div>`).join('')
      : `<div class="empty"><div class="empty-icon">○</div><div class="empty-title">Noch keine Aktivität</div><div class="empty-sub">Sobald du etwas tust, erscheint es hier — echt protokolliert, nichts simuliert.</div></div>`}
    </div>`;

  view.innerHTML = `
    <div class="vital-card glass fade-up">
      <div class="vital-top">
        <div>
          <div class="vital-label">System-Status</div>
          <div class="vital-headline">${escapeHtml(headline)}</div>
        </div>
        <span class="badge badge-${badgeKind}">${badgeText}</span>
      </div>
      <div class="vital-metrics">
        <div><div class="vital-metric-num">${totalWaiting}</div><div class="vital-metric-label">Offen gesamt</div></div>
        <div><div class="vital-metric-num">${vertriebCount}</div><div class="vital-metric-label">Kunden-Mails</div></div>
        <div><div class="vital-metric-num">${buchhaltungCount}</div><div class="vital-metric-label">Buchungen</div></div>
      </div>
      <button class="btn btn-primary btn-full" id="overviewToApprovals" style="margin-top:16px;font-size:13px">Zum Freigabe-Center</button>
    </div>

    ${focusStripHtml}
    ${deptGridHtml}
    ${automationOverviewStrip(automations)}
    ${financeHtml}
    ${activityHtml}

    <button class="btn btn-glass btn-full" id="overviewToDesktop" style="margin-top:16px;font-size:13px">⊞ Alle Apps</button>
  `;

  document.getElementById('overviewToApprovals').onclick = () => navigateTo('approvals');
  document.getElementById('overviewToDesktop').onclick = () => navigateTo('desktop');
  const toFocus = document.getElementById('overviewToFocus');
  if (toFocus) toFocus.onclick = () => navigateTo('approvals');
  const toAuto = document.getElementById('overviewToAutomations');
  if (toAuto) toAuto.onclick = () => navigateTo('automations');
  view.querySelectorAll('[data-dept-tab]').forEach(btn => {
    btn.onclick = () => {
      const focus = btn.dataset.deptFocus;
      navigateTo(btn.dataset.deptTab, focus ? { focusCluster: focus } : {});
    };
  });
}
