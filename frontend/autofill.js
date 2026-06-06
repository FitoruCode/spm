function attemptAutofill() {
  const passwordInputs = document.querySelectorAll('input[type="password"]');
  if (passwordInputs.length === 0) return;

  const hostname = window.location.hostname;

  chrome.runtime.sendMessage({ action: "get_credentials_for_url", hostname: hostname })
    .then(response => {
      if (!response || !response.credentials || response.credentials.length === 0) {
        return;
      }

      const { username, password } = response.credentials[0];

      passwordInputs.forEach(passwordInput => {
        if (passwordInput.dataset.spmAutofilled) return;
        passwordInput.dataset.spmAutofilled = "true";

        const formElements = Array.from(passwordInput.form ? passwordInput.form.elements : document.body.querySelectorAll('input'));
        const passIndex = formElements.indexOf(passwordInput);

        let usernameInput = null;
        for (let i = passIndex - 1; i >= 0; i--) {
          const el = formElements[i];
          if (el.tagName === 'INPUT' && (el.type === 'text' || el.type === 'email' || el.type === 'number')) {
            usernameInput = el;
            break;
          }
        }

        if (usernameInput) {
          usernameInput.value = username;
          usernameInput.dispatchEvent(new Event('input', { bubbles: true }));
          usernameInput.dispatchEvent(new Event('change', { bubbles: true }));
        }

        passwordInput.value = password;
        passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
        passwordInput.dispatchEvent(new Event('change', { bubbles: true }));
      });
    })
    .catch(err => {
      console.error("Autofill error:", err);
    });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', attemptAutofill);
} else {
  attemptAutofill();
}

const observer = new MutationObserver(() => {
  const emptyPasswordInputs = Array.from(document.querySelectorAll('input[type="password"]')).filter(input => !input.dataset.spmAutofilled);
  if (emptyPasswordInputs.length > 0) {
    attemptAutofill();
  }
});

observer.observe(document.body, { childList: true, subtree: true });
