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
  const [data, auto, themes, bilanzData] = await Promise.all([
    api('/approvals/pending'),
    api('/autopilot/status').catch(() => null),
    api('/storefront/themes').catch(() => null),
    api('/accounting/reports/bilanz').catch(() => null),
  ]);
  const postDrafts = data.postDrafts || [];
  const failedPosts = data.failedPosts || [];
  const lowStock = data.lowStock || [];
  const seasonalIdeas = data.seasonalIdeas || [];
  const priceSuggestions = data.priceSuggestions || [];
  const storefrontSuggestions = data.storefrontSuggestions || [];
  const crmTasks = data.crmTasks || [];
  const bookingProposals = data.bookingProposals || [];
  const reorderTasks = data.reorderTasks || [];
  const orderedReorders = data.orderedReorders || [];

  const actionable = postDrafts.length + failedPosts.length;
  const totalWaiting = actionable + lowStock.length + priceSuggestions.length + storefrontSuggestions.length + crmTasks.length + bookingProposals.length + reorderTasks.length + orderedReorders.length;

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

  // ── Storefront-Studio (deine Shopify-Seite verbessern) ──
  // Zeigt je nach Vorschlagstyp die passende Vorher/Nachher-Ansicht.
  // "Übernehmen" schreibt echt nach Shopify - immer erst nach Bestätigung.
  const studioTriggersHtml = `
    <div class="glass fade-up" style="padding:14px;margin-bottom:14px">
      <div class="vital-label" style="margin-bottom:2px">Storefront-Studio</div>
      <div style="font-weight:600;font-size:14px;margin-bottom:3px">Deine Shopify-Seite verbessern</div>
      <div class="row-sub" style="margin-bottom:11px">Vorschläge erzeugen – nichts geht live ohne deine Freigabe.</div>
      <div style="display:flex;gap:7px;flex-wrap:wrap">
        <button class="btn btn-glass" style="padding:8px 12px;font-size:12px;flex:1;min-width:110px" data-studio="seo">SEO-Vorschläge</button>
        <button class="btn btn-glass" style="padding:8px 12px;font-size:12px;flex:1;min-width:110px" data-studio="curation">Schaufenster prüfen</button>
        <button class="btn btn-glass" style="padding:8px 12px;font-size:12px;flex:1;min-width:110px" data-studio="content">Seiten &amp; Blog</button>
        <button class="btn btn-glass" style="padding:8px 12px;font-size:12px;flex:1;min-width:110px" data-studio="design">Design (Optik)</button>
      </div>
    </div>`;

  // ── Design-Entwürfe (Themes) · Vorschau + Veröffentlichen ──
  // Zeigt vorhandene Entwurfs-Kopien. "Vorschau" öffnet den Entwurf ohne
  // Live-Wirkung; "Veröffentlichen" ist der einzige echte Live-Schritt und
  // hat einen eigenen, deutlichen Bestätigungs-Dialog.
  const draftThemes = (themes && themes.drafts) || [];
  const themesHtml = draftThemes.length ? `
    <div class="section-h">Design-Entwürfe</div>
    <div class="glass" style="margin-bottom:14px">
      ${draftThemes.map(t => `
        <div class="row">
          <div class="row-icon">🎨</div>
          <div class="row-text">
            <div class="row-title">${escapeHtml(t.name)}</div>
            <div class="row-sub">Entwurfs-Kopie · nicht live</div>
          </div>
          <div style="display:flex;gap:6px;flex-shrink:0">
            <a class="btn btn-glass" style="padding:8px 11px;font-size:12px" href="${t.previewUrl}" target="_blank" rel="noopener">Vorschau</a>
            <button class="btn btn-primary" style="padding:8px 11px;font-size:12px" data-publish-theme="${t.id}" data-name="${escapeHtml(t.name)}">Veröffentlichen</button>
          </div>
        </div>`).join('')}
      <div class="row-sub" style="padding:10px 14px 4px">„Veröffentlichen" setzt den Entwurf als Live-Theme – erst dann für Besucher sichtbar.</div>
    </div>` : '';

  const studioListHtml = storefrontSuggestions.length ? `
    <div class="section-h">Website-Vorschläge</div>
    <div class="glass" style="margin-bottom:14px">
      ${storefrontSuggestions.map(renderStorefrontSuggestion).join('')}
      <div class="row-sub" style="padding:10px 14px 4px">Jede Übernahme schreibt direkt in deinen echten Shopify-Shop – nur nach deiner Bestätigung.</div>
    </div>` : '';

  const seoHtml = studioTriggersHtml + studioListHtml;

  // ── Kunden-Mails (CRM · entworfene Mails, Versand nach Freigabe) ──
  // Zwei Gruppen: Outreach (Win-back/Bewertung) und transaktionale
  // Bestellstatus-Mails (Danke/Versand) - letztere in eigener Sektion
  // inkl. Sammel-Freigabe.
  const ORDER_MAIL_KINDS = ['order_thankyou', 'shipping_confirmation'];
  const CRM_KIND_LABEL = {
    winback: 'Kunde zurückholen',
    winback_vip: 'Stammkunde zurückholen ⭐',
    review_request: 'Bewertungs-Anfrage',
    order_thankyou: 'Danke für die Bestellung',
    shipping_confirmation: 'Versandbestätigung',
    abandoned_cart: 'Warenkorb-Erinnerung 🛒',
  };
  const crmOutreach = crmTasks.filter(t => !ORDER_MAIL_KINDS.includes(t.kind));
  const orderMails = crmTasks.filter(t => ORDER_MAIL_KINDS.includes(t.kind));

  const renderCrmMailRow = (t) => {
    const preview = (t.bodyHtml || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 130);
    // Referenz nur als „Bestellung X" zeigen, wenn sie auch eine Bestellung
    // ist. Bei der Warenkorb-Erinnerung ist die Referenz eine Checkout-ID -
    // die würde als „Bestellung" fälschlich wirken, also weglassen.
    const refLabel = (t.ref && t.kind !== 'abandoned_cart') ? ` · Bestellung ${escapeHtml(t.ref)}` : '';
    return `
      <div class="row" style="align-items:flex-start">
        <div class="row-icon" style="margin-top:2px">✉️</div>
        <div class="row-text">
          <div class="row-title">${escapeHtml(CRM_KIND_LABEL[t.kind] || 'Kunden-Mail')}${t.createdByAi ? ' <span style="opacity:.5">✦KI</span>' : ''}</div>
          <div class="row-sub" style="margin-top:3px">An ${escapeHtml(t.customerName || t.customerEmail)}${refLabel}</div>
          <div style="margin-top:8px;padding:9px 11px;background:var(--glass-fill-strong);border-radius:9px">
            <div style="font-size:12.5px;font-weight:600;line-height:1.35">${escapeHtml(t.subject)}</div>
            <div style="font-size:12px;line-height:1.45;margin-top:4px;opacity:.85">${escapeHtml(preview)}…</div>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0;margin-left:8px">
          <button class="btn btn-primary" style="padding:8px 11px;font-size:12px" data-send-crm="${t.id}" data-email="${escapeHtml(t.customerEmail)}">Senden</button>
          <button class="btn btn-glass" style="padding:8px 11px;font-size:12px" data-dismiss-crm="${t.id}">Verwerfen</button>
        </div>
      </div>`;
  };

  const crmHtml = crmOutreach.length ? `
    <div class="section-h">Kunden &amp; Vertrieb</div>
    <div class="glass" style="margin-bottom:14px">
      ${crmOutreach.map(renderCrmMailRow).join('')}
      <div class="row-sub" style="padding:10px 14px 4px">„Senden" verschickt die Mail echt an den Kunden – erst nach deiner Bestätigung.</div>
    </div>` : '';

  const orderMailsHtml = orderMails.length ? `
    <div class="section-h">Bestellstatus-Mails</div>
    <div class="glass" style="margin-bottom:14px">
      <div class="row" style="padding-bottom:6px">
        <div class="row-text"><div class="row-sub">${orderMails.length} Entwurf(e) · Danke &amp; Versandbestätigung</div></div>
        <button class="btn btn-primary" style="padding:8px 12px;font-size:12px;flex-shrink:0" data-send-order-mails-all="1">Alle ${orderMails.length} senden</button>
      </div>
      ${orderMails.map(renderCrmMailRow).join('')}
      <div class="row-sub" style="padding:10px 14px 4px">„Alle senden" verschickt sämtliche Bestellstatus-Mails echt an die Kunden – erst nach deiner Bestätigung.</div>
    </div>` : '';

  // ── Buchhaltung (Umsatz-Buchungsvorschläge · verbuchen nach Freigabe) ──
  // Zeigt je Vorschlag den Buchungssatz (Soll/Haben). "Verbuchen" schreibt
  // ihn cent-genau und unveränderbar in die Buchhaltung.
  const buchhaltungHtml = bookingProposals.length ? `
    <div class="section-h">Buchhaltung</div>
    <div class="glass" style="margin-bottom:14px">
      ${bookingProposals.map(p => `
        <div class="row" style="align-items:flex-start">
          <div class="row-icon" style="margin-top:2px">📒</div>
          <div class="row-text">
            <div class="row-title">${escapeHtml(p.description)}</div>
            <div class="row-sub" style="margin-top:3px">${escapeHtml(p.bookingDate)}${p.note ? ' · ' + escapeHtml(p.note) : ''}</div>
            <div style="margin-top:8px;padding:9px 11px;background:var(--glass-fill-strong);border-radius:9px;font-size:12.5px;line-height:1.6">
              ${p.lines.map(l => `<div style="display:flex;justify-content:space-between;gap:10px">
                <span>${l.debitCents ? 'Soll' : 'Haben'} · ${escapeHtml(l.account)} ${escapeHtml(l.accountName)}</span>
                <span style="font-variant-numeric:tabular-nums;font-weight:600">${escapeHtml(l.debit || l.credit)}</span>
              </div>`).join('')}
            </div>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0;margin-left:8px">
            <button class="btn btn-primary" style="padding:8px 11px;font-size:12px" data-book="${p.id}">Verbuchen</button>
            <button class="btn btn-glass" style="padding:8px 11px;font-size:12px" data-dismiss-book="${p.id}">Verwerfen</button>
          </div>
        </div>`).join('')}
      <div class="row-sub" style="padding:10px 14px 4px">„Verbuchen" schreibt den Satz cent-genau &amp; unveränderbar in die Buchhaltung (Korrektur später nur per Storno).</div>
    </div>` : '';

  // Kompakte Ergebnis-Anzeige (damit du die Buchhaltung auf einen Blick siehst).
  const buchhaltungSummaryHtml = (bilanzData && (bilanzData.summeAktivaCents > 0 || bilanzData.jahresergebnisCents !== 0)) ? `
    <div class="glass" style="margin-bottom:14px;padding:14px">
      <div class="vital-label" style="margin-bottom:6px">Buchhaltung · Stand</div>
      <div style="display:flex;gap:18px;flex-wrap:wrap">
        <div><div style="font-size:11px;opacity:.6">Bilanzsumme</div><div style="font-weight:600">${escapeHtml(bilanzData.bilanzsummeAktiva)}</div></div>
        <div><div style="font-size:11px;opacity:.6">${bilanzData.jahresergebnisCents >= 0 ? 'Gewinn' : 'Verlust'}</div><div style="font-weight:600">${escapeHtml(bilanzData.jahresergebnis)}</div></div>
        <div><div style="font-size:11px;opacity:.6">Bilanz</div><div style="font-weight:600;color:${bilanzData.balanced ? 'var(--signal-green, #16a34a)' : 'var(--danger)'}">${bilanzData.balanced ? 'geht auf ✓' : 'FEHLER'}</div></div>
      </div>
    </div>` : '';

  // ── Wareneinkauf (Nachbestell-Vorschläge · knapp UND gefragt) ──
  // Zeigt je Produkt die empfohlene Nachbestellmenge samt Begründung
  // (Bestand + echte Verkaufszahlen) und geschätzten Einkaufskosten.
  // "Als bestellt markieren" ist eine nachvollziehbare Einkaufs-Entscheidung
  // (kein externer Versand, keine Buchung, kein Eingriff in Shopify).
  const reorderHtml = reorderTasks.length ? `
    <div class="section-h">Wareneinkauf</div>
    <div class="glass" style="margin-bottom:14px">
      ${reorderTasks.map(t => `
        <div class="row" style="align-items:flex-start">
          <div class="row-icon" style="margin-top:2px">📦</div>
          <div class="row-text">
            <div class="row-title">${escapeHtml(t.productTitle || 'Produkt')}${t.createdByAi ? ' <span style="opacity:.5">✦KI</span>' : ''}</div>
            <div class="row-sub" style="margin-top:3px">${escapeHtml(t.reason || '')}</div>
            <div style="margin-top:8px;padding:9px 11px;background:var(--glass-fill-strong);border-radius:9px;font-size:12.5px;line-height:1.6">
              <div style="display:flex;justify-content:space-between;gap:10px">
                <span>Empfohlene Nachbestellung</span>
                <span style="font-variant-numeric:tabular-nums;font-weight:600">${t.suggestedQty} Stück</span>
              </div>
              <div style="display:flex;justify-content:space-between;gap:10px">
                <span>Geschätzte Einkaufskosten</span>
                <span style="font-variant-numeric:tabular-nums;font-weight:600">${t.estCost
                  ? escapeHtml(t.estCost) + ' <span style="opacity:.6;font-weight:400">(netto)</span>'
                  : '<span style="opacity:.6;font-weight:400">Einkaufspreis fehlt</span>'}</span>
              </div>
            </div>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0;margin-left:8px">
            <button class="btn btn-primary" style="padding:8px 11px;font-size:12px;white-space:nowrap" data-order-reorder="${t.id}" data-title="${escapeHtml(t.productTitle || 'dieses Produkt')}" data-qty="${t.suggestedQty}">Als bestellt</button>
            <button class="btn btn-glass" style="padding:8px 11px;font-size:12px" data-dismiss-reorder="${t.id}">Verwerfen</button>
          </div>
        </div>`).join('')}
      <div class="row-sub" style="padding:10px 14px 4px">Vorgeschlagen wird nur, was knapp <b>und</b> gefragt ist. „Als bestellt" merkt sich deine Einkaufs-Entscheidung – es wird nichts automatisch bestellt oder verbucht.</div>
    </div>` : '';

  // ── Wareneingang (bestellte Posten · Rechnung erfassen → Buchungsvorschlag) ──
  // Was du bestellt hast, wartet hier, bis Ware/Rechnung da ist. „Wareneingang
  // buchen" öffnet ein kleines Formular (Netto-Betrag der Rechnung + Zahlweise)
  // und erzeugt daraus einen Wareneinkaufs-Buchungsvorschlag im Buchhaltungs-
  // Abschnitt – verbucht wird er dort, wie gewohnt, erst nach deiner Freigabe.
  const receiptHtml = orderedReorders.length ? `
    <div class="section-h">Wareneingang</div>
    <div class="glass" style="margin-bottom:14px">
      ${orderedReorders.map(t => `
        <div class="row">
          <div class="row-icon">🚚</div>
          <div class="row-text">
            <div class="row-title">${escapeHtml(t.productTitle || 'Posten')}</div>
            <div class="row-sub">${t.suggestedQty} Stück bestellt${t.estCost ? ` · geschätzt ${escapeHtml(t.estCost)} netto` : ''}</div>
          </div>
          <button class="btn btn-primary" style="padding:8px 11px;font-size:12px;flex-shrink:0;white-space:nowrap" data-receive-reorder="${t.id}" data-title="${escapeHtml(t.productTitle || 'diesen Posten')}" data-net="${escapeHtml(t.estCostValue || '')}">Wareneingang buchen</button>
        </div>`).join('')}
      <div class="row-sub" style="padding:10px 14px 4px">„Wareneingang buchen" erfasst die Lieferanten-Rechnung und legt einen Wareneinkaufs-Buchungsvorschlag an – der Lagerbestand bleibt in Shopify, hier wird nichts automatisch verbucht.</div>
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

  // Übersichtlich gruppiert: die vielen Abschnitte werden in vier klare
  // Cluster sortiert (Marketing → Shop → Kunden → Buchhaltung). Eine
  // Cluster-Überschrift erscheint NUR, wenn der Cluster auch Inhalt hat -
  // so bleibt der Screen aufgeräumt, wenn gerade wenig ansteht.
  const clusterH = (icon, title, ...parts) =>
    parts.some(p => p && p.trim())
      ? `<div style="margin:28px 6px 2px;padding-top:16px;border-top:1px solid var(--glass-edge-soft);font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-dim);display:flex;align-items:center;gap:7px"><span style="font-size:14px">${icon}</span>${title}</div>`
      : '';

  view.innerHTML =
    autopilotHtml + headerHtml
    + clusterH('🛍', 'Marketing &amp; Social', draftsHtml, failedHtml, ideasHtml)
      + draftsHtml + failedHtml + ideasHtml
    + clusterH('📈', 'Shop &amp; Umsatz', priceHtml, lowStockHtml, reorderHtml, receiptHtml, seoHtml, themesHtml)
      + priceHtml + lowStockHtml + reorderHtml + receiptHtml + seoHtml + themesHtml
    + clusterH('✉️', 'Kunden', crmHtml, orderMailsHtml)
      + crmHtml + orderMailsHtml
    + clusterH('📒', 'Buchhaltung', buchhaltungHtml, buchhaltungSummaryHtml)
      + buchhaltungHtml + buchhaltungSummaryHtml;

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

  // Storefront-Vorschlag übernehmen: schreibt ECHT nach Shopify → Bestätigung.
  view.querySelectorAll('[data-apply-studio]').forEach(btn => {
    btn.onclick = () => confirmApplyStudio(
      Number(btn.dataset.applyStudio),
      btn.dataset.kind,
      btn.dataset.label || 'diesen Vorschlag'
    );
  });
  // Storefront-Vorschlag verwerfen: kein Live-Effekt, kurze Rückfrage.
  view.querySelectorAll('[data-dismiss-studio]').forEach(btn => {
    btn.onclick = () => confirmDismissStudio(Number(btn.dataset.dismissStudio));
  });
  // Studio-Trigger: erzeugen nur Vorschläge (nichts live) → kein Dialog nötig.
  view.querySelectorAll('[data-studio]').forEach(btn => {
    btn.onclick = () => runStudioGenerate(btn.dataset.studio, btn);
  });
  // Theme veröffentlichen: einziger echter Live-Schritt → starker Dialog.
  view.querySelectorAll('[data-publish-theme]').forEach(btn => {
    btn.onclick = () => confirmPublishTheme(Number(btn.dataset.publishTheme), btn.dataset.name || 'Entwurf');
  });
  // CRM: Kunden-Mail senden (Aktion nach außen) → Bestätigung.
  view.querySelectorAll('[data-send-crm]').forEach(btn => {
    btn.onclick = () => confirmSendCrm(Number(btn.dataset.sendCrm), btn.dataset.email || 'den Kunden');
  });
  view.querySelectorAll('[data-dismiss-crm]').forEach(btn => {
    btn.onclick = () => confirmDismissCrm(Number(btn.dataset.dismissCrm));
  });
  // Bestellstatus-Mails: Sammel-Freigabe (verschickt alle offenen) → Bestätigung.
  const sendAllBtn = view.querySelector('[data-send-order-mails-all]');
  if (sendAllBtn) sendAllBtn.onclick = () => confirmSendOrderMailsBulk();
  // Buchhaltung: Verbuchen (echte, unveränderbare Buchung) → Bestätigung.
  view.querySelectorAll('[data-book]').forEach(btn => {
    btn.onclick = () => confirmBookProposal(Number(btn.dataset.book));
  });
  view.querySelectorAll('[data-dismiss-book]').forEach(btn => {
    btn.onclick = () => confirmDismissBooking(Number(btn.dataset.dismissBook));
  });
  // Wareneinkauf: "Als bestellt markieren" (Einkaufs-Entscheidung) → Bestätigung.
  view.querySelectorAll('[data-order-reorder]').forEach(btn => {
    btn.onclick = () => confirmMarkOrdered(Number(btn.dataset.orderReorder), btn.dataset.title || 'dieses Produkt', Number(btn.dataset.qty));
  });
  view.querySelectorAll('[data-dismiss-reorder]').forEach(btn => {
    btn.onclick = () => confirmDismissReorder(Number(btn.dataset.dismissReorder));
  });
  // Wareneingang buchen: Formular (Netto-Betrag + Zahlweise) → Buchungsvorschlag.
  view.querySelectorAll('[data-receive-reorder]').forEach(btn => {
    btn.onclick = () => openReceiveReorder(Number(btn.dataset.receiveReorder), btn.dataset.title || 'diesen Posten', btn.dataset.net || '');
  });

  const goShopifyBtn = document.getElementById('goShopifyBtn');
  if (goShopifyBtn) goShopifyBtn.onclick = () => navigateTo('shopify');
}

// Metadaten je Vorschlagstyp: Icon, Button-Text und der "Wirklich?"-Text.
// An EINER Stelle, damit Anzeige und Bestätigung immer zusammenpassen.
const STUDIO_KIND_META = {
  seo:                { icon: '🔍', apply: 'Übernehmen',        confirmTitle: 'SEO-Text in Shopify übernehmen?',        confirmBody: (l) => `Der Google-Titel und die -Beschreibung von „${l}" werden in deinem echten Shopify-Shop gesetzt. Das Produkt selbst bleibt unverändert.` },
  hide_soldout:       { icon: '🚫', apply: 'Aus Shop nehmen',   confirmTitle: 'Produkt aus dem Shop nehmen?',            confirmBody: (l) => `„${l}" ist ausverkauft und wird aus deinem Online-Shop genommen (nicht gelöscht – Produkt und Bestand bleiben erhalten). Sobald wieder Ware da ist, kannst du es zurückstellen.` },
  feature_collection: { icon: '⭐', apply: 'Kollektion setzen', confirmTitle: 'Kollektion in Shopify aktualisieren?',    confirmBody: (l) => `Die Kollektion „${l}" wird in deinem echten Shopify-Shop mit den vorgeschlagenen Produkten gefüllt. Vorherige Inhalte dieser Kollektion werden ersetzt.` },
  page:               { icon: '📄', apply: 'Veröffentlichen',   confirmTitle: 'Seite in Shopify veröffentlichen?',       confirmBody: (l) => `Die Seite „${l}" wird in deinem echten Shopify-Shop angelegt bzw. aktualisiert und ist danach für Besucher sichtbar.` },
  blog:               { icon: '✍️', apply: 'Veröffentlichen',   confirmTitle: 'Blog-Artikel veröffentlichen?',           confirmBody: (l) => `Der Artikel „${l}" wird in deinem echten Shopify-Blog veröffentlicht und ist danach öffentlich lesbar.` },
  design:             { icon: '🎨', apply: 'Auf Entwurf',       confirmTitle: 'Design auf Entwurfs-Kopie anwenden?',     confirmBody: (l) => `Die Palette „${l}" wird auf eine Entwurfs-Kopie angewendet – live erst nach separater Freigabe.` },
};

