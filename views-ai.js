// ═══════════════════════════════════════════════════════════
// KI-VIEW
// ═══════════════════════════════════════════════════════════
async function renderAi(view) {
  if (!state.aiConfigured) {
    view.innerHTML = notConfiguredCard(
      'KI ist noch nicht verbunden',
      'Trage ANTHROPIC_API_KEY in die .env-Datei des Backends ein. Holen unter console.anthropic.com → API Keys.'
    );
    return;
  }

  const history = await api('/ai/history').catch(() => []);

  view.innerHTML = `
    <div class="grid2">
      <div class="card glass" id="genDescCard">
        <span class="card-icon">◫</span>
        <div class="card-title">Produktbeschreibung</div>
        <div class="card-sub">Echter Claude-Text für ein Produkt</div>
      </div>
      <div class="card glass" id="genCaptionCard">
        <span class="card-icon">◈</span>
        <div class="card-title">Social-Caption</div>
        <div class="card-sub">Mit Hashtags, für eine Plattform</div>
      </div>
    </div>
    <div class="card glass" id="genAnalysisCard" style="margin-bottom:14px">
      <span class="card-icon">◉</span>
      <div class="card-title">Verkaufsanalyse</div>
      <div class="card-sub">KI analysiert deine echten Shopify-Daten und gibt konkrete nächste Schritte</div>
    </div>

    <div class="section-h">Verlauf (${history.length})</div>
    <div class="glass" id="historyList"></div>
  `;

  renderAiHistory(history);

  document.getElementById('genDescCard').onclick = openDescriptionSheet;
  document.getElementById('genCaptionCard').onclick = openCaptionSheet;
  document.getElementById('genAnalysisCard').onclick = runSalesAnalysis;
}

function renderAiHistory(history) {
  const el = document.getElementById('historyList');
  if (history.length === 0) {
    el.innerHTML = emptyState('✦', 'Noch nichts generiert', 'Probier eine der Funktionen oben aus — die KI antwortet wirklich, kein Demo-Text.');
    return;
  }
  el.innerHTML = history.map(h => `
    <div class="row" style="cursor:pointer" data-history-id="${h.id}">
      <div class="row-icon">${h.approved ? '✓' : '✦'}</div>
      <div class="row-text">
        <div class="row-title">${escapeHtml(kindLabel(h.kind))}</div>
        <div class="row-sub">${escapeHtml((h.output || '').slice(0, 50))}…</div>
      </div>
    </div>`).join('');

  el.querySelectorAll('[data-history-id]').forEach(row => {
    row.onclick = () => {
      const item = history.find(h => h.id === Number(row.dataset.historyId));
      showGenerationDetail(item);
    };
  });
}

function kindLabel(kind) {
  return { product_description: 'Produktbeschreibung', caption: 'Social-Caption', sales_analysis: 'Verkaufsanalyse' }[kind] || kind;
}

function showGenerationDetail(item) {
  openSheet(`
    <div class="sheet-title">${escapeHtml(kindLabel(item.kind))}</div>
    <div class="sheet-sub">${item.approved ? 'Bereits freigegeben' : 'Noch nicht freigegeben'}</div>
    <div class="glass" style="padding:16px;margin-bottom:16px;font-size:13.5px;line-height:1.6;white-space:pre-wrap">${escapeHtml(item.output)}</div>
    ${!item.approved ? `<button class="btn btn-primary btn-full" id="approveBtn">Als final markieren</button>` : ''}
  `);
  if (!item.approved) {
    document.getElementById('approveBtn').onclick = async () => {
      await api(`/ai/${item.id}/approve`, { method: 'POST' });
      closeSheet();
      toast('Freigegeben', '', 'success');
      navigateTo('ai');
    };
  }
}

