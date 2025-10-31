/**
 * Crypto Utilities - Session Export/Import Encryption
 * AES-256-GCM encryption with PBKDF2 key derivation
 * Enterprise tier exclusive
 */

const cryptoUtils = {
  /**
   * Encryption configuration
   */
  CONFIG: {
    ALGORITHM: 'AES-GCM',
    KEY_LENGTH: 256,
    IV_LENGTH: 12, // 96 bits for GCM
    SALT_LENGTH: 16, // 128 bits
    PBKDF2_ITERATIONS: 100000,
    HASH_ALGORITHM: 'SHA-256'
  },

  /**
   * Generate cryptographically secure random bytes
   * @param {number} length - Number of bytes to generate
   * @returns {Uint8Array} Random bytes
   */
  generateRandomBytes(length) {
    return crypto.getRandomValues(new Uint8Array(length));
  },

  /**
   * Derive encryption key from password using PBKDF2
   * @param {string} password - User password
   * @param {Uint8Array} salt - Random salt
   * @returns {Promise<CryptoKey>} Derived key
   */
  async deriveKey(password, salt) {
    console.log('[Crypto] Deriving key from password using PBKDF2...');

    // Import password as key material
    const passwordKey = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    // Derive AES key
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: this.CONFIG.PBKDF2_ITERATIONS,
        hash: this.CONFIG.HASH_ALGORITHM
      },
      passwordKey,
      {
        name: this.CONFIG.ALGORITHM,
        length: this.CONFIG.KEY_LENGTH
      },
      false,
      ['encrypt', 'decrypt']
    );

    console.log('[Crypto] ✓ Key derived successfully');
    return key;
  },

  /**
   * Encrypt data with AES-256-GCM
   * @param {string} plaintext - Data to encrypt
   * @param {string} password - Encryption password
   * @returns {Promise<Object>} Encrypted data with salt and IV
   */
  async encryptData(plaintext, password) {
    console.log('[Crypto] Encrypting data...');
    console.log('[Crypto] Plaintext size:', plaintext.length, 'bytes');

    try {
      // Generate random salt and IV
      const salt = this.generateRandomBytes(this.CONFIG.SALT_LENGTH);
      const iv = this.generateRandomBytes(this.CONFIG.IV_LENGTH);

      console.log('[Crypto] Generated salt:', salt.length, 'bytes');
      console.log('[Crypto] Generated IV:', iv.length, 'bytes');

      // Derive key from password
      const key = await this.deriveKey(password, salt);

      // Encrypt plaintext
      const plaintextBytes = new TextEncoder().encode(plaintext);
      const ciphertext = await crypto.subtle.encrypt(
        {
          name: this.CONFIG.ALGORITHM,
          iv: iv
        },
        key,
        plaintextBytes
      );

      console.log('[Crypto] ✓ Data encrypted successfully');
      console.log('[Crypto] Ciphertext size:', ciphertext.byteLength, 'bytes');

      // Return encrypted data with salt and IV (all as base64)
      return {
        ciphertext: this.arrayBufferToBase64(ciphertext),
        salt: this.arrayBufferToBase64(salt),
        iv: this.arrayBufferToBase64(iv),
        algorithm: this.CONFIG.ALGORITHM,
        keyLength: this.CONFIG.KEY_LENGTH,
        iterations: this.CONFIG.PBKDF2_ITERATIONS
      };
    } catch (error) {
      console.error('[Crypto] Encryption error:', error);
      throw new Error('Encryption failed: ' + error.message);
    }
  },

  /**
   * Decrypt data with AES-256-GCM
   * @param {Object} encryptedData - Encrypted data object
   * @param {string} password - Decryption password
   * @returns {Promise<string>} Decrypted plaintext
   */
  async decryptData(encryptedData, password) {
    console.log('[Crypto] Decrypting data...');

    try {
      // Convert base64 to ArrayBuffer
      const ciphertext = this.base64ToArrayBuffer(encryptedData.ciphertext);
      const salt = this.base64ToArrayBuffer(encryptedData.salt);
      const iv = this.base64ToArrayBuffer(encryptedData.iv);

      console.log('[Crypto] Ciphertext size:', ciphertext.byteLength, 'bytes');
      console.log('[Crypto] Salt size:', salt.byteLength, 'bytes');
      console.log('[Crypto] IV size:', iv.byteLength, 'bytes');

      // Derive key from password
      const key = await this.deriveKey(password, salt);

      // Decrypt ciphertext
      const plaintextBytes = await crypto.subtle.decrypt(
        {
          name: this.CONFIG.ALGORITHM,
          iv: iv
        },
        key,
        ciphertext
      );

      const plaintext = new TextDecoder().decode(plaintextBytes);

      console.log('[Crypto] ✓ Data decrypted successfully');
      console.log('[Crypto] Plaintext size:', plaintext.length, 'bytes');

      return plaintext;
    } catch (error) {
      console.error('[Crypto] Decryption error:', error);

      // Check if it's a wrong password error
      if (error.name === 'OperationError') {
        throw new Error('Incorrect password or corrupted data');
      }

      throw new Error('Decryption failed: ' + error.message);
    }
  },

  /**
   * Convert ArrayBuffer to Base64 string
   * @param {ArrayBuffer} buffer - ArrayBuffer to convert
   * @returns {string} Base64 string
   */
  arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  },

  /**
   * Convert Base64 string to ArrayBuffer
   * @param {string} base64 - Base64 string to convert
   * @returns {ArrayBuffer} ArrayBuffer
   */
  base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  },

  /**
   * Validate password strength
   * @param {string} password - Password to validate
   * @returns {{valid: boolean, error: string|null}} Validation result
   */
  validatePassword(password) {
    if (!password || password.length === 0) {
      return { valid: false, error: 'Password cannot be empty' };
    }

    if (password.length < 8) {
      return { valid: false, error: 'Password must be at least 8 characters' };
    }

    if (password.length > 128) {
      return { valid: false, error: 'Password is too long (max 128 characters)' };
    }

    return { valid: true, error: null };
  },

  /**
   * Test encryption/decryption (for validation)
   * @returns {Promise<boolean>} True if crypto is working
   */
  async testCrypto() {
    console.log('[Crypto] Running encryption test...');

    try {
      const testData = 'test123';
      const testPassword = 'testPassword123';

      // Encrypt
      const encrypted = await this.encryptData(testData, testPassword);
      console.log('[Crypto] Test encryption successful');

      // Decrypt
      const decrypted = await this.decryptData(encrypted, testPassword);
      console.log('[Crypto] Test decryption successful');

      // Verify
      if (decrypted !== testData) {
        throw new Error('Decrypted data does not match original');
      }

      console.log('[Crypto] ✓ Crypto test passed');
      return true;
    } catch (error) {
      console.error('[Crypto] ✗ Crypto test failed:', error);
      return false;
    }
  }
};

// Export for use in background script
if (typeof module !== 'undefined' && module.exports) {
  module.exports = cryptoUtils;
}

console.log('[Crypto Utils] ✓ Crypto utilities loaded');