// Prüft, ob ein String ein sicherer Hex-Farbwert ist (für Inline-Styles).
function isHexColor(v) { return typeof v === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(v); }

// Rendert einen Storefront-Vorschlag passend zu seinem Typ (Vorher/Nachher
// bzw. Vorschau). Gibt für jeden Typ dieselben data-Attribute aus, damit die
// Verdrahtung generisch bleibt.
function renderStorefrontSuggestion(s) {
  const meta = STUDIO_KIND_META[s.kind] || { icon: '•', apply: 'Übernehmen' };
  const label = s.productTitle || 'Vorschlag';
  let detail = '';

  if (s.kind === 'seo') {
    const t = (s.suggested && s.suggested.title) || '';
    const d = (s.suggested && s.suggested.description) || '';
    detail = `
      <div style="font-size:11px;opacity:.6;margin-bottom:2px">Google-Titel</div>
      <div style="font-size:12.5px;font-weight:600;line-height:1.35">${escapeHtml(t)}</div>
      <div style="font-size:11px;opacity:.6;margin:7px 0 2px">Google-Beschreibung</div>
      <div style="font-size:12px;line-height:1.4">${escapeHtml(d)}</div>`;
  } else if (s.kind === 'feature_collection') {
    const prods = (s.suggested && s.suggested.products) || [];
    detail = `
      <div style="font-size:11px;opacity:.6;margin-bottom:4px">Kollektion „${escapeHtml((s.suggested && s.suggested.collectionTitle) || 'Empfohlen')}"</div>
      ${prods.slice(0, 5).map((p, i) => `<div style="font-size:12.5px;line-height:1.5">${i + 1}. ${escapeHtml(p.title || 'Produkt')}${p.unitsSold != null ? ` <span style="opacity:.5">· ${p.unitsSold}× verkauft</span>` : ''}</div>`).join('')}`;
  } else if (s.kind === 'page' || s.kind === 'blog') {
    const body = (s.suggested && s.suggested.bodyHtml) || '';
    const preview = body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
    detail = `
      <div style="font-size:12.5px;font-weight:600;line-height:1.35">${escapeHtml((s.suggested && s.suggested.title) || label)}</div>
      <div style="font-size:12px;line-height:1.45;margin-top:4px;opacity:.85">${escapeHtml(preview)}…</div>`;
  } else if (s.kind === 'hide_soldout') {
    detail = `<div style="font-size:12px;line-height:1.4;opacity:.85">Wird aus dem Online-Shop genommen, bis wieder Bestand da ist.</div>`;
  } else if (s.kind === 'design') {
    const c = (s.suggested && s.suggested.colors) || {};
    const swatches = [c.background, c.text, c.primary, c.secondary, c.accent]
      .filter(isHexColor)
      .map(hex => `<span style="display:inline-block;width:22px;height:22px;border-radius:5px;background:${hex};border:1px solid rgba(128,128,128,.35)"></span>`)
      .join('');
    detail = `<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">${swatches}<span style="font-size:11.5px;opacity:.7;margin-left:4px">Nur auf Entwurf – live erst nach Freigabe</span></div>`;
  }

  return `
    <div class="row" style="align-items:flex-start">
      <div class="row-icon" style="margin-top:2px">${meta.icon}</div>
      <div class="row-text">
        <div class="row-title">${escapeHtml(label)}${s.createdByAi ? ' <span style="opacity:.5">✦KI</span>' : ''}</div>
        <div class="row-sub" style="margin-top:3px">${escapeHtml(s.reason || '')}</div>
        <div style="margin-top:8px;padding:9px 11px;background:var(--glass-fill-strong);border-radius:9px">${detail}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0;margin-left:8px">
        <button class="btn btn-primary" style="padding:8px 11px;font-size:12px;white-space:nowrap" data-apply-studio="${s.id}" data-kind="${s.kind}" data-label="${escapeHtml(label)}">${meta.apply}</button>
        <button class="btn btn-glass" style="padding:8px 11px;font-size:12px" data-dismiss-studio="${s.id}">Verwerfen</button>
      </div>
    </div>`;
}

