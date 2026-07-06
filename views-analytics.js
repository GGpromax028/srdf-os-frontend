// ═══════════════════════════════════════════════════════════
// Analytics-Cockpit · Was bringt wirklich Geld?
// ═══════════════════════════════════════════════════════════
// Zeigt EHRLICH aus echten Daten: Umsatz je Kanal (zugeordnet über ein
// nachvollziehbares Zeitfenster), Wirkung einzelner Posts, Kosten vs.
// Umsatz (ROI) und daraus abgeleitete Empfehlungen. Reine Auswertung -
// verändert nichts am Shop, deshalb keine Freigabe nötig.

// Gewählter Zeitraum bleibt über Re-Renders erhalten.
let analyticsDays = 30;

async function renderAnalytics(view) {
  const cockpit = await api(`/analytics/cockpit?days=${analyticsDays}`);
  const a = cockpit.attribution;
  const roi = cockpit.roi;

  const periodBtn = (d, label) => `
    <button class="ac-period ${analyticsDays === d ? 'on' : ''}" data-days="${d}"
      style="flex:1;padding:9px 0;border-radius:10px;font-size:12.5px;font-weight:600;
      background:${analyticsDays === d ? 'var(--signal-amber)' : 'var(--glass-fill)'};
      color:${analyticsDays === d ? '#1a1000' : 'var(--ink-dim)'};border:1px solid var(--glass-edge)">${label}</button>`;

  view.innerHTML = `
    <div style="display:flex;gap:8px;margin-bottom:16px">
      ${periodBtn(7, '7 Tage')}${periodBtn(30, '30 Tage')}${periodBtn(90, '90 Tage')}
    </div>

    <div class="vital-card glass fade-up" style="margin-bottom:14px">
      <div class="vital-metrics" style="flex-wrap:wrap;gap:18px">
        <div><div class="vital-metric-num">${roi.revenue.toFixed(0)} €</div><div class="vital-metric-label">Umsatz (bezahlt)</div></div>
        <div><div class="vital-metric-num">${a.channels.length}</div><div class="vital-metric-label">aktive Kanäle</div></div>
        <div><div class="vital-metric-num">${roi.aiCostEur.toFixed(2)} €</div><div class="vital-metric-label">KI-Kosten</div></div>
        <div><div class="vital-metric-num" style="color:var(--success)">${roi.roiPerEuro != null ? roi.roiPerEuro + '×' : '–'}</div><div class="vital-metric-label">Umsatz je 1€ KI</div></div>
      </div>
    </div>

    <div class="section-h">Umsatz je Kanal</div>
    <div class="glass" style="padding:6px 0">
      ${renderChannelBars(a)}
    </div>

    <div class="section-h">Wirkungsvollste Posts</div>
    <div class="glass" style="padding:6px 0">
      ${renderPostImpact(cockpit.impact.top)}
    </div>

    ${cockpit.impact.weakest.length > 0 ? `
    <div class="section-h">Posts ohne messbaren Verkauf</div>
    <div class="glass" style="padding:6px 0">
      ${cockpit.impact.weakest.map(p => `
        <div class="row">
          <div class="row-icon">💤</div>
          <div class="row-text">
            <div class="row-title">${escapeHtml(p.productTitle)}</div>
            <div class="row-sub">${escapeHtml(p.channel)} · noch kein zuordenbarer Verkauf im ${cockpit.impact.impactWindowDays}-Tage-Fenster</div>
          </div>
        </div>`).join('')}
    </div>` : ''}

    <div class="section-h">Empfehlungen</div>
    <div class="glass" style="padding:6px 0">
      ${cockpit.recommendations.map(r => `
        <div class="row">
          <div class="row-icon">${r.icon}</div>
          <div class="row-text">
            <div class="row-title">${escapeHtml(r.title)}</div>
            <div class="row-sub">${escapeHtml(r.detail)}</div>
          </div>
        </div>`).join('')}
    </div>

    <div class="section-h">Kunden-Segmente</div>
    <div class="glass" style="padding:6px 0">
      ${renderSegments(cockpit.segments)}
    </div>

    <div class="section-h">KI-Kurzfassung</div>
    <div class="glass" style="padding:16px">
      <div id="acInsight" style="font-size:13.5px;line-height:1.55;color:var(--ink-dim)">
        Lass dir die Zahlen von der KI in einem Absatz zusammenfassen — was läuft, wo ist Potenzial, ein nächster Schritt.
      </div>
      <button id="acInsightBtn" class="btn btn-glass btn-full" style="margin-top:12px">KI-Zusammenfassung erstellen</button>
    </div>

    <div class="glass" style="padding:14px 16px;margin-top:14px">
      <div style="font-size:11.5px;color:var(--ink-faint);line-height:1.5">
        <strong style="color:var(--ink-dim)">So wird gerechnet:</strong> ${escapeHtml(cockpit.method.note)}
      </div>
    </div>
  `;

  view.querySelectorAll('.ac-period').forEach(btn => {
    btn.onclick = () => {
      analyticsDays = Number(btn.dataset.days);
      renderAnalytics(view);
    };
  });

  const insightBtn = document.getElementById('acInsightBtn');
  insightBtn.onclick = async () => {
    insightBtn.disabled = true;
    insightBtn.textContent = 'Wird erstellt…';
    const box = document.getElementById('acInsight');
    try {
      const res = await api('/analytics/insight', { method: 'POST', body: { days: analyticsDays } });
      if (res.configured && res.insight) {
        box.style.color = 'var(--ink)';
        box.innerHTML = escapeHtml(res.insight).replace(/\n/g, '<br>');
        insightBtn.style.display = 'none';
      } else {
        // Ohne Anthropic-Key: ehrlicher Hinweis + die deterministischen
        // Empfehlungen stehen ja bereits oben.
        box.style.color = 'var(--ink-dim)';
        box.innerHTML = 'Für die KI-Kurzfassung fehlt noch der Anthropic-API-Key. Die Empfehlungen oben sind bereits vollständig aus deinen echten Zahlen abgeleitet.';
        insightBtn.disabled = false;
        insightBtn.textContent = 'KI-Zusammenfassung erstellen';
      }
    } catch (err) {
      box.style.color = 'var(--danger)';
      box.textContent = err.message;
      insightBtn.disabled = false;
      insightBtn.textContent = 'Nochmal versuchen';
    }
  };
}

