// ═══════════════════════════════════════════════════════════
// KI-VIEW
// ═══════════════════════════════════════════════════════════
async function renderAi(view) {
  const [aiStatus, higgsfieldStatus, history] = await Promise.all([
    api('/ai/status').catch(() => ({ configured: false })),
    api('/higgsfield/status').catch(() => ({ configured: false })),
    api('/ai/history').catch(() => []),
  ]);
  state.aiConfigured = aiStatus.configured;
  state.higgsfieldConfigured = higgsfieldStatus.configured;

  if (!state.aiConfigured && !state.higgsfieldConfigured) {
    view.innerHTML = notConfiguredCard(
      'KI ist noch nicht verbunden',
      'Trage ANTHROPIC_API_KEY (Texte) und/oder HIGGSFIELD_KEY_ID + HIGGSFIELD_KEY_SECRET (Videos) in die .env-Datei des Backends ein.'
    );
    return;
  }

  view.innerHTML = `
    ${!state.aiConfigured ? '' : `
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
    <div class="card glass" id="genTrendsCard" style="margin-bottom:14px">
      <span class="card-icon">📈</span>
      <div class="card-title">Trend-Recherche</div>
      <div class="card-sub">Echte Websuche: was ist aktuell gefragt? Mit Quellenangaben</div>
    </div>`}

    ${!state.higgsfieldConfigured ? `
    <div class="empty glass" style="margin-bottom:14px">
      <div class="empty-icon">▶</div>
      <div class="empty-title">Marketing-Video noch nicht verbunden</div>
      <div class="empty-sub">Trage HIGGSFIELD_KEY_ID und HIGGSFIELD_KEY_SECRET in .env ein, um aus Produktbildern echte Marketing-Videos zu generieren.</div>
    </div>` : `
    <div class="card glass" id="genVideoCard" style="margin-bottom:14px">
      <span class="card-icon">▶</span>
      <div class="card-title">Marketing-Video aus Produktbild</div>
      <div class="card-sub">Echtes KI-Video via Higgsfield — landet als Entwurf, du gibst frei</div>
    </div>`}

    <div class="section-h">Verlauf (${history.length})</div>
    <div class="glass" id="historyList"></div>
  `;

  renderAiHistory(history);

  if (state.aiConfigured) {
    document.getElementById('genDescCard').onclick = openDescriptionSheet;
    document.getElementById('genCaptionCard').onclick = openCaptionSheet;
    document.getElementById('genAnalysisCard').onclick = runSalesAnalysis;
    document.getElementById('genTrendsCard').onclick = openTrendResearchSheet;
  }
  if (state.higgsfieldConfigured) {
    document.getElementById('genVideoCard').onclick = openVideoGenerationSheet;
  }
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
  return {
    product_description: 'Produktbeschreibung',
    caption: 'Social-Caption',
    sales_analysis: 'Verkaufsanalyse',
    trend_research: 'Trend-Recherche',
  }[kind] || kind;
}