// Erzeugt Vorschläge über die Studio-Trigger-Buttons. Legt NUR Vorschläge
// an (nichts geht live) → daher ohne "Wirklich?"-Dialog.
async function runStudioGenerate(kind, btn) {
  const endpoints = {
    seo: '/storefront/seo/generate',
    curation: '/storefront/curation/generate',
    content: '/storefront/content/generate',
    design: '/storefront/design/generate',
  };
  const path = endpoints[kind];
  if (!path) return;
  btn.disabled = true;
  const original = btn.textContent;
  btn.innerHTML = '<div class="spinner"></div>';
  try {
    const res = await api(path, { method: 'POST' });
    const n = res.created || 0;
    toast(n > 0 ? 'Vorschläge erstellt' : 'Nichts Neues',
      n > 0 ? `${n} neue${n === 1 ? 'r Vorschlag wartet' : ' Vorschläge warten'} auf deine Freigabe.` : 'Aktuell gibt es hier nichts zu verbessern oder es warten schon Vorschläge.',
      n > 0 ? 'success' : 'info');
  } catch (err) {
    btn.disabled = false; btn.textContent = original;
    toast('Fehlgeschlagen', err.message, 'error');
    return;
  }
  navigateTo('approvals');
}

// Übernimmt einen Storefront-Vorschlag (beliebiger Typ) nach Bestätigung
// direkt in Shopify (POST /storefront/suggestions/:id/apply).
function confirmApplyStudio(suggestionId, kind, label) {
  // Design ist ein Sonderfall: geht NICHT live, sondern auf die
  // Entwurfs-Kopie – eigener Ablauf mit Vorschau danach.
  if (kind === 'design') return confirmApplyDesign(suggestionId, label);

  const meta = STUDIO_KIND_META[kind] || { apply: 'Übernehmen', confirmTitle: 'In Shopify übernehmen?', confirmBody: (l) => `„${l}" wird in deinem echten Shopify-Shop übernommen.` };
  openSheet(`
    <div class="sheet-title">${escapeHtml(meta.confirmTitle)}</div>
    <div class="sheet-sub">${meta.confirmBody(escapeHtml(label))}</div>
    <button class="btn btn-primary btn-full" id="confirmStudioBtn" style="margin-bottom:10px">Ja, ${escapeHtml(meta.apply.toLowerCase())}</button>
    <button class="btn btn-glass btn-full" onclick="closeSheet()">Abbrechen</button>
  `);

  document.getElementById('confirmStudioBtn').onclick = async () => {
    const btn = document.getElementById('confirmStudioBtn');
    btn.disabled = true; btn.innerHTML = '<div class="spinner"></div>';
    await withActivity(async () => {
      try {
        await api(`/storefront/suggestions/${suggestionId}/apply`, { method: 'POST' });
        closeSheet();
        toast('Übernommen', `„${label}" ist jetzt in deinem Shopify-Shop aktiv.`, 'success');
      } catch (err) {
        toast('Übernahme fehlgeschlagen', err.message, 'error');
      }
      navigateTo('approvals');
    });
  };
}

