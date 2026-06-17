// ═══════════════════════════════════════════════════════════
// SHOPIFY-VIEW
// ═══════════════════════════════════════════════════════════
async function renderShopify(view) {
  if (!state.shopifyConfigured) {
    view.innerHTML = notConfiguredCard(
      'Shopify ist noch nicht verbunden',
      'Trage SHOPIFY_STORE_DOMAIN und SHOPIFY_ADMIN_ACCESS_TOKEN in die .env-Datei des Backends ein. Anleitung steht in der README.'
    );
    return;
  }

  const [products, orders] = await Promise.all([
    api('/shopify/products').catch(() => []),
    api('/shopify/orders').catch(() => []),
  ]);

  view.innerHTML = `
    <div class="grid2">
      <button class="btn btn-glass btn-full" id="syncProductsBtn">↻ Produkte syncen</button>
      <button class="btn btn-glass btn-full" id="syncOrdersBtn">↻ Bestellungen syncen</button>
    </div>

    <div class="section-h">Produkte (${products.length})</div>
    <div class="glass" id="productsList"></div>

    <div class="section-h">Bestellungen (${orders.length})</div>
    <div class="glass" id="ordersList"></div>
  `;

  renderProductsList(products);
  renderOrdersList(orders);

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
