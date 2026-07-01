// ═══════════════════════════════════════════════════════════
// SHOPIFY-VIEW
// ═══════════════════════════════════════════════════════════
async function renderShopify(view) {
  // Demo-Status separat prüfen, BEVOR wir wegen fehlender echter
  // Shopify-Verbindung abbrechen - Demo-Daten sollen gerade dann
  // nutzbar sein, wenn noch keine echten Zugangsdaten eingetragen sind.
  const demoStatus = await api('/demo/status').catch(() => ({ loaded: false }));

  if (!state.shopifyConfigured && !demoStatus.loaded) {
    view.innerHTML = notConfiguredCard(
      'Shopify ist noch nicht verbunden',
      'Trage SHOPIFY_STORE_DOMAIN und SHOPIFY_ADMIN_ACCESS_TOKEN in die .env-Datei des Backends ein, oder lade dir in den Einstellungen Demo-Daten zum Ausprobieren.'
    );
    return;
  }

  const [products, orders, dashboardStats, margins, lowMargins] = await Promise.all([
    api('/shopify/products').catch(() => []),
    api('/shopify/orders').catch(() => []),
    api('/stats/dashboard').catch(() => null),
    api('/stats/margins').catch(() => []),
    api('/stats/margins/low').catch(() => []),
  ]);

  const demoBannerHtml = demoStatus.loaded ? `
    <div class="glass" style="margin-bottom:14px; padding:10px 14px; border:1px solid rgba(255,159,10,.3); display:flex; align-items:center; gap:8px">
      <span>🧪</span>
      <span style="font-size:12.5px; color:var(--signal-amber)">Demo-Daten aktiv — das sind Testwerte, keine echten Zahlen.</span>
    </div>` : '';

  view.innerHTML = `
    ${demoBannerHtml}
    <div class="grid2">
      <button class="btn btn-glass btn-full" id="syncProductsBtn">↻ Produkte syncen</button>
      <button class="btn btn-glass btn-full" id="syncOrdersBtn">↻ Bestellungen syncen</button>
    </div>

    ${dashboardStats ? renderStatsSection(dashboardStats) : ''}

    ${margins.length > 0 ? renderMarginSection(margins, lowMargins) : ''}

    <div class="section-h">Produkte (${products.length})</div>
    <div class="glass" id="productsList"></div>

    <div class="section-h">Bestellungen (${orders.length})</div>
    <div class="glass" id="ordersList"></div>
  `;

  renderProductsList(products);
  renderOrdersList(orders);
  if (dashboardStats) {
    drawRevenueChart(dashboardStats.revenueByDay);
    drawTopProductsChart(dashboardStats.topProducts);
  }
  if (margins.length > 0) {
    wireMarginEditButtons();
  }

  document.getElementById('syncProductsBtn').onclick = async () => {
    await withActivity(async () => {
      try {
        const result = await api('/shopify/sync/products', { method: 'POST' });
        toast('Produkte synchronisiert', `${result.count} echte Produkte von Shopify geladen`, 'success');
        navigateTo('shopify');
      } catch (err) {
        toast('Sync fehlgeschlagen', err.message, 'error');
      }
    });
  };

  document.getElementById('syncOrdersBtn').onclick = async () => {
    await withActivity(async () => {
      try {
        const result = await api('/shopify/sync/orders', { method: 'POST' });
        toast('Bestellungen synchronisiert', `${result.count} echte Bestellungen von Shopify geladen`, 'success');
        navigateTo('shopify');
      } catch (err) {
        toast('Sync fehlgeschlagen', err.message, 'error');
      }
    });
  };
}