function confirmDismissStudio(suggestionId) {
  openSheet(`
    <div class="sheet-title">Vorschlag verwerfen?</div>
    <div class="sheet-sub">Der Vorschlag wird entfernt. Der Autopilot kann später jederzeit einen neuen erzeugen.</div>
    <button class="btn btn-primary btn-full" id="confirmDismissStudioBtn" style="margin-bottom:10px">Ja, verwerfen</button>
    <button class="btn btn-glass btn-full" onclick="closeSheet()">Abbrechen</button>
  `);

  document.getElementById('confirmDismissStudioBtn').onclick = async () => {
    closeSheet();
    try {
      await api(`/storefront/suggestions/${suggestionId}/dismiss`, { method: 'POST' });
      toast('Verworfen', 'Der Vorschlag wurde entfernt.', 'success');
    } catch (err) {
      toast('Verwerfen fehlgeschlagen', err.message, 'error');
    }
    navigateTo('approvals');
  };
}

// Kunden-Mail senden – echte Aktion nach außen, daher immer erst der
// "Wirklich?"-Dialog. Nach Erfolg verschwindet der Entwurf aus der Liste.
function confirmSendCrm(taskId, customerEmail) {
  openSheet(`
    <div class="sheet-title">E-Mail wirklich an den Kunden senden?</div>
    <div class="sheet-sub">Diese Nachricht geht echt an <b>${escapeHtml(customerEmail)}</b> raus. Bitte prüfe kurz, dass der Text passt – Versand lässt sich nicht zurücknehmen.</div>
    <button class="btn btn-primary btn-full" id="confirmSendCrmBtn" style="margin-bottom:10px">Ja, jetzt senden</button>
    <button class="btn btn-glass btn-full" onclick="closeSheet()">Abbrechen</button>
  `);

  document.getElementById('confirmSendCrmBtn').onclick = async () => {
    const btn = document.getElementById('confirmSendCrmBtn');
    btn.disabled = true; btn.innerHTML = '<div class="spinner"></div>';
    await withActivity(async () => {
      try {
        await api(`/crm/tasks/${taskId}/send`, { method: 'POST' });
        closeSheet();
        toast('Gesendet', `Deine Mail ist an ${customerEmail} unterwegs.`, 'success');
      } catch (err) {
        toast('Senden fehlgeschlagen', err.message, 'error');
      }
      navigateTo('approvals');
    });
  };
}