function renderChannelBars(a) {
  if (a.channels.length === 0 && a.unattributedRevenue === 0) {
    return `<div class="row"><div class="row-icon">📊</div><div class="row-text">
      <div class="row-title">Noch keine Umsätze im Zeitraum</div>
      <div class="row-sub">Sobald bezahlte Bestellungen reinkommen, erscheint hier die Kanal-Aufteilung.</div>
    </div></div>`;
  }
  const max = Math.max(a.totalRevenue, 1);
  const bar = (label, revenue, share, sub, color) => `
    <div class="row" style="display:block">
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px">
        <div class="row-title">${escapeHtml(label)}</div>
        <div style="font-size:13px;font-weight:700">${revenue.toFixed(2)} € <span style="color:var(--ink-dim);font-weight:500">· ${share}%</span></div>
      </div>
      <div style="height:8px;border-radius:6px;background:var(--glass-fill);overflow:hidden">
        <div style="height:100%;width:${Math.max((revenue / max) * 100, 2)}%;background:${color};border-radius:6px"></div>
      </div>
      ${sub ? `<div class="row-sub" style="margin-top:5px">${escapeHtml(sub)}</div>` : ''}
    </div>`;

  let html = a.channels.map(c =>
    bar(c.channel, c.revenue, c.share, `${c.creditedPosts} Post(s) · ${c.orders} Bestellung(en)`, 'var(--signal-amber)')
  ).join('');

  if (a.unattributedRevenue > 0) {
    html += bar('Direkt / nicht zuordenbar', a.unattributedRevenue, a.unattributedShare,
      'Kein vorausgehender Post zum gekauften Produkt gefunden', 'var(--ink-faint)');
  }
  return html;
}

function renderSegments(seg) {
  if (!seg || seg.totalCustomers === 0) {
    return `<div class="row"><div class="row-icon">👥</div><div class="row-text">
      <div class="row-title">Noch keine Kundschaft im Blick</div>
      <div class="row-sub">Sobald bezahlte Bestellungen mit Kundendaten vorliegen, erscheinen hier deine Kunden-Segmente.</div>
    </div></div>`;
  }
  const maxVal = Math.max(...seg.segments.map(s => s.totalValue), 1);
  const bars = seg.segments.map(s => `
    <div class="row" style="display:block">
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px">
        <div class="row-title">${s.icon} ${escapeHtml(s.label)} <span style="color:var(--ink-dim);font-weight:500">· ${s.count}</span></div>
        <div style="font-size:13px;font-weight:700">${s.totalValue.toFixed(2)} €</div>
      </div>
      <div style="height:8px;border-radius:6px;background:var(--glass-fill);overflow:hidden">
        <div style="height:100%;width:${Math.max((s.totalValue / maxVal) * 100, 2)}%;background:var(--depth-blue);border-radius:6px"></div>
      </div>
      <div class="row-sub" style="margin-top:5px">${escapeHtml(s.hint)}</div>
    </div>`).join('');

  const top = seg.topCustomers.filter(c => c.spent > 0).map(c => `
    <div class="row">
      <div class="row-icon">${c.segmentIcon}</div>
      <div class="row-text">
        <div class="row-title">${escapeHtml(c.name || c.email)}</div>
        <div class="row-sub">${c.orders} Bestellung(en)${c.lastOrderDays != null ? ` · zuletzt vor ${c.lastOrderDays} Tag(en)` : ''} · ${escapeHtml(c.segmentLabel)}</div>
      </div>
      <div style="font-size:14px;font-weight:700;color:var(--success)">${c.spent.toFixed(2)} €</div>
    </div>`).join('');

  return `
    <div class="row" style="padding-bottom:6px"><div class="row-text">
      <div class="row-sub">${seg.totalCustomers} Kund(en) · ${seg.totalValue.toFixed(2)} € Gesamtumsatz (gesamte Kundschaft, zeitraum-unabhängig)</div>
    </div></div>
    ${bars}
    ${top ? `<div class="row" style="padding-top:12px"><div class="row-text"><div class="row-title" style="font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:var(--ink-dim)">Beste Kunden</div></div></div>${top}` : ''}`;
}

function renderPostImpact(posts) {
  const withRevenue = posts.filter(p => p.revenueAfter > 0);
  if (withRevenue.length === 0) {
    return `<div class="row"><div class="row-icon">✨</div><div class="row-text">
      <div class="row-title">Noch keine messbare Post-Wirkung</div>
      <div class="row-sub">Sobald ein veröffentlichter Post von einem Verkauf im Zeitfenster gefolgt wird, erscheint er hier.</div>
    </div></div>`;
  }
  return withRevenue.map(p => `
    <div class="row">
      <div class="row-icon">🏆</div>
      <div class="row-text">
        <div class="row-title">${escapeHtml(p.productTitle)}</div>
        <div class="row-sub">${escapeHtml(p.channel)} · ${p.unitsAfter} Stück verkauft</div>
      </div>
      <div style="font-size:14px;font-weight:700;color:var(--success)">${p.revenueAfter.toFixed(2)} €</div>
    </div>`).join('');
}
