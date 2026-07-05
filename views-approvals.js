// ═══════════════════════════════════════════════════════════
// FREIGABE-CENTER · ein Posteingang für alles, was auf dich wartet
// ═══════════════════════════════════════════════════════════
// Bündelt an EINER Stelle alles, was deine ausdrückliche Bestätigung
// braucht: KI- und manuelle Post-Entwürfe, fehlgeschlagene Beiträge,
// kritische Lagerbestände und offene Kampagnen-Ideen. Nichts geht hier
// automatisch live - jede echte Aktion nutzt dieselben geprüften
// Endpunkte (und denselben "Wirklich?"-Dialog) wie der Social-Tab.

async function renderApprovals(view) {
  // Freigaben + Autopilot-Status parallel laden. Der Autopilot-Status
  // darf fehlschlagen, ohne den ganzen Tab zu blockieren.
  const [data, auto] = await Promise.all([
    api('/approvals/pending'),
    api('/autopilot/status').catch(() => null),
  ]);
  const postDrafts = data.postDrafts || [];
  const failedPosts = data.failedPosts || [];
  const lowStock = data.lowStock || [];
  const seasonalIdeas = data.seasonalIdeas || [];
  const priceSuggestions = data.priceSuggestions || [];
  const storefrontSuggestions = data.storefrontSuggestions || [];

  const actionable = postDrafts.length + failedPosts.length;
  const totalWaiting = actionable + lowStock.length + priceSuggestions.length + storefrontSuggestions.length;

  // ── Autopilot: dein Tagesplan-Kopf ──
  // Bereitet die Vorschläge des Tages vor. Postet/ändert NICHTS von
  // selbst - alles landet als Entwurf/Chance in den Abschnitten darunter
  // und wartet auf deine Freigabe.
  const autopilotHtml = auto ? `
    <div class="glass fade-up" style="padding:16px;margin-bottom:14px">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:4px">
        <div>
          <div class="vital-label">Autopilot</div>
          <div style="font-weight:600;font-size:15px;margin-top:2px">${auto.ranToday ? 'Dein Plan für heute steht.' : 'Plan für heute erstellen'}</div>
        </div>
        <span class="badge badge-${auto.enabled ? (auto.ranToday ? 'gray' : 'amber') : 'gray'}">${auto.enabled ? (auto.ranToday ? 'Aktuell' : 'Bereit') : 'Aus'}</span>
      </div>
      <div class="row-sub" style="margin-bottom:12px">
        ${auto.aiConfigured
          ? 'Claude schreibt die Entwürfe, du gibst sie frei.'
          : 'Entwürfe entstehen aus Vorlagen. Sobald dein KI-Key hinterlegt ist, schreibt Claude sie – ohne dass sich am Ablauf etwas ändert.'}
      </div>
      <button class="btn btn-primary btn-full" id="runAutopilotBtn" style="font-size:13px">${auto.ranToday ? 'Plan aktualisieren' : 'Tagesplan jetzt erstellen'}</button>
    </div>` : '';

  // ── Kopf: eine ehrliche Gesamtaussage ──
  const headerHtml = totalWaiting === 0
    ? `<div class="glass fade-up" style="padding:22px;text-align:center;margin-bottom:14px">
         <div style="font-size:30px;margin-bottom:6px">✓</div>
         <div style="font-weight:600;font-size:15px">Nichts zu tun</div>
         <div class="row-sub" style="margin-top:5px">Kein Entwurf, kein Fehler, kein kritischer Bestand. Du bist auf dem Laufenden.</div>
       </div>`
    : `<div class="vital-card glass fade-up" style="margin-bottom:14px">
         <div class="vital-top">
           <div>
             <div class="vital-label">Freigabe-Center</div>
             <div class="vital-headline">${totalWaiting} ${totalWaiting === 1 ? 'Sache wartet' : 'Dinge warten'} auf dich.</div>
           </div>
           <span class="badge badge-${failedPosts.length > 0 || lowStock.some(p => p.urgency === 'ausverkauft') ? 'red' : 'amber'}">Wartet auf dich</span>
         </div>
         <div class="vital-metrics">
           <div><div class="vital-metric-num">${postDrafts.length}</div><div class="vital-metric-label">Entwürfe</div></div>
           <div><div class="vital-metric-num">${failedPosts.length}</div><div class="vital-metric-label">Fehlgeschlagen</div></div>
           <div><div class="vital-metric-num">${lowStock.length}</div><div class="vital-metric-label">Bestand</div></div>
         </div>
       </div>`;

  // ── Beiträge zur Freigabe (Entwürfe) ──
  const draftsHtml = postDrafts.length ? `
    <div class="section-h">Beiträge zur Freigabe</div>
    <div class="glass" style="margin-bottom:14px">
      ${postDrafts.map(p => {
        const meta = (typeof PLATFORM_META !== 'undefined' && PLATFORM_META[p.platform]) || { icon: '○', label: p.platform, live: false };
        return `
        <div class="row">
          <div class="row-icon">${meta.icon}</div>
          <div class="row-text">
            <div class="row-title">${escapeHtml((p.caption || 'Ohne Text').slice(0, 42))}${p.created_by_ai ? ' <span style="opacity:.5">✦KI</span>' : ''}</div>
            <div class="row-sub">${escapeHtml(meta.label)} · ${formatRelativeTime(p.created_at)}</div>
          </div>
          <div style="display:flex;gap:6px;flex-shrink:0">
            ${meta.live
              ? `<button class="btn btn-primary" style="padding:8px 11px;font-size:12px" data-approve="${p.id}" data-label="${escapeHtml(meta.label)}">Freigeben</button>`
              : `<span class="badge badge-gray">Review offen</span>`}
            <button class="btn btn-glass" style="padding:8px 11px;font-size:12px" data-discard="${p.id}">Verwerfen</button>
          </div>
        </div>`;
      }).join('')}
    </div>` : '';

  // ── Fehlgeschlagene Beiträge ──
  const failedHtml = failedPosts.length ? `
    <div class="section-h">Fehlgeschlagene Beiträge</div>
    <div class="glass" style="margin-bottom:14px">
      ${failedPosts.map(p => {
        const meta = (typeof PLATFORM_META !== 'undefined' && PLATFORM_META[p.platform]) || { icon: '○', label: p.platform, live: false };
        return `
        <div class="row">
          <div class="row-icon" style="color:var(--danger)">⚠</div>
          <div class="row-text">
            <div class="row-title">${escapeHtml((p.caption || 'Ohne Text').slice(0, 42))}</div>
            <div class="row-sub">${escapeHtml((p.error_message || 'Unbekannter Fehler').slice(0, 64))}</div>
          </div>
          <div style="display:flex;gap:6px;flex-shrink:0">
            ${meta.live ? `<button class="btn btn-glass" style="padding:8px 11px;font-size:12px" data-approve="${p.id}" data-label="${escapeHtml(meta.label)}">Erneut</button>` : ''}
            <button class="btn btn-glass" style="padding:8px 11px;font-size:12px" data-discard="${p.id}">Löschen</button>
          </div>
        </div>`;
      }).join('')}
    </div>` : '';

  // ── Lagerbestand (informativ) ──
  const lowStockHtml = lowStock.length ? `
    <div class="section-h">Lagerbestand</div>
    <div class="glass" style="margin-bottom:14px">
      ${lowStock.map(p => `
        <div class="row">
          <div class="row-icon" style="color:${p.urgency === 'ausverkauft' ? 'var(--danger)' : p.urgency === 'kritisch' ? 'var(--signal-amber)' : 'var(--ink-dim)'}">${p.urgency === 'ausverkauft' ? '✕' : '⚠'}</div>
          <div class="row-text">
            <div class="row-title">${escapeHtml(p.title)}</div>
            <div class="row-sub">${p.urgency === 'ausverkauft' ? 'Ausverkauft' : `Noch ${p.inventoryQty} auf Lager`}${p.price != null ? ' · ' + p.price.toFixed(2) + ' €' : ''}</div>
          </div>
          <span class="badge badge-${p.urgency === 'ausverkauft' ? 'red' : p.urgency === 'kritisch' ? 'amber' : 'gray'}">${escapeHtml(p.urgency)}</span>
        </div>`).join('')}
      <div style="padding:12px 14px 4px"><button class="btn btn-glass btn-full" id="goShopifyBtn" style="font-size:12.5px">In Shopify ansehen</button></div>
    </div>` : '';

  // ── Preis-Optimierung (Vorschlag → Übernahme mit Bestätigung) ──
  const priceHtml = priceSuggestions.length ? `
    <div class="section-h">Preis-Optimierung</div>
    <div class="glass" style="margin-bottom:14px">
      ${priceSuggestions.map(s => `
        <div class="row">
          <div class="row-icon" style="color:var(--signal-amber)">€</div>
          <div class="row-text">
            <div class="row-title">${escapeHtml(s.title)}</div>
            <div class="row-sub">${s.currentPrice.toFixed(2)}€ → <b style="color:var(--ink)">${s.suggestedPrice.toFixed(2)}€</b> · Marge ${s.currentMarginPct}% → ${s.suggestedMarginPct}%</div>
          </div>
          <button class="btn btn-primary" style="padding:8px 11px;font-size:12px;flex-shrink:0" data-apply-price="${escapeHtml(s.shopifyId)}" data-title="${escapeHtml(s.title)}" data-new-price="${s.suggestedPrice}">Übernehmen</button>
        </div>`).join('')}
      <div class="row-sub" style="padding:10px 14px 4px">Ziel-Marge: ${priceSuggestions[0].targetMarginPct}%. Vorgeschlagen wird der kleinste Preis, der sie erreicht. Übernahme schreibt den Preis direkt in Shopify.</div>
    </div>` : '';

  // ── Website & SEO (Storefront-Studio · Vorher/Nachher) ──
  // Verbessert deine echte Shopify-Seite. "Übernehmen" schreibt die
  // SEO-Metadaten direkt nach Shopify - immer erst nach Bestätigung.
  const seoHtml = storefrontSuggestions.length ? `
    <div class="section-h">Website &amp; SEO</div>
    <div class="glass" style="margin-bottom:14px">
      ${storefrontSuggestions.map(s => {
        const t = (s.suggested && s.suggested.title) || '';
        const d = (s.suggested && s.suggested.description) || '';
        return `
        <div class="row" style="align-items:flex-start">
          <div class="row-icon" style="color:var(--signal-amber);margin-top:2px">🔍</div>
          <div class="row-text">
            <div class="row-title">${escapeHtml(s.productTitle || 'Produkt')}${s.createdByAi ? ' <span style="opacity:.5">✦KI</span>' : ''}</div>
            <div class="row-sub" style="margin-top:3px">${escapeHtml(s.reason || 'SEO-Vorschlag')}</div>
            <div style="margin-top:8px;padding:9px 11px;background:var(--glass-fill-strong);border-radius:9px">
              <div style="font-size:11px;opacity:.6;margin-bottom:2px">Google-Titel</div>
              <div style="font-size:12.5px;font-weight:600;line-height:1.35">${escapeHtml(t)}</div>
              <div style="font-size:11px;opacity:.6;margin:7px 0 2px">Google-Beschreibung</div>
              <div style="font-size:12px;line-height:1.4">${escapeHtml(d)}</div>
            </div>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0;margin-left:8px">
            <button class="btn btn-primary" style="padding:8px 11px;font-size:12px" data-apply-seo="${s.id}" data-title="${escapeHtml(s.productTitle || 'dieses Produkt')}">Übernehmen</button>
            <button class="btn btn-glass" style="padding:8px 11px;font-size:12px" data-dismiss-seo="${s.id}">Verwerfen</button>
          </div>
        </div>`;
      }).join('')}
      <div class="row-sub" style="padding:10px 14px 4px">Das ist der Text, den Google in den Suchergebnissen zeigt. Übernahme schreibt ihn direkt in deinen Shopify-Shop.</div>
    </div>` : '';

  // ── Kampagnen-Ideen (informativ) ──
  const ideasHtml = seasonalIdeas.length ? `
    <div class="section-h">Kampagnen-Ideen</div>
    <div class="glass" style="margin-bottom:14px;padding:14px">
      ${seasonalIdeas.map((idea, i) => `
        ${i > 0 ? '<div style="height:1px;background:var(--glass-fill-strong);margin:12px 0"></div>' : ''}
        <div>
          <div style="font-weight:600;font-size:13.5px;margin-bottom:4px">${escapeHtml(idea.eventLabel || 'Kampagne')} <span class="row-sub" style="font-weight:400">· ${formatRelativeTime(idea.created_at)}</span></div>
          <div style="white-space:pre-wrap;line-height:1.5;font-size:13.5px">${escapeHtml(idea.output)}</div>
        </div>`).join('')}
    </div>` : '';

  view.innerHTML = `${autopilotHtml}${headerHtml}${draftsHtml}${failedHtml}${lowStockHtml}${priceHtml}${seoHtml}${ideasHtml}`;

  // ── Autopilot: Tagesplan jetzt erstellen ──
  // Legt nur Entwürfe/Vorschläge an - nichts geht live. Danach neu
  // laden, damit der frische Plan direkt sichtbar wird.
  const runAutopilotBtn = document.getElementById('runAutopilotBtn');
  if (runAutopilotBtn) runAutopilotBtn.onclick = () => runAutopilot(runAutopilotBtn);

  // ── Aktionen verdrahten ──
  // Freigeben/Erneut: geht ECHT live → immer erst der "Wirklich?"-Dialog.
  view.querySelectorAll('[data-approve]').forEach(btn => {
    btn.onclick = () => confirmApproval(Number(btn.dataset.approve), btn.dataset.label || 'der Plattform');
  });

  // Verwerfen/Löschen: entfernt den Entwurf/Fehler. Kein Live-Effekt,
  // aber trotzdem eine kurze Rückfrage, damit kein KI-Entwurf aus
  // Versehen verloren geht.
  view.querySelectorAll('[data-discard]').forEach(btn => {
    btn.onclick = () => confirmDiscard(Number(btn.dataset.discard));
  });

  // Preis übernehmen: schreibt ECHT nach Shopify → immer erst Bestätigung.
  view.querySelectorAll('[data-apply-price]').forEach(btn => {
    btn.onclick = () => confirmApplyPrice(
      btn.dataset.applyPrice,
      btn.dataset.title || 'dieses Produkt',
      Number(btn.dataset.newPrice)
    );
  });

  // SEO übernehmen: schreibt ECHT nach Shopify → immer erst Bestätigung.
  view.querySelectorAll('[data-apply-seo]').forEach(btn => {
    btn.onclick = () => confirmApplySeo(Number(btn.dataset.applySeo), btn.dataset.title || 'dieses Produkt');
  });
  // SEO verwerfen: kein Live-Effekt, kurze Rückfrage genügt.
  view.querySelectorAll('[data-dismiss-seo]').forEach(btn => {
    btn.onclick = () => confirmDismissSeo(Number(btn.dataset.dismissSeo));
  });

  const goShopifyBtn = document.getElementById('goShopifyBtn');
  if (goShopifyBtn) goShopifyBtn.onclick = () => navigateTo('shopify');
}

