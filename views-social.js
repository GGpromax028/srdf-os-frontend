// ═══════════════════════════════════════════════════════════
// SOCIAL-VIEW
// ═══════════════════════════════════════════════════════════
const PLATFORM_META = {
  instagram: { icon: '◈', label: 'Instagram', live: true },
  pinterest: { icon: '▣', label: 'Pinterest', live: true },
  tiktok: { icon: '▲', label: 'TikTok', live: false },
};

async function renderSocial(view) {
  const [accounts, posts, pinterestStatus] = await Promise.all([
    api('/social/accounts'),
    api('/social/posts'),
    api('/social/pinterest/status').catch(() => ({ configured: false, appConfigured: false })),
  ]);
  state.socialAccounts = accounts;
  state.pinterestStatus = pinterestStatus;

  view.innerHTML = `
    <div class="section-h">Verbundene Konten</div>
    <div class="glass" id="accountsList"></div>

    <div class="section-h" style="display:flex;justify-content:space-between;align-items:center">
      <span>Beiträge</span>
      <button class="btn btn-primary" id="newDraftBtn" style="padding:8px 14px;font-size:12.5px">+ Entwurf</button>
    </div>
    <div class="glass" id="postsList"></div>
  `;

  renderAccountsList(accounts);
  renderPostsList(posts);

  document.getElementById('newDraftBtn').onclick = openNewDraftSheet;
}

function renderAccountsList(accounts) {
  const el = document.getElementById('accountsList');
  el.innerHTML = accounts.map(acc => {
    const meta = PLATFORM_META[acc.platform];
    const pStatus = state.pinterestStatus || {};
    const needsPinterestConnect = acc.platform === 'pinterest' && meta.live && !pStatus.configured;

    let statusBadge;
    if (!meta.live) {
      statusBadge = `<span class="badge badge-gray">Review ausstehend</span>`;
    } else if (needsPinterestConnect) {
      statusBadge = pStatus.appConfigured
        ? `<span class="badge badge-gray">Noch nicht verbunden</span>`
        : `<span class="badge badge-gray">App-Zugangsdaten fehlen in .env</span>`;
    } else if (acc.connected) {
      statusBadge = `<span class="badge badge-green">Verbunden${acc.account_label ? ' · @' + escapeHtml(acc.account_label) : ''}</span>`;
    } else {
      statusBadge = `<span class="badge badge-gray">Nicht verbunden</span>`;
    }

    let actionButton = '';
    if (needsPinterestConnect && pStatus.appConfigured) {
      actionButton = `<a class="btn btn-primary" href="${API_BASE}/social/pinterest/oauth/start" target="_blank" rel="noopener" style="padding:9px 14px;font-size:12px;text-decoration:none">Mit Pinterest verbinden</a>`;
    } else if (meta.live && !needsPinterestConnect) {
      actionButton = `<button class="btn btn-glass" style="padding:9px 14px;font-size:12px" data-test-platform="${acc.platform}">Testen</button>`;
    }

    return `
      <div class="row">
        <div class="row-icon">${meta.icon}</div>
        <div class="row-text">
          <div class="row-title">${meta.label}</div>
          <div class="row-sub" style="margin-top:4px">${statusBadge}</div>
        </div>
        ${actionButton}
        ${acc.platform === 'pinterest' && meta.live && pStatus.configured ? `<button class="btn btn-glass" style="padding:9px 14px;font-size:12px;margin-left:6px" data-pinterest-board="1">Board wählen</button>` : ''}
      </div>`;
  }).join('');

  el.querySelectorAll('[data-test-platform]').forEach(btn => {
    btn.onclick = async () => {
      const platform = btn.dataset.testPlatform;
      await withActivity(async () => {
        try {
          const result = await api(`/social/${platform}/test-connection`);
          toast('Verbindung erfolgreich', `Angemeldet als @${result.username || result.name}`, 'success');
          navigateTo('social');
        } catch (err) {
          toast('Verbindung fehlgeschlagen', err.message, 'error');
        }
      });
    };
  });

  el.querySelectorAll('[data-pinterest-board]').forEach(btn => {
    btn.onclick = openPinterestBoardSheet;
  });
}

async function openPinterestBoardSheet() {
  let boards;
  try {
    boards = await api('/social/pinterest/boards');
  } catch (err) {
    toast('Boards konnten nicht geladen werden', err.message, 'error');
    return;
  }

  if (boards.length === 0) {
    openSheet(`
      <div class="sheet-title">Kein Pinterest-Board gefunden</div>
      <div class="sheet-sub">Erstelle zuerst ein Board direkt in der Pinterest-App — danach erscheint es hier zur Auswahl.</div>
      <button class="btn btn-glass btn-full" onclick="closeSheet()">Verstanden</button>`);
    return;
  }

  openSheet(`
    <div class="sheet-title">Standard-Board wählen</div>
    <div class="sheet-sub">Neue Pinterest-Beiträge landen in diesem Board.</div>
    <div class="field" style="margin-bottom:18px">
      <select class="input" id="boardSelect" style="appearance:none">
        ${boards.map(b => `<option value="${escapeHtml(b.id)}">${escapeHtml(b.name)}</option>`).join('')}
      </select>
    </div>
    <button class="btn btn-primary btn-full" id="saveBoardBtn">Speichern</button>
  `);

  document.getElementById('saveBoardBtn').onclick = async () => {
    const boardId = document.getElementById('boardSelect').value;
    try {
      await api('/social/pinterest/default-board', { method: 'PUT', body: { boardId } });
      closeSheet();
      toast('Board gespeichert', '', 'success');
    } catch (err) {
      toast('Speichern fehlgeschlagen', err.message, 'error');
    }
  };
}

