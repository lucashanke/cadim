use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use hkdf::Hkdf;
use sha2::Sha256;

use crate::error::AppError;

/// Derive a per-user AES-256 key from the master key and user salt via HKDF.
pub fn derive_user_key(master_key: &[u8; 32], user_salt: &[u8]) -> [u8; 32] {
    let hk = Hkdf::<Sha256>::new(Some(user_salt), master_key);
    let mut key = [0u8; 32];
    hk.expand(b"cadim-user-encryption", &mut key)
        .expect("32 bytes is a valid length for HKDF-SHA256");
    key
}

/// Encrypt plaintext with AES-256-GCM. Returns (ciphertext, nonce).
pub fn encrypt(key: &[u8; 32], plaintext: &[u8]) -> Result<(Vec<u8>, Vec<u8>), AppError> {
    let cipher = Aes256Gcm::new(key.into());
    let nonce_bytes: [u8; 12] = rand::random();
    let nonce = Nonce::from_slice(&nonce_bytes);
    let ciphertext = cipher
        .encrypt(nonce, plaintext)
        .map_err(|e| AppError::Internal(format!("Encryption failed: {}", e)))?;
    Ok((ciphertext, nonce_bytes.to_vec()))
}

/// Decrypt ciphertext with AES-256-GCM.
pub fn decrypt(key: &[u8; 32], ciphertext: &[u8], nonce: &[u8]) -> Result<Vec<u8>, AppError> {
    let cipher = Aes256Gcm::new(key.into());
    let nonce = Nonce::from_slice(nonce);
    cipher
        .decrypt(nonce, ciphertext)
        .map_err(|e| AppError::Internal(format!("Decryption failed: {}", e)))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encrypt_decrypt_roundtrip() {
        let master_key: [u8; 32] = rand::random();
        let salt: [u8; 16] = rand::random();
        let user_key = derive_user_key(&master_key, &salt);

        let plaintext = b"secret financial data";
        let (ciphertext, nonce) = encrypt(&user_key, plaintext).unwrap();

        assert_ne!(ciphertext, plaintext);
        let decrypted = decrypt(&user_key, &ciphertext, &nonce).unwrap();
        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn test_different_salts_produce_different_keys() {
        let master_key: [u8; 32] = rand::random();
        let salt1: [u8; 16] = rand::random();
        let salt2: [u8; 16] = rand::random();

        let key1 = derive_user_key(&master_key, &salt1);
        let key2 = derive_user_key(&master_key, &salt2);
        assert_ne!(key1, key2);
    }

    #[test]
    fn test_wrong_key_fails_decryption() {
        let master_key: [u8; 32] = rand::random();
        let salt: [u8; 16] = rand::random();
        let user_key = derive_user_key(&master_key, &salt);

        let (ciphertext, nonce) = encrypt(&user_key, b"secret").unwrap();

        let wrong_key: [u8; 32] = rand::random();
        assert!(decrypt(&wrong_key, &ciphertext, &nonce).is_err());
    }
}
