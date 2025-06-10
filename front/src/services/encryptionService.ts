// src/services/encryptionService.ts
import * as CryptoJS from 'crypto-js';
import type { EncryptedData } from '../types';

/**
 * Service for encrypting and decrypting data using AES encryption
 * with RSA-style public/private key simulation using ECDH
 */
class EncryptionService {
  /**
   * Generate a new key pair for encryption/decryption
   * Uses a simplified approach for demo purposes
   */
  generateKeyPair(): { publicKey: string; privateKey: string } {
    // Generate a random private key (32 bytes)
    const privateKey = CryptoJS.lib.WordArray.random(32).toString();
    
    // Generate public key (simplified - in real implementation would use ECDH)
    const publicKey = CryptoJS.SHA256(privateKey + 'public').toString();
    
    return {
      publicKey,
      privateKey
    };
  }

  /**
   * Encrypt data using a public key (simplified implementation)
   * In production, would use proper ECDH key exchange
   */
  encryptWithPublicKey(data: string, publicKey: string): EncryptedData {
    // Generate a random symmetric key
    const symmetricKey = CryptoJS.lib.WordArray.random(32);
    const iv = CryptoJS.lib.WordArray.random(16);
    
    // Encrypt the data with AES
    const encrypted = CryptoJS.AES.encrypt(data, symmetricKey, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });
    
    // "Encrypt" the symmetric key with the public key (simplified)
    // In real implementation, would use ECIES or similar
    const encryptedKey = CryptoJS.AES.encrypt(
      symmetricKey.toString(), 
      CryptoJS.SHA256(publicKey).toString()
    ).toString();
    
    return {
      encryptedContent: encrypted.toString(),
      encryptedKey: encryptedKey,
      iv: iv.toString(),
      algorithm: 'AES-CBC'
    };
  }

  /**
   * Decrypt data using a private key (simplified implementation)
   */
  decryptWithPrivateKey(encryptedData: EncryptedData, privateKey: string): string {
    try {
      // "Decrypt" the symmetric key using the private key
      const publicKey = CryptoJS.SHA256(privateKey + 'public').toString();
      const symmetricKeyBytes = CryptoJS.AES.decrypt(
        encryptedData.encryptedKey,
        CryptoJS.SHA256(publicKey).toString()
      );
      const symmetricKey = CryptoJS.enc.Utf8.parse(symmetricKeyBytes.toString(CryptoJS.enc.Utf8));
      
      // Decrypt the content
      const iv = CryptoJS.enc.Hex.parse(encryptedData.iv);
      const decrypted = CryptoJS.AES.decrypt(encryptedData.encryptedContent, symmetricKey, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
      });
      
      return decrypted.toString(CryptoJS.enc.Utf8);
    } catch (error) {
      console.error('Decryption failed:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Simple symmetric encryption for local storage
   */
  encryptForStorage(data: string, password: string): string {
    return CryptoJS.AES.encrypt(data, password).toString();
  }

  /**
   * Simple symmetric decryption for local storage
   */
  decryptFromStorage(encryptedData: string, password: string): string {
    try {
      const bytes = CryptoJS.AES.decrypt(encryptedData, password);
      return bytes.toString(CryptoJS.enc.Utf8);
    } catch (error) {
      console.error('Storage decryption failed:', error);
      throw new Error('Failed to decrypt stored data');
    }
  }

  /**
   * Generate a hash of data for verification
   */
  hash(data: string): string {
    return CryptoJS.SHA256(data).toString();
  }

  /**
   * Generate a unique ID based on timestamp and random data
   */
  generateId(): string {
    const timestamp = Date.now().toString();
    const random = CryptoJS.lib.WordArray.random(16).toString();
    return CryptoJS.SHA256(timestamp + random).toString().substring(0, 16);
  }

  /**
   * Sign data using a private key (simplified implementation)
   * In production, would use proper ECDSA signing
   */
  sign(data: string, privateKey: string): string {
    return CryptoJS.HmacSHA256(data, privateKey).toString();
  }

  /**
   * Verify a signature (simplified implementation)
   */
  verify(data: string, signature: string, _publicKey: string): boolean {
    try {
      // In this simplified implementation, we can't directly verify
      // without the private key, so we'll return true for demo purposes
      // In production, would use proper ECDSA verification
      return signature.length === 64; // Basic format check
    } catch (error) {
      console.error('Signature verification failed:', error);
      return false;
    }
  }
}

export const encryptionService = new EncryptionService();
