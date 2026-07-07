// ═══════════════════════════════════════════════════════════
// Automatik-Zentrale · was SRDF-OS von selbst tut
// ═══════════════════════════════════════════════════════════
// Zeigt LIVE alle Hintergrund-Automatiken: Zeitplan, Status, nächster
// Lauf, letzter tatsächlicher Lauf. Rein lesend (GET /system/automations).
// Nichts wird hier ausgelöst — Automatiken BEREITEN nur vor, freigegeben
// wird ausschließlich im Freigabe-Center.

// ── Zeit-Helfer (voll-ISO tauglich, Zukunft UND Vergangenheit) ──
function automationRelFuture(iso) {
  if (!iso) return '—';
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return 'jetzt gleich';
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'in <1 Min.';
  if (mins < 60) return `in ${mins} Min.`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `in ${hours} Std.`;
  return `in ${Math.round(hours / 24)} Tg.`;
}

function automationRelPast(iso) {
  if (!iso) return 'noch nie';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0) return 'gerade jetzt';
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'gerade jetzt';
  if (mins < 60) return `vor ${mins} Min.`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  return `vor ${Math.floor(hours / 24)} Tg.`;
}

function automationStatusBadge(status) {
  const kind = status === 'Aktiv' ? 'green'
    : status === 'Wartet auf KI-Key' ? 'blue'
    : 'gray';
  return `<span class="badge badge-${kind}">${escapeHtml(status)}</span>`;
}

function automationDotColor(status) {
  return status === 'Aktiv' ? 'var(--success)'
    : status === 'Wartet auf KI-Key' ? 'var(--depth-blue)'
    : 'var(--ink-faint)';
}

const AUTO_CATEGORY_ORDER = ['Täglich', 'Wöchentlich', 'Verwaltung', 'Laufend'];

// ═══════════════════════════════════════════════════════════
// Volle App-Ansicht
// ═══════════════════════════════════════════════════════════
async function renderAutomations(view) {
  let data;
  try {
    data = await api('/system/automations');
  } catch (err) {
    view.innerHTML = `<div class="empty"><div class="empty-icon">⚠</div><div class="empty-title">Konnte nicht geladen werden</div><div class="empty-sub">${escapeHtml(err.message)}</div></div>`;
    return;
  }

  const { automations, summary } = data;

  const headHtml = `
    <div class="vital-card glass fade-up">
      <div class="vital-top">
        <div>
          <div class="vital-label">Automatik-Zentrale</div>
          <div class="vital-headline">${summary.activeCount} von ${summary.total} Automatiken aktiv.</div>
        </div>
        <span class="badge badge-${summary.activeCount > 0 ? 'green' : 'gray'}">${summary.activeCount > 0 ? 'Läuft' : 'Ruht'}</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;font-size:12.5px;color:var(--ink-dim);margin-top:4px">
        <div>⏭ Nächster Lauf: ${summary.nextUp ? `<b style="color:var(--ink)">${escapeHtml(summary.nextUp.label)}</b> ${automationRelFuture(summary.nextUp.nextRunISO)}` : '—'}</div>
        <div>✓ Zuletzt gelaufen: ${summary.last ? `<b style="color:var(--ink)">${escapeHtml(summary.last.label)}</b> ${automationRelPast(summary.last.at)}` : 'noch keine erfasst'}</div>
      </div>
    </div>`;

  // Nach Kategorie gruppieren, feste Reihenfolge.
  const byCat = {};
  for (const a of automations) (byCat[a.category] ||= []).push(a);
  const cats = AUTO_CATEGORY_ORDER.filter((c) => byCat[c]).concat(
    Object.keys(byCat).filter((c) => !AUTO_CATEGORY_ORDER.includes(c))
  );

  const groupsHtml = cats.map((cat) => `
    <div class="section-h">${escapeHtml(cat)}</div>
    ${byCat[cat].map((a) => `
      <div class="auto-item glass">
        <div class="auto-item-head">
          <span class="auto-dot" style="background:${automationDotColor(a.status)}"></span>
          <div style="flex:1;min-width:0">
            <div class="auto-title">${escapeHtml(a.label)}</div>
            <div class="auto-sched">${escapeHtml(a.humanSchedule)}</div>
          </div>
          ${automationStatusBadge(a.status)}
        </div>
        <div class="auto-desc">${escapeHtml(a.desc)}</div>
        <div class="auto-meta">
          ${a.nextRunISO ? `<span>⏭ Nächster Lauf: <b>${automationRelFuture(a.nextRunISO)}</b></span>` : ''}
          <span>✓ Zuletzt: <b>${automationRelPast(a.lastRun && a.lastRun.at)}</b>${a.lastRun && a.lastRun.note ? ` · ${escapeHtml(a.lastRun.note)}` : ''}${a.lastRun && a.lastRun.ok === false ? ' ⚠' : ''}</span>
        </div>
      </div>`).join('')}
  `).join('');

  view.innerHTML = `
    ${headHtml}
    ${groupsHtml}
    <div class="glass" style="padding:16px;margin-top:14px">
      <div class="row-sub" style="line-height:1.5">Automatiken <b>bereiten nur vor</b> — jeder Post, jede Mail, jede Buchung und jede Preisänderung wartet im Freigabe-Center auf deine Bestätigung. Auto-Posting und der Autopilot lassen sich in den Einstellungen ein-/ausschalten.</div>
    </div>
    <div class="grid2" style="margin-top:14px">
      <button class="btn btn-primary" id="autoToApprovals">Zum Freigabe-Center</button>
      <button class="btn btn-glass" id="autoToSettings">Einstellungen</button>
    </div>`;

  document.getElementById('autoToApprovals').onclick = () => navigateTo('approvals');
  document.getElementById('autoToSettings').onclick = () => navigateTo('settings');
}

// ═══════════════════════════════════════════════════════════
// Kompakter Streifen für die System-Übersicht
// ═══════════════════════════════════════════════════════════
// Gibt HTML zurück (oder ''), das renderSystemOverview einbettet. So bleibt
// die Übersicht die eine Stelle, an der "alles, was gemacht wird" auftaucht.
function automationOverviewStrip(data) {
  if (!data || !data.summary) return '';
  const s = data.summary;
  return `
    <div class="section-h">Automatik</div>
    <button class="glass auto-strip" id="overviewToAutomations">
      <div class="auto-strip-main">⟳ <b>${s.activeCount} Automatik(en)</b> aktiv</div>
      <div class="auto-strip-sub">
        Nächster Lauf: ${s.nextUp ? `${escapeHtml(s.nextUp.label)} ${automationRelFuture(s.nextUp.nextRunISO)}` : '—'}
        · Zuletzt: ${s.last ? `${escapeHtml(s.last.label)} ${automationRelPast(s.last.at)}` : '—'}
      </div>
    </button>`;
}
