// ═══════════════════════════════════════════════════════════
// FREIGABE-CENTER · ein Posteingang für alles, was auf dich wartet
// ═══════════════════════════════════════════════════════════
// Bündelt an EINER Stelle alles, was deine ausdrückliche Bestätigung
// braucht: KI- und manuelle Post-Entwürfe, fehlgeschlagene Beiträge,
// kritische Lagerbestände und offene Kampagnen-Ideen. Nichts geht hier
// automatisch live - jede echte Aktion nutzt dieselben geprüften
// Endpunkte (und denselben "Wirklich?"-Dialog) wie der Social-Tab.

async function renderApprovals(view) {
  const data = await api('/approvals/pending');
  const postDrafts = data.postDrafts || [];
  const failedPosts = data.failedPosts || [];
  const lowStock = data.lowStock || [];
  const seasonalIdeas = data.seasonalIdeas || [];

  const actionable = postDrafts.length + failedPosts.length;
  const totalWaiting = actionable + lowStock.length;

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

  view.innerHTML = `${headerHtml}${draftsHtml}${failedHtml}${lowStockHtml}${ideasHtml}`;

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

  const goShopifyBtn = document.getElementById('goShopifyBtn');
  if (goShopifyBtn) goShopifyBtn.onclick = () => navigateTo('shopify');
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