const STATUS_META = {
  draft: { label: 'Entwurf', badge: 'gray' },
  scheduled: { label: 'Geplant', badge: 'blue' },
  publishing: { label: 'Wird veröffentlicht…', badge: 'amber' },
  published: { label: 'Veröffentlicht', badge: 'green' },
  failed: { label: 'Fehlgeschlagen', badge: 'red' },
};

function renderPostsList(posts) {
  const el = document.getElementById('postsList');
  if (posts.length === 0) {
    el.innerHTML = emptyState('◈', 'Noch keine Beiträge', 'Lege einen Entwurf an — er geht erst live, wenn du ihn ausdrücklich freigibst.');
    return;
  }

  el.innerHTML = posts.map(p => {
    const sm = STATUS_META[p.status] || STATUS_META.draft;
    const meta = PLATFORM_META[p.platform] || { icon: '○', label: p.platform };
    return `
      <div class="row" data-post-id="${p.id}">
        <div class="row-icon">${meta.icon}</div>
        <div class="row-text">
          <div class="row-title">${escapeHtml((p.caption || 'Ohne Text').slice(0, 40))}${p.created_by_ai ? ' <span style="opacity:.5">✦KI</span>' : ''}</div>
          <div class="row-sub"><span class="badge badge-${sm.badge}" style="margin-right:6px">${sm.label}</span>${meta.label}</div>
        </div>
        ${p.status === 'draft' && meta.live ? `<button class="btn btn-primary" style="padding:9px 14px;font-size:12px" data-publish="${p.id}">Posten</button>` : ''}
      </div>`;
  }).join('');

  el.querySelectorAll('[data-publish]').forEach(btn => {
    btn.onclick = () => {
      const post = posts.find(p => p.id === Number(btn.dataset.publish));
      const label = (PLATFORM_META[post?.platform] || {}).label || post?.platform || 'der Plattform';
      confirmPublish(Number(btn.dataset.publish), label);
    };
  });
}

function confirmPublish(postId, platformLabel) {
  openSheet(`
    <div class="sheet-title">Wirklich jetzt veröffentlichen?</div>
    <div class="sheet-sub">Dieser Beitrag geht echt live auf ${escapeHtml(platformLabel)} — sichtbar für deine echten Follower. Das lässt sich danach nicht zurücknehmen.</div>
    <button class="btn btn-primary btn-full" id="confirmPublishBtn" style="margin-bottom:10px">Ja, jetzt veröffentlichen</button>
    <button class="btn btn-glass btn-full" onclick="closeSheet()">Abbrechen</button>
  `);

  document.getElementById('confirmPublishBtn').onclick = async () => {
    closeSheet();
    await withActivity(async () => {
      try {
        await api(`/social/posts/${postId}/publish`, { method: 'POST' });
        toast('Veröffentlicht', `Dein Beitrag ist jetzt echt live auf ${platformLabel}.`, 'success');
        navigateTo('social');
      } catch (err) {
        toast('Veröffentlichung fehlgeschlagen', err.message, 'error');
        navigateTo('social');
      }
    });
  };
}

function openNewDraftSheet() {
  openSheet(`
    <div class="sheet-title">Neuer Entwurf</div>
    <div class="sheet-sub">Wird als Entwurf gespeichert — geht nicht automatisch live.</div>
    <div class="field">
      <label class="field-label">Plattform</label>
      <select class="input" id="draftPlatform" style="appearance:none">
        <option value="instagram">Instagram</option>
        <option value="pinterest">Pinterest</option>
        <option value="tiktok">TikTok (Posten erst nach Review möglich)</option>
      </select>
    </div>
    <div class="field">
      <label class="field-label">Bild-URL (öffentlich erreichbar)</label>
      <input class="input" id="draftMediaUrl" placeholder="https://...">
    </div>
    <div class="field" style="margin-bottom:18px">
      <label class="field-label">Caption</label>
      <textarea class="input" id="draftCaption" placeholder="Text zum Beitrag..."></textarea>
    </div>
    <button class="btn btn-primary btn-full" id="saveDraftBtn">Entwurf speichern</button>
  `);

  document.getElementById('saveDraftBtn').onclick = async () => {
    const platform = document.getElementById('draftPlatform').value;
    const mediaUrl = document.getElementById('draftMediaUrl').value.trim();
    const caption = document.getElementById('draftCaption').value.trim();

    try {
      await api('/social/posts/draft', { method: 'POST', body: { platform, mediaUrl, caption } });
      closeSheet();
      toast('Entwurf gespeichert', 'Du findest ihn in der Liste — geht erst live nach deiner Freigabe.', 'success');
      navigateTo('social');
    } catch (err) {
      toast('Speichern fehlgeschlagen', err.message, 'error');
    }
  };
}
