// ═══════════════════════════════════════════════════════════
// CHAT-ASSISTENT · Fragen in normaler Sprache zu deinem echten Shop
// ═══════════════════════════════════════════════════════════
// Der Assistent kann NUR lesen (Umsatz, Bestand, Margen abfragen),
// nichts verändern. Jede echte Aktion bleibt in den jeweiligen Tabs.

async function renderChat(view) {
  if (!state.aiConfigured) {
    view.innerHTML = notConfiguredCard(
      'Chat-Assistent ist noch nicht verfügbar',
      'Trage ANTHROPIC_API_KEY in die .env-Datei des Backends ein, um den Chat zu nutzen.'
    );
    return;
  }

  view.innerHTML = `
    <div class="glass" style="padding:12px; margin-bottom:12px; font-size:12px; color:var(--ink-dim)">
      💬 Frag mich z.B. "Wie lief der letzte Monat?", "Welches Produkt hat die schlechteste Marge?" oder "Was sollte ich nachbestellen?". Ich lese nur deine echten Daten — ich kann nichts verändern, bestellen oder posten.
    </div>
    <div id="chatMessages" style="display:flex; flex-direction:column; gap:10px; margin-bottom:90px"></div>

    <div style="position:fixed; bottom:78px; left:0; right:0; padding:10px 16px; background:var(--bg-elevated, rgba(20,20,22,.92)); backdrop-filter:blur(20px); border-top:1px solid rgba(255,255,255,.08)">
      <div style="display:flex; gap:8px; max-width:600px; margin:0 auto">
        <input class="input" id="chatInput" placeholder="Frag etwas zu deinem Shop…" style="flex:1; margin:0" autocomplete="off">
        <button class="btn btn-primary" id="chatSendBtn" style="padding:11px 18px; white-space:nowrap">Senden</button>
      </div>
    </div>
  `;

  await loadChatHistory();

  const input = document.getElementById('chatInput');
  const sendBtn = document.getElementById('chatSendBtn');

  const send = () => sendChatMessageUi(input, sendBtn);
  sendBtn.onclick = send;
  input.onkeydown = (e) => { if (e.key === 'Enter') send(); };
}

async function loadChatHistory() {
  const container = document.getElementById('chatMessages');
  try {
    const history = await api('/chat/history');
    if (history.length === 0) {
      container.innerHTML = `<div class="empty"><div class="empty-icon">💬</div><div class="empty-title">Noch kein Gespräch</div><div class="empty-sub">Stell deine erste Frage unten.</div></div>`;
      return;
    }
    container.innerHTML = history.map(renderChatBubble).join('');
    scrollChatToBottom();
  } catch (err) {
    container.innerHTML = `<div class="empty"><div class="empty-sub">${escapeHtml(err.message)}</div></div>`;
  }
}

function renderChatBubble(msg) {
  const isUser = msg.role === 'user';
  return `
    <div style="display:flex; justify-content:${isUser ? 'flex-end' : 'flex-start'}">
      <div class="glass" style="max-width:80%; padding:11px 14px; ${isUser ? 'background:var(--depth-blue, #0a84ff); color:white' : ''}; border-radius:14px; font-size:14px; line-height:1.5; white-space:pre-wrap">${escapeHtml(msg.content)}</div>
    </div>`;
}

function scrollChatToBottom() {
  window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
}

async function sendChatMessageUi(input, sendBtn) {
  const message = input.value.trim();
  if (!message) return;

  const container = document.getElementById('chatMessages');
  // Eigene Nachricht direkt anzeigen, ohne auf den Server zu warten
  // (fühlt sich sofort responsiv an statt verzögert).
  if (container.querySelector('.empty')) container.innerHTML = '';
  container.insertAdjacentHTML('beforeend', renderChatBubble({ role: 'user', content: message }));
  scrollChatToBottom();

  input.value = '';
  input.disabled = true;
  sendBtn.disabled = true;
  sendBtn.innerHTML = '<div class="spinner"></div>';

  // Eigener "Tippt..."-Platzhalter, während die Antwort kommt
  const thinkingId = `thinking-${Date.now()}`;
  container.insertAdjacentHTML('beforeend', `
    <div id="${thinkingId}" style="display:flex; justify-content:flex-start">
      <div class="glass" style="padding:11px 14px; border-radius:14px; font-size:13px; color:var(--ink-dim)">Denkt nach…</div>
    </div>`);
  scrollChatToBottom();

  try {
    const result = await api('/chat/message', { method: 'POST', body: { message } });
    document.getElementById(thinkingId)?.remove();
    container.insertAdjacentHTML('beforeend', renderChatBubble({ role: 'assistant', content: result.reply }));
    scrollChatToBottom();
  } catch (err) {
    document.getElementById(thinkingId)?.remove();
    container.insertAdjacentHTML('beforeend', `
      <div style="display:flex; justify-content:flex-start">
        <div class="glass" style="padding:11px 14px; border-radius:14px; font-size:13px; color:var(--danger)">⚠ ${escapeHtml(err.message)}</div>
      </div>`);
    scrollChatToBottom();
  } finally {
    input.disabled = false;
    sendBtn.disabled = false;
    sendBtn.textContent = 'Senden';
    input.focus();
  }
}