function renderProductsList(products) {
  const el = document.getElementById('productsList');
  if (products.length === 0) {
    el.innerHTML = emptyState('◫', 'Noch keine Produkte geladen', 'Klicke oben auf "Produkte syncen", um echte Daten von Shopify zu holen.');
    return;
  }
  el.innerHTML = products.map(p => `
    <div class="row">
      <div class="row-icon">◫</div>
      <div class="row-text">
        <div class="row-title">${escapeHtml(p.title)}</div>
        <div class="row-sub">${p.sku ? 'SKU: ' + escapeHtml(p.sku) + ' · ' : ''}Bestand: ${p.inventory_qty ?? '–'}</div>
      </div>
      <div style="font-family:var(--font-mono);font-weight:600;font-size:13px">${p.price != null ? p.price.toFixed(2) + ' €' : '–'}</div>
    </div>`).join('');
}

function renderOrdersList(orders) {
  const el = document.getElementById('ordersList');
  if (orders.length === 0) {
    el.innerHTML = emptyState('◫', 'Noch keine Bestellungen geladen', 'Klicke oben auf "Bestellungen syncen", um echte Daten von Shopify zu holen.');
    return;
  }
  el.innerHTML = orders.map(o => `
    <div class="row">
      <div class="row-icon">$</div>
      <div class="row-text">
        <div class="row-title">Bestellung #${escapeHtml(o.order_number || o.shopify_id)}</div>
        <div class="row-sub">${escapeHtml(o.financial_status || 'unbekannt')}</div>
      </div>
      <div style="font-family:var(--font-mono);font-weight:600;font-size:13px">${o.total_price != null ? o.total_price.toFixed(2) + ' €' : '–'}</div>
    </div>`).join('');
}

// ── Geteilte UI-Helfer ──
function notConfiguredCard(title, body) {
  return `<div class="empty glass fade-up" style="margin-top:30px">
    <div class="empty-icon">○</div>
    <div class="empty-title">${escapeHtml(title)}</div>
    <div class="empty-sub">${escapeHtml(body)}</div>
  </div>`;
}
function emptyState(icon, title, sub) {
  return `<div class="empty">
    <div class="empty-icon">${icon}</div>
    <div class="empty-title">${escapeHtml(title)}</div>
    <div class="empty-sub">${escapeHtml(sub)}</div>
  </div>`;
}

// ═══════════════════════════════════════════════════════════
// VERKAUFSSTATISTIK · Echte Diagramme aus echten Shopify-Daten
// ═══════════════════════════════════════════════════════════
function renderStatsSection(stats) {
  const s = stats.summary;
  return `
    <div class="vital-card glass fade-up" style="margin-bottom:14px">
      <div class="vital-metrics" style="flex-wrap:wrap;gap:18px">
        <div><div class="vital-metric-num">${s.totalRevenue.toFixed(0)} €</div><div class="vital-metric-label">Umsatz (bezahlt)</div></div>
        <div><div class="vital-metric-num">${s.orderCount}</div><div class="vital-metric-label">Bestellungen</div></div>
        <div><div class="vital-metric-num">${s.avgOrderValue.toFixed(0)} €</div><div class="vital-metric-label">Ø Bestellwert</div></div>
        ${s.lowStockCount > 0 ? `<div><div class="vital-metric-num" style="color:var(--signal-amber)">${s.lowStockCount}</div><div class="vital-metric-label">Niedriger Bestand</div></div>` : ''}
      </div>
    </div>

    <div class="section-h">Umsatz · letzte 30 Tage</div>
    <div class="glass" style="padding:16px 12px">
      <canvas id="revenueChart" style="width:100%;height:140px;display:block"></canvas>
    </div>

    <div class="section-h">Meistverkaufte Produkte (nach Lagerwert)</div>
    <div class="glass" style="padding:16px 12px">
      <canvas id="topProductsChart" style="width:100%;height:160px;display:block"></canvas>
    </div>
  `;
}

