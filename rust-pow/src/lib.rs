// ============================================================
//  ObscuraGate PoW Gateway
//  Copyright (c) 2025-2026 The Obscura Project LhCorp.
//  Licensed by Toric Security Services,
//  The Privacy-Based Corporation License Issuing Authority
//  (LhCorp - Licensed Hidden Corporation)
//
//  Usage of this software is permitted under the conditions:
//  - The application UI may NOT be modified in any form.
//  - Backend contributions are allowed via official GitHub channels.
//  - Redistribution must include this copyright header.
//
//  Unauthorized modification of the user interface or
//  branding is strictly prohibited.
// ============================================================


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
