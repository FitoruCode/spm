const CryptoUtils = {
  ab2base64: function(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  },

  base642ab: function(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  },

  generateSalt: function() {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    return this.ab2base64(salt);
  },

  // Convert .txt file content to a large hex number via SHA-256
  fileTextToNumber: async function(text) {
    const buffer = new TextEncoder().encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const bytes = new Uint8Array(hashBuffer);
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  },

  // Derive primary key from password
  deriveKey: async function(password, saltBase64) {
    const salt = this.base642ab(saltBase64);
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      enc.encode(password),
      { name: "PBKDF2" },
      false,
      ["deriveBits", "deriveKey"]
    );
    return await crypto.subtle.deriveKey(
      { name: "PBKDF2", salt: salt, iterations: 100000, hash: "SHA-256" },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  },

  // Derive secondary key from file number
  deriveKey2: async function(fileNumber, salt2Base64) {
    const salt = this.base642ab(salt2Base64);
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      enc.encode(fileNumber),
      { name: "PBKDF2" },
      false,
      ["deriveBits", "deriveKey"]
    );
    return await crypto.subtle.deriveKey(
      { name: "PBKDF2", salt: salt, iterations: 100000, hash: "SHA-256" },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  },

  // Encrypt with key1 (password), then encrypt the result with key2 (file)
  encryptData: async function(data, key1, key2) {
    // Inner layer: encrypt plaintext with sessionKey (password-derived)
    const iv1 = crypto.getRandomValues(new Uint8Array(12));
    const plaintext = JSON.stringify(data);
    const encoded = new TextEncoder().encode(plaintext);
    const ciphertext1 = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv1 },
      key1,
      encoded
    );
    const inner = {
      iv: this.ab2base64(iv1),
      ciphertext: this.ab2base64(ciphertext1)
    };

    // Outer layer: encrypt the inner JSON object with sessionKey2 (file-derived)
    const iv2 = crypto.getRandomValues(new Uint8Array(12));
    const innerEncoded = new TextEncoder().encode(JSON.stringify(inner));
    const ciphertext2 = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv2 },
      key2,
      innerEncoded
    );
    return {
      iv: this.ab2base64(iv2),
      ciphertext: this.ab2base64(ciphertext2)
    };
  },

  // Decrypt outer layer with key2 (file), then inner with key1 (password)
  decryptData: async function(encryptedObj, key1, key2) {
    // Outer layer
    const iv2 = this.base642ab(encryptedObj.iv);
    const ciphertext2 = this.base642ab(encryptedObj.ciphertext);
    const innerBytes = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv2 },
      key2,
      ciphertext2
    );
    const inner = JSON.parse(new TextDecoder().decode(innerBytes));

    // Inner layer
    const iv1 = this.base642ab(inner.iv);
    const ciphertext1 = this.base642ab(inner.ciphertext);
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv1 },
      key1,
      ciphertext1
    );
    return JSON.parse(new TextDecoder().decode(decrypted));
  },

  hashString: async function(str) {
    const buffer = new TextEncoder().encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    return this.ab2base64(hashBuffer);
  }
};

if (typeof window !== 'undefined') {
  window.CryptoUtils = CryptoUtils;
}