function drawRevenueChart(revenueByDay) {
  const canvas = document.getElementById('revenueChart');
  if (!canvas) return;

  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const w = rect.width, h = rect.height;
  const padding = { top: 10, right: 8, bottom: 8, left: 8 };

  if (!revenueByDay || revenueByDay.length === 0) {
    ctx.fillStyle = 'rgba(255,255,255,.4)';
    ctx.font = '12px -apple-system';
    ctx.fillText('Noch keine Daten — Bestellungen syncen', padding.left, h / 2);
    return;
  }

  const maxRevenue = Math.max(...revenueByDay.map(d => d.revenue), 1);
  const chartW = w - padding.left - padding.right;
  const chartH = h - padding.top - padding.bottom;
  const stepX = revenueByDay.length > 1 ? chartW / (revenueByDay.length - 1) : 0;

  const points = revenueByDay.map((d, i) => ({
    x: padding.left + i * stepX,
    y: padding.top + chartH - (d.revenue / maxRevenue) * chartH,
  }));

  const grad = ctx.createLinearGradient(0, padding.top, 0, h);
  grad.addColorStop(0, 'rgba(255,159,10,.25)');
  grad.addColorStop(1, 'rgba(255,159,10,0)');
  ctx.beginPath();
  ctx.moveTo(points[0].x, h - padding.bottom);
  points.forEach(p => ctx.lineTo(p.x, p.y));
  ctx.lineTo(points[points.length - 1].x, h - padding.bottom);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.beginPath();
  points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
  ctx.strokeStyle = '#ff9f0a';
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.stroke();

  const last = points[points.length - 1];
  ctx.beginPath();
  ctx.arc(last.x, last.y, 3.5, 0, Math.PI * 2);
  ctx.fillStyle = '#ff9f0a';
  ctx.fill();
}

function drawTopProductsChart(topProducts) {
  const canvas = document.getElementById('topProductsChart');
  if (!canvas) return;

  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const w = rect.width, h = rect.height;

  if (!topProducts || topProducts.length === 0) {
    ctx.fillStyle = 'rgba(255,255,255,.4)';
    ctx.font = '12px -apple-system';
    ctx.fillText('Noch keine Daten — Produkte syncen', 8, h / 2);
    return;
  }

  const items = topProducts.slice(0, 5);
  const maxValue = Math.max(...items.map(p => p.stockValue), 1);
  const barHeight = Math.min(22, (h - 8) / items.length - 8);
  const gap = (h - barHeight * items.length) / (items.length + 1);
  const labelWidth = 86;
  const barAreaWidth = w - labelWidth - 50;

  ctx.font = '11px -apple-system';
  items.forEach((p, i) => {
    const y = gap + i * (barHeight + gap);
    const barW = Math.max(2, (p.stockValue / maxValue) * barAreaWidth);

    ctx.fillStyle = 'rgba(245,245,247,.85)';
    ctx.textBaseline = 'middle';
    const shortTitle = p.title.length > 14 ? p.title.slice(0, 13) + '…' : p.title;
    ctx.fillText(shortTitle, 0, y + barHeight / 2);

    ctx.fillStyle = '#0a84ff';
    const radius = Math.min(6, barHeight / 2);
    ctx.beginPath();
    ctx.roundRect(labelWidth, y, barW, barHeight, radius);
    ctx.fill();

    ctx.fillStyle = 'rgba(245,245,247,.6)';
    ctx.fillText(`${p.stockValue.toFixed(0)}€`, labelWidth + barW + 6, y + barHeight / 2);
  });
}

