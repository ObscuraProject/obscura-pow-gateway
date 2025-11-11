use sha2::{Sha256, Digest};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn solve_pow(challenge: &str, difficulty: u32) -> String {
    let target = "0".repeat(difficulty as usize);
    let mut nonce: u64 = 0;

    loop {
        let hash_input = format!("{}{}", challenge, nonce);
        let mut hasher = Sha256::new();
        hasher.update(hash_input.as_bytes());
        let result = hasher.finalize();
        let hash_hex = format!("{:x}", result);

        if hash_hex.starts_with(&target) {
            return nonce.to_string();
        }

        nonce += 1;
    }
}

#[wasm_bindgen]
pub fn verify_pow(challenge: &str, nonce: &str, difficulty: u32) -> bool {
    let hash_input = format!("{}{}", challenge, nonce);
    let mut hasher = Sha256::new();
    hasher.update(hash_input.as_bytes());
    let result = hasher.finalize();
    let hash_hex = format!("{:x}", result);

    let target = "0".repeat(difficulty as usize);
    hash_hex.starts_with(&target)
}