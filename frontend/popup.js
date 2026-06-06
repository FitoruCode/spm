document.addEventListener('DOMContentLoaded', () => {
  const DOM = {
    viewLocked:    document.getElementById('view-locked'),
    viewVault:     document.getElementById('view-vault'),
    openAuthBtn:   document.getElementById('open-auth-btn'),
    logoutBtn:     document.getElementById('logout-btn'),
    msgBox:        document.getElementById('message-box'),

    searchInput:   document.getElementById('search-input'),
    toggleAddBtn:  document.getElementById('toggle-add-btn'),
    addEntryForm:  document.getElementById('add-entry-form'),
    entriesList:   document.getElementById('entries-list'),

    entrySite:     document.getElementById('entry-site'),
    entryUser:     document.getElementById('entry-user'),
    entryPass:     document.getElementById('entry-pass')
  };

  // ── Helpers ────────────────────────────────────────────────────────────────
  function showMessage(msg, isError = false) {
    DOM.msgBox.textContent = msg;
    DOM.msgBox.className = isError ? 'msg-error' : 'msg-success';
    DOM.msgBox.classList.remove('hidden');
    setTimeout(() => DOM.msgBox.classList.add('hidden'), 3000);
  }

  function setView(isLoggedIn) {
    if (isLoggedIn) {
      DOM.viewLocked.classList.add('hidden');
      DOM.viewVault.classList.remove('hidden');
      DOM.logoutBtn.classList.remove('hidden');
      loadEntries();
      DOM.searchInput.focus();
    } else {
      DOM.viewLocked.classList.remove('hidden');
      DOM.viewVault.classList.add('hidden');
      DOM.logoutBtn.classList.add('hidden');
    }
  }

  // ── Init ───────────────────────────────────────────────────────────────────
  browser.runtime.sendMessage({ action: 'get_status' }).then(res => {
    setView(res.isLoggedIn);
  });

  // ── Open auth tab ──────────────────────────────────────────────────────────
  DOM.openAuthBtn.addEventListener('click', () => {
    browser.tabs.create({ url: browser.runtime.getURL('frontend/auth.html') });
    window.close();
  });

  // ── Logout / Lock ──────────────────────────────────────────────────────────
  DOM.logoutBtn.addEventListener('click', () => {
    browser.runtime.sendMessage({ action: 'logout' }).then(() => {
      setView(false);
    });
  });

  // ── Toggle Add Form ────────────────────────────────────────────────────────
  DOM.toggleAddBtn.addEventListener('click', () => {
    DOM.addEntryForm.classList.toggle('hidden');
    if (!DOM.addEntryForm.classList.contains('hidden')) {
      DOM.entrySite.focus();
    }
  });

  // ── Add Entry ──────────────────────────────────────────────────────────────
  DOM.addEntryForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const website  = DOM.entrySite.value;
    const username = DOM.entryUser.value;
    const password = DOM.entryPass.value;

    browser.runtime.sendMessage({ action: 'add_entry', website, username, password }).then(res => {
      if (res.error) {
        showMessage(res.error, true);
      } else {
        showMessage('Entry saved!');
        DOM.addEntryForm.reset();
        DOM.addEntryForm.classList.add('hidden');
        loadEntries(DOM.searchInput.value);
      }
    });
  });

  // ── Search ─────────────────────────────────────────────────────────────────
  DOM.searchInput.addEventListener('input', (e) => {
    loadEntries(e.target.value);
  });

  // ── Load Entries ───────────────────────────────────────────────────────────
  function loadEntries(regex = '') {
    browser.runtime.sendMessage({ action: 'search_entries', regex }).then(res => {
      if (res.error) { showMessage(res.error, true); return; }

      DOM.entriesList.innerHTML = '';
      const items = res.results || [];
      if (items.length === 0) {
        DOM.entriesList.innerHTML = '<li style="text-align:center; color:gray; font-size:0.9rem; margin-top:20px;">No entries found.</li>';
        return;
      }

      items.forEach(entry => {
        const li = document.createElement('li');
        li.className = 'entry-card';

        const entryId = entry.id || (entry.website + '|' + entry.username + '|' + entry.timestamp);
        li.innerHTML = `
          <div class="entry-header">
            <div class="entry-site">${escapeHtml(entry.website)}</div>
            <button class="delete-btn" data-id="${escapeHtml(entryId)}">✕</button>
          </div>
          <div class="entry-user">${escapeHtml(entry.username)}</div>
          <div class="entry-pass-container">
            <span class="entry-pass-value">••••••••</span>
            <button class="copy-btn">Copy</button>
          </div>
        `;

        const copyBtn = li.querySelector('.copy-btn');
        const delBtn  = li.querySelector('.delete-btn');

        delBtn.addEventListener('click', () => {
          if (confirm('Delete this entry?')) {
            browser.runtime.sendMessage({ action: 'delete_entry', id: entryId }).then(res => {
              if (res.error) showMessage(res.error, true);
              else loadEntries(DOM.searchInput.value);
            });
          }
        });
        copyBtn.addEventListener('click', () => {
          navigator.clipboard.writeText(entry.password).then(() => {
            copyBtn.textContent = 'Copied!';
            setTimeout(() => copyBtn.textContent = 'Copy', 2000);
          });
        });

        DOM.entriesList.appendChild(li);
      });
    });
  }

  // ── Listen for auth tab completion ─────────────────────────────────────────
  // When the auth tab calls window.close() after success, re-check our status
  browser.tabs.onRemoved.addListener(() => {
    browser.runtime.sendMessage({ action: 'get_status' }).then(res => {
      if (res.isLoggedIn) setView(true);
    });
  });

  function escapeHtml(unsafe) {
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
});