// ═══════════════════════════════════════════════════════════
// MARGENRECHNER · echte Gewinnspanne pro Produkt
// ═══════════════════════════════════════════════════════════
// Einkaufspreise kommen nicht von Shopify - du trägst sie hier
// einmalig pro Produkt ein, danach rechnet die App automatisch.
function renderMarginSection(margins, lowMargins) {
  const withCost = margins.filter(m => m.hasCostPrice);

  const warningHtml = lowMargins.length > 0 ? `
    <div class="glass" style="margin-bottom:10px; padding:12px; border:1px solid rgba(255,69,58,.3)">
      <div style="font-size:13px; color:var(--danger); font-weight:600">⚠ ${lowMargins.length} Produkt${lowMargins.length > 1 ? 'e' : ''} mit knapper Marge (unter 10%)</div>
      <div style="font-size:12px; color:var(--ink-dim); margin-top:2px">${lowMargins.map(m => escapeHtml(m.title)).join(', ')}</div>
    </div>` : '';

  return `
    <div class="section-h">Margenrechner (${withCost.length}/${margins.length} Produkte erfasst)</div>
    ${warningHtml}
    <div class="glass" style="margin-bottom:10px; padding:12px">
      <button class="btn btn-glass btn-full" id="pdfReportBtn">📄 Gewinn-Report als PDF</button>
    </div>
    <div class="glass" style="margin-bottom:14px" id="marginsList">
      ${margins.map(m => `
        <div class="row">
          <div class="row-icon">${m.hasCostPrice ? (m.marginPercent < 10 ? '⚠' : '€') : '○'}</div>
          <div class="row-text">
            <div class="row-title">${escapeHtml(m.title)}</div>
            <div class="row-sub">
              ${m.price != null ? `Verkauf: ${m.price.toFixed(2)}€` : 'kein Preis'}
              ${m.hasCostPrice
                ? ` · Gewinn: ${m.profitPerUnit.toFixed(2)}€ (${m.marginPercent}%)`
                : ' · Einkaufspreis fehlt'}
            </div>
          </div>
          <button class="btn btn-glass" style="padding:8px 12px;font-size:12px" data-edit-cost="${escapeHtml(m.shopifyId)}" data-title="${escapeHtml(m.title)}" data-current-cost="${m.costPrice ?? ''}">
            ${m.hasCostPrice ? 'Ändern' : 'Eintragen'}
          </button>
        </div>`).join('')}
    </div>
  `;
}

function wireMarginEditButtons() {
  document.querySelectorAll('[data-edit-cost]').forEach(btn => {
    btn.onclick = () => openCostPriceSheet(btn.dataset.editCost, btn.dataset.title, btn.dataset.currentCost);
  });

  const pdfBtn = document.getElementById('pdfReportBtn');
  if (pdfBtn) pdfBtn.onclick = openPdfReportRangeSheet;
}

// Liefert Start/Ende für gängige Zeiträume. Alles als lokale
// Kalendertage berechnet (kein UTC-Versatz), damit "dieses Jahr"
// wirklich am 1. Januar deiner Zeitzone beginnt.
function getDateRangePreset(preset) {
  const today = new Date();
  const fmt = (d) => d.toISOString().slice(0, 10);

  if (preset === 'last_month') {
    const firstOfThisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastMonthEnd = new Date(firstOfThisMonth - 1);
    const lastMonthStart = new Date(lastMonthEnd.getFullYear(), lastMonthEnd.getMonth(), 1);
    return { from: fmt(lastMonthStart), to: fmt(lastMonthEnd) };
  }
  if (preset === 'this_month') {
    return { from: fmt(new Date(today.getFullYear(), today.getMonth(), 1)), to: fmt(today) };
  }
  if (preset === 'this_quarter') {
    const quarterStartMonth = Math.floor(today.getMonth() / 3) * 3;
    return { from: fmt(new Date(today.getFullYear(), quarterStartMonth, 1)), to: fmt(today) };
  }
  if (preset === 'this_year') {
    return { from: fmt(new Date(today.getFullYear(), 0, 1)), to: fmt(today) };
  }
  if (preset === 'last_year') {
    return { from: fmt(new Date(today.getFullYear() - 1, 0, 1)), to: fmt(new Date(today.getFullYear() - 1, 11, 31)) };
  }
  return null;
}

