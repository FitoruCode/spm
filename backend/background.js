let sessionKey = null;
let sessionKey2 = null;
let autoLockTimer = null;

function resetAutoLock() {
  if (autoLockTimer) clearTimeout(autoLockTimer);
  autoLockTimer = setTimeout(() => {
    sessionKey = null;
    sessionKey2 = null;
  }, 15 * 60 * 1000);
}

browser.runtime.onInstalled.addListener(() => {
  browser.storage.local.get(['authData', 'entries']).then(data => {
    let updates = {};
    if (!data.authData) updates.authData = null;
    if (!data.entries) updates.entries = [];
    if (Object.keys(updates).length > 0) {
      browser.storage.local.set(updates);
    }
  });
});

async function handleRegister(username, password, fileNumber) {
  const data = await browser.storage.local.get(['authData']);
  if (data.authData) {
    throw new Error("Already registered. Please login.");
  }

  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
  if (!passwordRegex.test(password)) {
    throw new Error("Master password must be 8+ chars and include a lowercase, uppercase, digit, and special character.");
  }

  if (!fileNumber) {
    throw new Error("A key file (.txt) is required for registration.");
  }

  const salt = CryptoUtils.generateSalt();
  const salt2 = CryptoUtils.generateSalt();

  // Verification hash includes password + salt + fileNumber
  const hashVerify = await CryptoUtils.hashString(password + salt + fileNumber);

  sessionKey = await CryptoUtils.deriveKey(password, salt);
  sessionKey2 = await CryptoUtils.deriveKey2(fileNumber, salt2);
  resetAutoLock();

  await browser.storage.local.set({
    authData: { salt, salt2, verify: hashVerify, username }
  });

  return { success: true };
}

async function handleLogin(username, password, fileNumber) {
  const data = await browser.storage.local.get(['authData']);
  if (!data.authData) {
    throw new Error("Not registered yet.");
  }

  if (!fileNumber) {
    throw new Error("A key file (.txt) is required for login.");
  }

  const { salt, salt2, verify, username: storedUsername } = data.authData;
  if (username !== storedUsername) {
    throw new Error("Invalid username.");
  }

  const hashVerify = await CryptoUtils.hashString(password + salt + fileNumber);
  if (hashVerify !== verify) {
    throw new Error("Invalid credentials or key file.");
  }

  sessionKey = await CryptoUtils.deriveKey(password, salt);
  sessionKey2 = await CryptoUtils.deriveKey2(fileNumber, salt2);
  resetAutoLock();
  return { success: true };
}

async function handleAddEntry(website, entryUsername, entryPassword) {
  if (!sessionKey || !sessionKey2) throw new Error("Not authenticated");
  resetAutoLock();

  const dataToEncrypt = {
    id: crypto.randomUUID(),
    website,
    username: entryUsername,
    password: entryPassword,
    timestamp: Date.now()
  };

  const encryptedObj = await CryptoUtils.encryptData(dataToEncrypt, sessionKey, sessionKey2);

  const storageData = await browser.storage.local.get(['entries']);
  const entries = storageData.entries || [];
  entries.push(encryptedObj);

  await browser.storage.local.set({ entries });
  return { success: true };
}

async function handleDeleteEntry(id) {
  if (!sessionKey || !sessionKey2) throw new Error("Not authenticated");
  resetAutoLock();

  const storageData = await browser.storage.local.get(['entries']);
  const entries = storageData.entries || [];

  let entryIndexToRemove = -1;
  for (let i = 0; i < entries.length; i++) {
    try {
      const decrypted = await CryptoUtils.decryptData(entries[i], sessionKey, sessionKey2);
      const computedId = decrypted.id || (decrypted.website + "|" + decrypted.username + "|" + decrypted.timestamp);
      if (computedId === id) {
        entryIndexToRemove = i;
        break;
      }
    } catch (e) {}
  }

  if (entryIndexToRemove !== -1) {
    entries.splice(entryIndexToRemove, 1);
    await browser.storage.local.set({ entries });
    return { success: true };
  } else {
    throw new Error("Entry not found.");
  }
}

async function handleSearchEntries(regexStr) {
  if (!sessionKey || !sessionKey2) throw new Error("Not authenticated");
  resetAutoLock();

  const storageData = await browser.storage.local.get(['entries']);
  const entries = storageData.entries || [];

  let decryptedEntries = [];
  for (const encryptedObj of entries) {
    try {
      const decrypted = await CryptoUtils.decryptData(encryptedObj, sessionKey, sessionKey2);
      decryptedEntries.push(decrypted);
    } catch (e) {
      console.error("Failed to decrypt an entry", e);
    }
  }

  if (!regexStr) return { results: decryptedEntries };

  try {
    const regex = new RegExp(regexStr, 'i');
    const results = decryptedEntries.filter(entry =>
      regex.test(entry.website) || regex.test(entry.username)
    );
    return { results };
  } catch (e) {
    throw new Error(`Invalid regex: ${e.message}`);
  }
}

async function handleGetCredentialsForUrl(hostname) {
  if (!sessionKey || !sessionKey2) return { credentials: [] };
  resetAutoLock();

  const storageData = await browser.storage.local.get(['entries']);
  const entries = storageData.entries || [];

  let matches = [];
  for (const encryptedObj of entries) {
    try {
      const decrypted = await CryptoUtils.decryptData(encryptedObj, sessionKey, sessionKey2);
      if (decrypted.website && (hostname.includes(decrypted.website) || decrypted.website.includes(hostname))) {
        matches.push({ username: decrypted.username, password: decrypted.password });
      }
    } catch (e) {
      console.error("Failed to decrypt an entry", e);
    }
  }
  return { credentials: matches };
}

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "get_status") {
    browser.storage.local.get(['authData']).then(data => {
      sendResponse({
        isRegistered: !!data.authData,
        isLoggedIn: !!(sessionKey && sessionKey2)
      });
    });
    return true;
  }

  if (message.action === "register") {
    handleRegister(message.username, message.password, message.fileNumber)
      .then(res => sendResponse(res))
      .catch(err => sendResponse({ error: err.message }));
    return true;
  }

  if (message.action === "login") {
    handleLogin(message.username, message.password, message.fileNumber)
      .then(res => sendResponse(res))
      .catch(err => sendResponse({ error: err.message }));
    return true;
  }

  if (message.action === "logout") {
    sessionKey = null;
    sessionKey2 = null;
    if (autoLockTimer) clearTimeout(autoLockTimer);
    sendResponse({ success: true });
    return true;
  }

  if (message.action === "delete_entry") {
    handleDeleteEntry(message.id)
      .then(res => sendResponse(res))
      .catch(err => sendResponse({ error: err.message }));
    return true;
  }

  if (message.action === "add_entry") {
    handleAddEntry(message.website, message.username, message.password)
      .then(res => sendResponse(res))
      .catch(err => sendResponse({ error: err.message }));
    return true;
  }

  if (message.action === "search_entries") {
    handleSearchEntries(message.regex)
      .then(res => sendResponse(res))
      .catch(err => sendResponse({ error: err.message }));
    return true;
  }

  if (message.action === "get_credentials_for_url") {
    handleGetCredentialsForUrl(message.hostname)
      .then(res => sendResponse(res))
      .catch(err => sendResponse({ error: err.message }));
    return true;
  }
});
