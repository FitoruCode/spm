let sessionKey = null;
let autoLockTimer = null;

function resetAutoLock() {
  if (autoLockTimer) clearTimeout(autoLockTimer);
  autoLockTimer = setTimeout(() => {
    sessionKey = null;
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

async function handleRegister(username, password) {
  const data = await browser.storage.local.get(['authData']);
  if (data.authData) {
    throw new Error("Already registered. Please login.");
  }
  
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
  if (!passwordRegex.test(password)) {
    throw new Error("Master password must be 8+ chars and include a lowercase, uppercase, digit, and special character.");
  }
  
  const salt = CryptoUtils.generateSalt();
  
  const key = await CryptoUtils.deriveKey(password, salt);
  
  sessionKey = key;
  resetAutoLock();
  

  const hashVerify = await CryptoUtils.hashString(password + salt);
  
  await browser.storage.local.set({
    authData: { salt: salt, verify: hashVerify, username: username }
  });
  
  return { success: true };
}

async function handleLogin(username, password) {
  const data = await browser.storage.local.get(['authData']);
  if (!data.authData) {
    throw new Error("Not registered yet.");
  }
  
  const { salt, verify, username: storedUsername } = data.authData;
  if (username !== storedUsername) {
    throw new Error("Invalid username.");
  }
  
  const hashVerify = await CryptoUtils.hashString(password + salt);
  if (hashVerify !== verify) {
    throw new Error("Invalid password.");
  }
  
  sessionKey = await CryptoUtils.deriveKey(password, salt);
  resetAutoLock();
  return { success: true };
}

async function handleAddEntry(website, entryUsername, entryPassword) {
  if (!sessionKey) throw new Error("Not authenticated");
  resetAutoLock();
  
  const dataToEncrypt = {
    id: crypto.randomUUID(),
    website,
    username: entryUsername,
    password: entryPassword,
    timestamp: Date.now()
  };
  
  const encryptedObj = await CryptoUtils.encryptData(dataToEncrypt, sessionKey);
  
  const storageData = await browser.storage.local.get(['entries']);
  const entries = storageData.entries || [];
  entries.push(encryptedObj);
  
  await browser.storage.local.set({ entries });
  return { success: true };
}

async function handleDeleteEntry(id) {
  if (!sessionKey) throw new Error("Not authenticated");
  resetAutoLock();

  const storageData = await browser.storage.local.get(['entries']);
  const entries = storageData.entries || [];
  
  let entryIndexToRemove = -1;
  for (let i = 0; i < entries.length; i++) {
    try {
      const decrypted = await CryptoUtils.decryptData(entries[i], sessionKey);
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
  if (!sessionKey) throw new Error("Not authenticated");
  resetAutoLock();
  
  const storageData = await browser.storage.local.get(['entries']);
  const entries = storageData.entries || [];
  
  let decryptedEntries = [];
  for (const encryptedObj of entries) {
    try {
      const decrypted = await CryptoUtils.decryptData(encryptedObj, sessionKey);
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

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "get_status") {
    browser.storage.local.get(['authData']).then(data => {
      sendResponse({ 
        isRegistered: !!data.authData, 
        isLoggedIn: !!sessionKey 
      });
    });
    return true; 
  }
  
  if (message.action === "register") {
    handleRegister(message.username, message.password)
      .then(res => sendResponse(res))
      .catch(err => sendResponse({ error: err.message }));
    return true;
  }
  
  if (message.action === "login") {
    handleLogin(message.username, message.password)
      .then(res => sendResponse(res))
      .catch(err => sendResponse({ error: err.message }));
    return true;
  }

  if (message.action === "logout") {
    sessionKey = null;
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
});