function confirmDismissCrm(taskId) {
  openSheet(`
    <div class="sheet-title">Entwurf verwerfen?</div>
    <div class="sheet-sub">Diese Kunden-Mail wird entfernt und nicht gesendet. Der Autopilot kann später einen neuen Entwurf erzeugen.</div>
    <button class="btn btn-primary btn-full" id="confirmDismissCrmBtn" style="margin-bottom:10px">Ja, verwerfen</button>
    <button class="btn btn-glass btn-full" onclick="closeSheet()">Abbrechen</button>
  `);

  document.getElementById('confirmDismissCrmBtn').onclick = async () => {
    closeSheet();
    try {
      await api(`/crm/tasks/${taskId}/dismiss`, { method: 'POST' });
      toast('Verworfen', 'Der Entwurf wurde entfernt.', 'success');
    } catch (err) {
      toast('Verwerfen fehlgeschlagen', err.message, 'error');
    }
    navigateTo('approvals');
  };
}

// Sammel-Freigabe der Bestellstatus-Mails: verschickt ALLE offenen Danke-/
// Versand-Entwürfe auf einmal - echte Aktion nach außen, daher ein klarer
// "Wirklich?"-Dialog mit Anzahl. Schlägt eine Mail fehl, bleibt genau die
// offen; die anderen gehen trotzdem raus.
function confirmSendOrderMailsBulk() {
  openSheet(`
    <div class="sheet-title">Alle Bestellstatus-Mails senden?</div>
    <div class="sheet-sub">Alle offenen Danke- und Versandbestätigungs-Mails gehen jetzt echt an die jeweiligen Kunden raus. Versand lässt sich nicht zurücknehmen.</div>
    <button class="btn btn-primary btn-full" id="confirmSendOrderMailsBtn" style="margin-bottom:10px">Ja, alle senden</button>
    <button class="btn btn-glass btn-full" onclick="closeSheet()">Abbrechen</button>
  `);

  document.getElementById('confirmSendOrderMailsBtn').onclick = async () => {
    const btn = document.getElementById('confirmSendOrderMailsBtn');
    btn.disabled = true; btn.innerHTML = '<div class="spinner"></div>';
    await withActivity(async () => {
      try {
        const r = await api('/crm/order-status/send-all', { method: 'POST' });
        closeSheet();
        if (r.failed > 0) {
          toast(`${r.sent} gesendet, ${r.failed} fehlgeschlagen`, 'Fehlgeschlagene Entwürfe bleiben offen und können erneut gesendet werden.', r.sent > 0 ? 'success' : 'error');
        } else {
          toast('Gesendet', `${r.sent} Bestellstatus-Mail(s) sind unterwegs.`, 'success');
        }
      } catch (err) {
        toast('Senden fehlgeschlagen', err.message, 'error');
      }
      navigateTo('approvals');
    });
  };
}

