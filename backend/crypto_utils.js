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
      {
        name: "PBKDF2",
        salt: salt,
        iterations: 100000,
        hash: "SHA-256"
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  },

  encryptData: async function(data, key) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plaintext = JSON.stringify(data);
    const encoded = new TextEncoder().encode(plaintext);
    
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv },
      key,
      encoded
    );
    
    return {
      iv: this.ab2base64(iv),
      ciphertext: this.ab2base64(ciphertext)
    };
  },

  decryptData: async function(encryptedObj, key) {
    const iv = this.base642ab(encryptedObj.iv);
    const ciphertext = this.base642ab(encryptedObj.ciphertext);
    
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv },
      key,
      ciphertext
    );
    
    const plaintext = new TextDecoder().decode(decrypted);
    return JSON.parse(plaintext);
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