// Übernimmt einen SEO-Vorschlag nach ausdrücklicher Bestätigung direkt in
// Shopify (POST /storefront/suggestions/:id/apply). Ändert nur die
// Google-Metadaten - nicht das Produkt selbst.
function confirmApplySeo(suggestionId, productTitle) {
  openSheet(`
    <div class="sheet-title">SEO-Text in Shopify übernehmen?</div>
    <div class="sheet-sub">Der Google-Titel und die -Beschreibung von „${escapeHtml(productTitle)}" werden in deinem echten Shopify-Shop gesetzt. Das verbessert, wie dein Produkt bei Google erscheint – das Produkt selbst bleibt unverändert.</div>
    <button class="btn btn-primary btn-full" id="confirmSeoBtn" style="margin-bottom:10px">Ja, SEO-Text übernehmen</button>
    <button class="btn btn-glass btn-full" onclick="closeSheet()">Abbrechen</button>
  `);

  document.getElementById('confirmSeoBtn').onclick = async () => {
    const btn = document.getElementById('confirmSeoBtn');
    btn.disabled = true; btn.innerHTML = '<div class="spinner"></div>';
    await withActivity(async () => {
      try {
        await api(`/storefront/suggestions/${suggestionId}/apply`, { method: 'POST' });
        closeSheet();
        toast('SEO übernommen', `„${productTitle}" erscheint jetzt mit dem neuen Text bei Google.`, 'success');
      } catch (err) {
        toast('Übernahme fehlgeschlagen', err.message, 'error');
      }
      navigateTo('approvals');
    });
  };
}