// Verbucht einen Buchungsvorschlag ECHT in die Buchhaltung. Nach dem
// Verbuchen ist der Satz unveränderbar (Korrektur nur per Storno) - daher
// vorher der klare Hinweis.
function confirmBookProposal(proposalId) {
  openSheet(`
    <div class="sheet-title">Jetzt verbuchen?</div>
    <div class="sheet-sub">Dieser Buchungssatz wird <b>cent-genau und unveränderbar</b> in deine Buchhaltung geschrieben. Eine spätere Korrektur ist nur per Storno möglich (die Buchung bleibt dann als Beleg erhalten).</div>
    <button class="btn btn-primary btn-full" id="confirmBookBtn" style="margin-bottom:10px">Ja, verbuchen</button>
    <button class="btn btn-glass btn-full" onclick="closeSheet()">Abbrechen</button>
  `);
  document.getElementById('confirmBookBtn').onclick = async () => {
    const btn = document.getElementById('confirmBookBtn');
    btn.disabled = true; btn.innerHTML = '<div class="spinner"></div>';
    await withActivity(async () => {
      try {
        const res = await api(`/accounting/proposals/${proposalId}/book`, { method: 'POST' });
        closeSheet();
        toast('Verbucht', `Buchung ${res.entry?.entryNo || ''} wurde erstellt.`, 'success');
      } catch (err) {
        toast('Verbuchen fehlgeschlagen', err.message, 'error');
      }
      navigateTo('approvals');
    });
  };
}

