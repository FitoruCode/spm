document.addEventListener('DOMContentLoaded', () => {
  const authForm    = document.getElementById('auth-form');
  const authUser    = document.getElementById('auth-user');
  const authPass    = document.getElementById('auth-pass');
  const fileInput   = document.getElementById('file-input');
  const dropZone    = document.getElementById('drop-zone');
  const dropIcon    = document.getElementById('drop-icon');
  const dropText    = document.getElementById('drop-text');
  const dropHint    = document.getElementById('drop-hint');
  const fileInfo    = document.getElementById('file-info');
  const submitBtn   = document.getElementById('auth-submit-btn');
  const btnLabel    = document.getElementById('btn-label');
  const btnSpinner  = document.getElementById('btn-spinner');
  const msgBox      = document.getElementById('message-box');
  const subtitle    = document.getElementById('auth-subtitle');
  const modeHint    = document.getElementById('mode-hint');
  const modeSwitchBtn = document.getElementById('mode-switch-btn');

  let fileNumber = null;
  let isRegistered = false;

  function showMessage(text, type = 'error') {
    msgBox.textContent = text;
    msgBox.className = type === 'error' ? 'msg-error' : 'msg-success';
    msgBox.classList.remove('hidden');
    if (type === 'success') {
      setTimeout(() => msgBox.classList.add('hidden'), 4000);
    }
  }

  function setLoading(loading) {
    submitBtn.disabled = loading || !fileNumber;
    btnLabel.classList.toggle('hidden', loading);
    btnSpinner.classList.toggle('hidden', !loading);
  }

  function setMode(registered) {
    isRegistered = registered;
    if (registered) {
      subtitle.textContent = 'Unlock your vault';
      btnLabel.textContent = 'Unlock';
      modeHint.textContent = "Don't have an account?";
      modeSwitchBtn.textContent = 'Register instead';
    } else {
      subtitle.textContent = 'Create your secure vault';
      btnLabel.textContent = 'Create Vault';
      modeHint.textContent = 'Already registered?';
      modeSwitchBtn.textContent = 'Login instead';
    }
  }

  browser.runtime.sendMessage({ action: 'get_status' }).then(res => {
    setMode(res.isRegistered);
    if (res.isLoggedIn) {
      showMessage('Already unlocked! You can close this tab.', 'success');
    }
    authUser.focus();
  });

  modeSwitchBtn.addEventListener('click', () => {
    setMode(!isRegistered);
    msgBox.classList.add('hidden');
    authForm.reset();
    resetFile();
  });

  async function processFile(file) {
    if (!file) return;
    if (!file.name.endsWith('.txt') && file.type !== 'text/plain') {
      showMessage('Please select a .txt file.', 'error');
      return;
    }
    try {
      const text = await file.text();
      if (!text.trim()) {
        showMessage('Key file is empty. Please choose a non-empty .txt file.', 'error');
        return;
      }
      fileNumber = await CryptoUtils.fileTextToNumber(text);
      dropZone.classList.add('loaded');
      dropIcon.textContent = '✅';
      dropText.textContent = file.name;
      dropHint.classList.add('hidden');
      fileInfo.textContent = `Key loaded · ${(file.size / 1024).toFixed(1)} KB`;
      fileInfo.classList.remove('hidden');
      submitBtn.disabled = false;
      msgBox.classList.add('hidden');
    } catch (e) {
      showMessage('Failed to read file: ' + e.message, 'error');
    }
  }

  function resetFile() {
    fileNumber = null;
    fileInput.value = '';
    dropZone.classList.remove('loaded', 'dragover');
    dropIcon.textContent = '📄';
    dropText.textContent = 'Drag & drop your key file here';
    dropHint.classList.remove('hidden');
    fileInfo.classList.add('hidden');
    submitBtn.disabled = true;
  }

  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) processFile(fileInput.files[0]);
  });

  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
  dropZone.addEventListener('dragleave', e => { if (!dropZone.contains(e.relatedTarget)) dropZone.classList.remove('dragover'); });
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  });

  document.addEventListener('dragover', e => e.preventDefault());
  document.addEventListener('drop', e => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  });

  authForm.addEventListener('submit', async e => {
    e.preventDefault();
    if (!fileNumber) { showMessage('Please select your key file first.', 'error'); return; }

    const username = authUser.value.trim();
    const password = authPass.value;
    const action = isRegistered ? 'login' : 'register';

    setLoading(true);
    msgBox.classList.add('hidden');

    try {
      const res = await browser.runtime.sendMessage({ action, username, password, fileNumber });
      if (res.error) {
        showMessage(res.error, 'error');
        setLoading(false);
      } else {
        showMessage(
          isRegistered ? 'Unlocked! Closing…' : 'Vault created! Closing…',
          'success'
        );
        setTimeout(() => window.close(), 900);
      }
    } catch (err) {
      showMessage('Communication error: ' + err.message, 'error');
      setLoading(false);
    }
  });
});