function confirmDismissSeo(suggestionId) {
  openSheet(`
    <div class="sheet-title">SEO-Vorschlag verwerfen?</div>
    <div class="sheet-sub">Der Vorschlag wird entfernt. Der Autopilot kann später jederzeit einen neuen erzeugen.</div>
    <button class="btn btn-primary btn-full" id="confirmDismissSeoBtn" style="margin-bottom:10px">Ja, verwerfen</button>
    <button class="btn btn-glass btn-full" onclick="closeSheet()">Abbrechen</button>
  `);

  document.getElementById('confirmDismissSeoBtn').onclick = async () => {
    closeSheet();
    try {
      await api(`/storefront/suggestions/${suggestionId}/dismiss`, { method: 'POST' });
      toast('Verworfen', 'Der SEO-Vorschlag wurde entfernt.', 'success');
    } catch (err) {
      toast('Verwerfen fehlgeschlagen', err.message, 'error');
    }
    navigateTo('approvals');
  };
}

// Übernimmt den vorgeschlagenen Preis nach ausdrücklicher Bestätigung
// direkt in Shopify (nutzt PUT /pricing/products/:id/price).
function confirmApplyPrice(productId, productTitle, newPrice) {
  openSheet(`
    <div class="sheet-title">Neuen Preis in Shopify übernehmen?</div>
    <div class="sheet-sub">Der Verkaufspreis von „${escapeHtml(productTitle)}" wird in deinem echten Shopify-Shop auf <b>${newPrice.toFixed(2)}€</b> gesetzt. Das ist sofort für Kunden sichtbar.</div>
    <button class="btn btn-primary btn-full" id="confirmPriceBtn" style="margin-bottom:10px">Ja, Preis auf ${newPrice.toFixed(2)}€ setzen</button>
    <button class="btn btn-glass btn-full" onclick="closeSheet()">Abbrechen</button>
  `);

  document.getElementById('confirmPriceBtn').onclick = async () => {
    const btn = document.getElementById('confirmPriceBtn');
    btn.disabled = true; btn.innerHTML = '<div class="spinner"></div>';
    await withActivity(async () => {
      try {
        await api(`/pricing/products/${productId}/price`, { method: 'PUT', body: { price: newPrice } });
        closeSheet();
        toast('Preis übernommen', `„${productTitle}" kostet jetzt ${newPrice.toFixed(2)}€.`, 'success');
      } catch (err) {
        toast('Übernahme fehlgeschlagen', err.message, 'error');
      }
      navigateTo('approvals');
    });
  };
}