function confirmDismissBooking(proposalId) {
  openSheet(`
    <div class="sheet-title">Buchungsvorschlag verwerfen?</div>
    <div class="sheet-sub">Der Vorschlag wird entfernt und nicht gebucht. Die zugrunde liegende Bestellung bleibt unberührt; der Autopilot kann später erneut einen Vorschlag erzeugen.</div>
    <button class="btn btn-primary btn-full" id="confirmDismissBookBtn" style="margin-bottom:10px">Ja, verwerfen</button>
    <button class="btn btn-glass btn-full" onclick="closeSheet()">Abbrechen</button>
  `);
  document.getElementById('confirmDismissBookBtn').onclick = async () => {
    closeSheet();
    try {
      await api(`/accounting/proposals/${proposalId}/dismiss`, { method: 'POST' });
      toast('Verworfen', 'Der Buchungsvorschlag wurde entfernt.', 'success');
    } catch (err) {
      toast('Verwerfen fehlgeschlagen', err.message, 'error');
    }
    navigateTo('approvals');
  };
}

// Nachbestellung als "bestellt" markieren – deine Einkaufs-Entscheidung.
// Kein externer Versand, keine Buchung, kein Eingriff in Shopify: nur eine
// nachvollziehbare Notiz, damit der Vorschlag aus der Liste verschwindet und
// nicht doppelt vorgeschlagen wird. Trotzdem kurze Rückfrage, damit die
// Entscheidung bewusst bleibt.
function confirmMarkOrdered(taskId, productTitle, qty) {
  openSheet(`
    <div class="sheet-title">Als bestellt markieren?</div>
    <div class="sheet-sub">Du bestätigst, dass du <b>${qty} Stück</b> von „${escapeHtml(productTitle)}" bei deinem Lieferanten nachbestellt hast. Das ist nur eine Notiz für dich – es wird nichts automatisch bestellt, verbucht oder am Shopify-Bestand geändert.</div>
    <button class="btn btn-primary btn-full" id="confirmReorderBtn" style="margin-bottom:10px">Ja, als bestellt markieren</button>
    <button class="btn btn-glass btn-full" onclick="closeSheet()">Abbrechen</button>
  `);
  document.getElementById('confirmReorderBtn').onclick = async () => {
    const btn = document.getElementById('confirmReorderBtn');
    btn.disabled = true; btn.innerHTML = '<div class="spinner"></div>';
    try {
      await api(`/reorder/tasks/${taskId}/order`, { method: 'POST' });
      closeSheet();
      toast('Notiert', `„${productTitle}" ist als bestellt markiert.`, 'success');
    } catch (err) {
      toast('Fehlgeschlagen', err.message, 'error');
    }
    navigateTo('approvals');
  };
}

function confirmDismissReorder(taskId) {
  openSheet(`
    <div class="sheet-title">Nachbestell-Vorschlag verwerfen?</div>
    <div class="sheet-sub">Der Vorschlag wird entfernt. Bleibt das Produkt knapp und gefragt, kann der Autopilot später erneut einen Vorschlag erzeugen.</div>
    <button class="btn btn-primary btn-full" id="confirmDismissReorderBtn" style="margin-bottom:10px">Ja, verwerfen</button>
    <button class="btn btn-glass btn-full" onclick="closeSheet()">Abbrechen</button>
  `);
  document.getElementById('confirmDismissReorderBtn').onclick = async () => {
    closeSheet();
    try {
      await api(`/reorder/tasks/${taskId}/dismiss`, { method: 'POST' });
      toast('Verworfen', 'Der Vorschlag wurde entfernt.', 'success');
    } catch (err) {
      toast('Verwerfen fehlgeschlagen', err.message, 'error');
    }
    navigateTo('approvals');
  };
}