function showGenerationDetail(item) {
  const sourcesHtml = (item.sources && item.sources.length > 0)
    ? `<div style="margin-bottom:16px">
        <div style="font-size:11px;color:var(--ink-dim);font-weight:600;margin-bottom:6px;text-transform:uppercase;letter-spacing:.04em">Quellen</div>
        ${item.sources.map(url => `<a href="${escapeHtml(url)}" target="_blank" style="display:block;font-size:11.5px;color:var(--depth-blue);margin-bottom:4px;word-break:break-all">${escapeHtml(url)}</a>`).join('')}
      </div>`
    : '';

  openSheet(`
    <div class="sheet-title">${escapeHtml(kindLabel(item.kind))}</div>
    <div class="sheet-sub">${item.approved ? 'Bereits freigegeben' : 'Noch nicht freigegeben'}</div>
    <div class="glass" style="padding:16px;margin-bottom:16px;font-size:13.5px;line-height:1.6;white-space:pre-wrap">${escapeHtml(item.output)}</div>
    ${sourcesHtml}
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

// ═══════════════════════════════════════════════════════════
// TREND-RECHERCHE · Echte Websuche über Claude
// ═══════════════════════════════════════════════════════════
function openTrendResearchSheet() {
  openSheet(`
    <div class="sheet-title">Trend-Recherche</div>
    <div class="sheet-sub">Echte Websuche über Claude — findet aktuelle Produkttrends, mit Quellen zum Nachprüfen. Kostet zusätzlich zu Text-Tokens auch pro Suche.</div>
    <div class="field">
      <label class="field-label">Nische (optional)</label>
      <input class="input" id="trendNiche" placeholder="z.B. Fitness, Haustierzubehör, Beauty...">
    </div>
    <div class="field" style="margin-bottom:18px">
      <label class="field-label">Region</label>
      <input class="input" id="trendRegion" value="Deutschland">
    </div>
    <button class="btn btn-primary btn-full" id="trendGenBtn">Recherche starten</button>
    <div style="font-size:11px;color:var(--ink-dim);margin-top:10px;text-align:center">Hinweis: Websuche muss zusätzlich in deiner Anthropic Console aktiviert sein.</div>
  `);

  document.getElementById('trendGenBtn').onclick = async () => {
    const niche = document.getElementById('trendNiche').value.trim();
    const region = document.getElementById('trendRegion').value.trim() || 'Deutschland';

    const btn = document.getElementById('trendGenBtn');
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div> Recherchiert…';

    await withActivity(async () => {
      try {
        const result = await api('/ai/research-trends', { method: 'POST', body: { niche, region } });
        closeSheet();
        toast('Recherche fertig', '', 'success');
        navigateTo('ai');
        setTimeout(() => showGenerationDetail({
          kind: 'trend_research',
          output: result.text,
          sources: result.sources,
          approved: false,
          id: null,
        }), 200);
      } catch (err) {
        toast('Recherche fehlgeschlagen', err.message, 'error');
        btn.disabled = false;
        btn.textContent = 'Recherche starten';
      }
    });
  };
}

// ═══════════════════════════════════════════════════════════
// HIGGSFIELD · Marketing-Video aus echtem Shopify-Produktbild
// ═══════════════════════════════════════════════════════════
function extractFirstImageUrl(product) {
  try {
    const raw = JSON.parse(product.raw_json || '{}');
    return raw.images?.[0]?.src || raw.image?.src || null;
  } catch {
    return null;
  }
}

async function openVideoGenerationSheet() {
  const products = await api('/shopify/products').catch(() => []);
  const withImages = products.map(p => ({ ...p, imageUrl: extractFirstImageUrl(p) })).filter(p => p.imageUrl);

  if (withImages.length === 0) {
    openSheet(`
      <div class="sheet-title">Kein Produktbild gefunden</div>
      <div class="sheet-sub">Synce zuerst deine Shopify-Produkte (Tab "Shopify" → "Produkte syncen"). Higgsfield braucht ein echtes Produktbild als Ausgangspunkt.</div>
      <button class="btn btn-glass btn-full" onclick="closeSheet()">Verstanden</button>`);
    return;
  }

  openSheet(`
    <div class="sheet-title">Marketing-Video generieren</div>
    <div class="sheet-sub">Wählt ein Produkt mit Bild — Higgsfield erzeugt daraus ein kurzes Marketing-Video. Landet als Entwurf, du gibst später frei.</div>
    <div class="field">
      <label class="field-label">Produkt</label>
      <select class="input" id="videoProductSelect" style="appearance:none">
        ${withImages.map(p => `<option value="${p.shopify_id}">${escapeHtml(p.title)}</option>`).join('')}
      </select>
    </div>
    <div class="field">
      <label class="field-label">Plattform für den Entwurf</label>
      <select class="input" id="videoPlatformSelect"><option value="instagram">Instagram</option></select>
    </div>
    <div class="field" style="margin-bottom:18px">
      <label class="field-label">Zusätzliche Anweisung (optional)</label>
      <textarea class="input" id="videoPrompt" placeholder="z.B. warmes Licht, langsamer Zoom..."></textarea>
    </div>
    <button class="btn btn-primary btn-full" id="videoGenBtn">Video generieren</button>
    <div style="font-size:11px;color:var(--ink-dim);margin-top:10px;text-align:center">Verbraucht Higgsfield-Guthaben. Kann 1–3 Minuten dauern.</div>
  `);

  document.getElementById('videoGenBtn').onclick = async () => {
    const shopifyId = document.getElementById('videoProductSelect').value;
    const product = withImages.find(p => p.shopify_id === shopifyId);
    const platform = document.getElementById('videoPlatformSelect').value;
    const prompt = document.getElementById('videoPrompt').value.trim();

    const btn = document.getElementById('videoGenBtn');
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div> Generiert… (kann etwas dauern)';

    await withActivity(async () => {
      try {
        const result = await api('/higgsfield/generate-video', {
          method: 'POST',
          body: { product