// Freigeben = veröffentlichen. Nutzt EXAKT denselben Endpunkt wie der
// "Posten"-Button im Social-Tab. Nach Erfolg zurück ins Freigabe-Center,
// damit der erledigte Eintrag verschwindet.
function confirmApproval(postId, platformLabel) {
  openSheet(`
    <div class="sheet-title">Wirklich jetzt veröffentlichen?</div>
    <div class="sheet-sub">Dieser Beitrag geht echt live auf ${escapeHtml(platformLabel)} — sichtbar für deine echten Follower. Das lässt sich danach nicht zurücknehmen.</div>
    <button class="btn btn-primary btn-full" id="confirmApprovalBtn" style="margin-bottom:10px">Ja, jetzt veröffentlichen</button>
    <button class="btn btn-glass btn-full" onclick="closeSheet()">Abbrechen</button>
  `);

  document.getElementById('confirmApprovalBtn').onclick = async () => {
    closeSheet();
    await withActivity(async () => {
      try {
        await api(`/social/posts/${postId}/publish`, { method: 'POST' });
        toast('Veröffentlicht', `Dein Beitrag ist jetzt echt live auf ${platformLabel}.`, 'success');
      } catch (err) {
        toast('Veröffentlichung fehlgeschlagen', err.message, 'error');
      }
      navigateTo('approvals');
    });
  };
}