// Wareneingang erfassen: kleines Formular für den echten Netto-Betrag der
// Lieferanten-Rechnung (vorbelegt mit der Schätzung, editierbar) und die
// Zahlweise. Daraus entsteht ein Wareneinkaufs-Buchungsvorschlag - verbucht
// wird er erst später im Buchhaltungs-Abschnitt (bewusst zweistufig, damit die
// echte Buchung immer über denselben geprüften "Verbuchen"-Pfad läuft).
function openReceiveReorder(taskId, productTitle, netDefault) {
  openSheet(`
    <div class="sheet-title">Wareneingang buchen</div>
    <div class="sheet-sub">Erfasse die Lieferanten-Rechnung für „${escapeHtml(productTitle)}". Daraus wird ein Buchungsvorschlag (Wareneingang + Vorsteuer) – echt verbucht wird er erst nach deiner Freigabe im Buchhaltungs-Abschnitt.</div>
    <div class="field">
      <label class="field-label">Netto-Einkaufsbetrag (ohne USt)</label>
      <input class="input" id="receiveNet" type="text" inputmode="decimal" value="${escapeHtml(netDefault)}" placeholder="z.B. 131,20">
    </div>
    <div class="field">
      <label class="field-label">Zahlweise</label>
      <select class="input" id="receivePayment">
        <option value="verbindlichkeiten">Auf Rechnung (noch offen)</option>
        <option value="bank">Sofort bezahlt (Bank)</option>
      </select>
    </div>
    <button class="btn btn-primary btn-full" id="confirmReceiveBtn" style="margin-bottom:10px">Buchungsvorschlag anlegen</button>
    <button class="btn btn-glass btn-full" onclick="closeSheet()">Abbrechen</button>
  `);
  document.getElementById('confirmReceiveBtn').onclick = async () => {
    const netAmount = (document.getElementById('receiveNet').value || '').trim();
    const payment = document.getElementById('receivePayment').value;
    const btn = document.getElementById('confirmReceiveBtn');
    btn.disabled = true; btn.innerHTML = '<div class="spinner"></div>';
    try {
      await api(`/reorder/tasks/${taskId}/receive`, { method: 'POST', body: { netAmount, payment } });
      closeSheet();
      toast('Wareneingang erfasst', 'Ein Wareneinkaufs-Buchungsvorschlag wartet jetzt im Buchhaltungs-Abschnitt auf deine Freigabe.', 'success');
    } catch (err) {
      btn.disabled = false; btn.textContent = 'Buchungsvorschlag anlegen';
      toast('Fehlgeschlagen', err.message, 'error');
      return;
    }
    navigateTo('approvals');
  };
}

// Design (Optik) anwenden – bewusst SICHER: nur auf die Entwurfs-Kopie,
// nie live. Nach dem Anwenden gibt es einen Vorschau-Link und die Option,
// direkt zu veröffentlichen (mit eigenem, starkem Dialog).
function confirmApplyDesign(suggestionId, paletteName) {
  openSheet(`
    <div class="sheet-title">Design auf Entwurfs-Kopie anwenden?</div>
    <div class="sheet-sub">Die Palette „${escapeHtml(paletteName)}" wird auf eine <b>Entwurfs-Kopie</b> deines Themes angewendet – dein Live-Shop bleibt unverändert. Danach bekommst du einen Vorschau-Link. Existiert noch keine Kopie, wird sie jetzt angelegt (das kann einen Moment dauern).</div>
    <button class="btn btn-primary btn-full" id="confirmDesignBtn" style="margin-bottom:10px">Ja, auf Entwurf anwenden</button>
    <button class="btn btn-glass btn-full" onclick="closeSheet()">Abbrechen</button>
  `);

  document.getElementById('confirmDesignBtn').onclick = async () => {
    const btn = document.getElementById('confirmDesignBtn');
    btn.disabled = true; btn.innerHTML = '<div class="spinner"></div>';
    try {
      const res = await api(`/storefront/suggestions/${suggestionId}/apply`, { method: 'POST' });
      openSheet(`
        <div class="sheet-title">Auf Entwurf angewendet ✓</div>
        <div class="sheet-sub">„${escapeHtml(paletteName)}" liegt jetzt auf der Entwurfs-Kopie (${res.changes ?? 0} Farbwerte gesetzt). Dein Live-Shop ist unverändert – sieh es dir in Ruhe an.</div>
        ${res.previewUrl ? `<a class="btn btn-glass btn-full" href="${res.previewUrl}" target="_blank" rel="noopener" style="margin-bottom:10px">Vorschau öffnen</a>` : ''}
        <button class="btn btn-primary btn-full" id="publishFromDesignBtn" style="margin-bottom:10px">Jetzt veröffentlichen</button>
        <button class="btn btn-glass btn-full" onclick="closeSheet()">Später</button>
      `);
      const pub = document.getElementById('publishFromDesignBtn');
      if (pub) pub.onclick = () => confirmPublishTheme(res.draftThemeId, 'SRDF-OS Entwurf');
    } catch (err) {
      toast('Anwenden fehlgeschlagen', err.message, 'error');
      navigateTo('approvals');
    }
  };
}

// Der EINZIGE echte Live-Schritt der Optik: den Entwurf zum Live-Theme
// machen. Deutlicher Dialog, weil es sofort für alle Besucher sichtbar wird.
function confirmPublishTheme(themeId, name) {
  if (!themeId) { toast('Kein Entwurf', 'Es gibt noch keine Entwurfs-Kopie zum Veröffentlichen.', 'info'); return; }
  openSheet(`
    <div class="sheet-title">Entwurf jetzt live veröffentlichen?</div>
    <div class="sheet-sub">Der Entwurf „${escapeHtml(name || '')}" wird zu deinem <b>LIVE-Theme</b> – ab sofort für alle Besucher sichtbar. Dein bisheriges Theme bleibt als Entwurf erhalten, du kannst also jederzeit zurückwechseln.</div>
    <button class="btn btn-primary btn-full" id="confirmPublishBtn" style="margin-bottom:10px">Ja, live veröffentlichen</button>
    <button class="btn btn-glass btn-full" onclick="closeSheet()">Abbrechen</button>
  `);

  document.getElementById('confirmPublishBtn').onclick = async () => {
    const btn = document.getElementById('confirmPublishBtn');
    btn.disabled = true; btn.innerHTML = '<div class="spinner"></div>';
    await withActivity(async () => {
      try {
        await api(`/storefront/themes/${themeId}/publish`, { method: 'POST' });
        closeSheet();
        toast('Veröffentlicht', 'Dein neues Design ist jetzt live.', 'success');
      } catch (err) {
        toast('Veröffentlichen fehlgeschlagen', err.message, 'error');
      }
      navigateTo('approvals');
    });
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