function openPdfReportRangeSheet() {
  const todayStr = new Date().toISOString().slice(0, 10);
  openSheet(`
    <div class="sheet-title">Gewinn-Report als PDF</div>
    <div class="sheet-sub">Wähle einen Zeitraum für deinen Report.</div>
    <div class="field" style="margin-bottom:14px">
      <select class="input" id="pdfRangePreset" style="appearance:none">
        <option value="last_month">Letzter Monat</option>
        <option value="this_month">Dieser Monat (bis heute)</option>
        <option value="this_quarter">Dieses Quartal (bis heute)</option>
        <option value="this_year">Dieses Jahr (bis heute)</option>
        <option value="last_year">Letztes Jahr (komplett)</option>
        <option value="custom">Eigener Zeitraum…</option>
      </select>
    </div>
    <div id="pdfCustomRangeFields" style="display:none">
      <div class="field"><label class="field-label">Von</label><input class="input" id="pdfFromDate" type="date" max="${todayStr}"></div>
      <div class="field" style="margin-bottom:18px"><label class="field-label">Bis</label><input class="input" id="pdfToDate" type="date" max="${todayStr}"></div>
    </div>
    <button class="btn btn-primary btn-full" id="pdfGenerateBtn" style="margin-top:6px">PDF erstellen</button>
  `);

  const presetSelect = document.getElementById('pdfRangePreset');
  const customFields = document.getElementById('pdfCustomRangeFields');
  presetSelect.onchange = () => {
    customFields.style.display = presetSelect.value === 'custom' ? 'block' : 'none';
  };

  document.getElementById('pdfGenerateBtn').onclick = async () => {
    const preset = presetSelect.value;
    let range;
    if (preset === 'custom') {
      const from = document.getElementById('pdfFromDate').value;
      const to = document.getElementById('pdfToDate').value;
      if (!from || !to) { toast('Zeitraum fehlt', 'Bitte beide Daten auswählen.', 'error'); return; }
      if (from > to) { toast('Ungültiger Zeitraum', '"Von" muss vor "Bis" liegen.', 'error'); return; }
      range = { from, to };
    } else {
      range = getDateRangePreset(preset);
    }

    const btn = document.getElementById('pdfGenerateBtn');
    await downloadProfitReportPdf(btn, range);
  };
}

// Lädt den PDF-Gewinn-Report für den gewählten Zeitraum herunter.
// Wie beim Backup-Download: braucht den Auth-Header, also per fetch
// + Blob statt direktem <a href>.
async function downloadProfitReportPdf(btn, { from, to }) {
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner"></div>';

  try {
    const res = await fetch(`${API_BASE}/stats/profit-report.pdf?from=${from}&to=${to}`, {
      headers: { Authorization: `Bearer ${state.token}` },
    });
    if (!res.ok) throw new Error('PDF konnte nicht erstellt werden.');

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gewinn-report-${from}-bis-${to}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    closeSheet();
    toast('PDF erstellt', '', 'success');
  } catch (err) {
    toast('Fehlgeschlagen', err.message, 'error');
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

function openCostPriceSheet(shopifyId, title, currentCost) {
  openSheet(`
    <div class="sheet-title">Einkaufspreis: ${escapeHtml(title)}</div>
    <div class="sheet-sub">Was kostet dich dieses Produkt pro Stück im Einkauf (inkl. Versand an dich, falls relevant)? Daraus berechnet die App automatisch deine echte Gewinnspanne.</div>
    <div class="field" style="margin-bottom:18px">
      <label class="field-label">Einkaufspreis (€)</label>
      <input class="input" id="costPriceInput" type="number" min="0" step="0.01" value="${escapeHtml(currentCost)}" placeholder="z.B. 8.50">
    </div>
    <button class="btn btn-primary btn-full" id="costPriceSaveBtn">Speichern</button>
  `);

  document.getElementById('costPriceSaveBtn').onclick = async () => {
    const value = document.getElementById('costPriceInput').value.trim();
    const btn = document.getElementById('costPriceSaveBtn');
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div>';
    try {
      await api(`/stats/margins/${encodeURIComponent(shopifyId)}/cost-price`, {
        method: 'PUT',
        body: { costPrice: value === '' ? null : value },
      });
      closeSheet();
      toast('Gespeichert', '', 'success');
      navigateTo('shopify');
    } catch (err) {
      toast('Speichern fehlgeschlagen', err.message, 'error');
      btn.disabled = false;
      btn.textContent = 'Speichern';
    }
  };
}