// Löst den Autopilot manuell aus: er bereitet die Vorschläge des Tages
// vor (Post-Entwürfe, plus die Chancen-Abschnitte darunter). Bewusst
// OHNE "Wirklich?"-Dialog - denn hier geht nichts live, es entstehen nur
// Entwürfe. Die echte Freigabe pro Beitrag/Preis bleibt wie gehabt.
async function runAutopilot(btn) {
  btn.disabled = true;
  const original = btn.textContent;
  btn.innerHTML = '<div class="spinner"></div>';
  try {
    const res = await api('/autopilot/run', { method: 'POST' });
    const n = res.created || 0;
    if (n > 0) {
      toast('Tagesplan erstellt', `${n} neue${n === 1 ? 'r Entwurf wartet' : ' Entwürfe warten'} auf deine Freigabe.`, 'success');
    } else if (res.skippedFull) {
      toast('Schon genug offen', 'Es warten bereits Entwürfe auf dich – erst die abarbeiten, dann kommt Neues nach.', 'info');
    } else {
      toast('Plan aktualisiert', 'Preis-Chancen, Bestand und Ideen sind auf dem neuesten Stand.', 'success');
    }
  } catch (err) {
    btn.disabled = false;
    btn.textContent = original;
    toast('Autopilot fehlgeschlagen', err.message, 'error');
    return;
  }
  navigateTo('approvals');
}

function confirmDiscard(postId) {
  openSheet(`
    <div class="sheet-title">Entwurf verwerfen?</div>
    <div class="sheet-sub">Der Entwurf wird gelöscht. Falls die KI ihn erstellt hat, kannst du im KI-Tab jederzeit einen neuen erzeugen.</div>
    <button class="btn btn-primary btn-full" id="confirmDiscardBtn" style="margin-bottom:10px">Ja, verwerfen</button>
    <button class="btn btn-glass btn-full" onclick="closeSheet()">Abbrechen</button>
  `);

  document.getElementById('confirmDiscardBtn').onclick = async () => {
    closeSheet();
    try {
      await api(`/social/posts/${postId}`, { method: 'DELETE' });
      toast('Verworfen', 'Der Entwurf wurde entfernt.', 'success');
    } catch (err) {
      toast('Verwerfen fehlgeschlagen', err.message, 'error');
    }
    navigateTo('approvals');
  };
}