function openDescriptionSheet() {
  openSheet(`
    <div class="sheet-title">Produktbeschreibung generieren</div>
    <div class="sheet-sub">Echter Claude-Aufruf — kostet eine kleine Menge deines API-Guthabens.</div>
    <div class="field"><label class="field-label">Produktname</label><input class="input" id="pdTitle" placeholder="z.B. Premium Sneaker XR"></div>
    <div class="field" style="margin-bottom:18px"><label class="field-label">Eigenschaften</label><textarea class="input" id="pdFeatures" placeholder="z.B. atmungsaktiv, vegan, handgefertigt"></textarea></div>
    <button class="btn btn-primary btn-full" id="pdGenBtn">Generieren</button>
  `);
  document.getElementById('pdGenBtn').onclick = async () => {
    const title = document.getElementById('pdTitle').value.trim();
    const features = document.getElementById('pdFeatures').value.trim();
    if (!title) { toast('Produktname fehlt', '', 'error'); return; }

    const btn = document.getElementById('pdGenBtn');
    btn.disabled = true; btn.innerHTML = '<div class="spinner"></div>';

    await withActivity(async () => {
      try {
        const { text } = await api('/ai/product-description', { method: 'POST', body: { title, features } });
        closeSheet();
        toast('Text erstellt', '', 'success');
        navigateTo('ai');
        setTimeout(() => showGenerationDetail({ kind: 'product_description', output: text, approved: false, id: null }), 200);
      } catch (err) {
        toast('Fehlgeschlagen', err.message, 'error');
        btn.disabled = false; btn.textContent = 'Generieren';
      }
    });
  };
}

function openCaptionSheet() {
  openSheet(`
    <div class="sheet-title">Social-Caption generieren</div>
    <div class="field"><label class="field-label">Plattform</label>
      <select class="input" id="capPlatform"><option value="instagram">Instagram</option><option value="pinterest">Pinterest</option><option value="tiktok">TikTok</option></select>
    </div>
    <div class="field" style="margin-bottom:18px"><label class="field-label">Produktname</label><input class="input" id="capTitle" placeholder="z.B. Premium Sneaker XR"></div>
    <button class="btn btn-primary btn-full" id="capGenBtn">Generieren</button>
  `);
  document.getElementById('capGenBtn').onclick = async () => {
    const platform = document.getElementById('capPlatform').value;
    const productTitle = document.getElementById('capTitle').value.trim();
    if (!productTitle) { toast('Produktname fehlt', '', 'error'); return; }

    const btn = document.getElementById('capGenBtn');
    btn.disabled = true; btn.innerHTML = '<div class="spinner"></div>';

    await withActivity(async () => {
      try {
        const { text } = await api('/ai/caption', { method: 'POST', body: { platform, productTitle } });
        closeSheet();
        toast('Caption erstellt', '', 'success');
        navigateTo('ai');
        setTimeout(() => showGenerationDetail({ kind: 'caption', output: text, approved: false, id: null }), 200);
      } catch (err) {
        toast('Fehlgeschlagen', err.message, 'error');
        btn.disabled = false; btn.textContent = 'Generieren';
      }
    });
  };
}

async function runSalesAnalysis() {
  await withActivity(async () => {
    try {
      const [products, orders] = await Promise.all([
        api('/shopify/products').catch(() => []),
        api('/shopify/orders').catch(() => []),
      ]);
      const productsSummary = products.slice(0, 20).map(p => `${p.title}: ${p.price}€, Bestand ${p.inventory_qty}`).join('\n') || 'Keine Produktdaten vorhanden.';
      const ordersSummary = orders.slice(0, 20).map(o => `#${o.order_number}: ${o.total_price}€, ${o.financial_status}`).join('\n') || 'Keine Bestelldaten vorhanden.';

      const { text } = await api('/ai/analyze-sales', { method: 'POST', body: { productsSummary, ordersSummary } });
      showGenerationDetail({ kind: 'sales_analysis', output: text, approved: false, id: null });
      navigateTo('ai');
    } catch (err) {
      toast('Analyse fehlgeschlagen', err.message, 'error');
    }
  });
}
