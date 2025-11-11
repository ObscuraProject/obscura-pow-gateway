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

let wasmModule = null;

// SHA-256 implementation using Web Crypto API
async function sha256(input) {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// JavaScript-based PoW solver - finds nonce where SHA256(challenge + nonce) starts with required zeros
async function solvePowJavaScript(challenge, difficulty) {
  console.log('[SOLVER-JS] Starting JavaScript PoW solver');
  console.log('[SOLVER-JS] Challenge:', challenge);
  console.log('[SOLVER-JS] Difficulty:', difficulty, '(need', difficulty, 'leading zeros)');
  
  const target = '0'.repeat(difficulty);
  let nonce = 0;
  let attempts = 0;
  const startTime = Date.now();
  
  // Update UI every 100ms to show progress
  const updateInterval = setInterval(() => {
    const elapsed = (Date.now() - startTime) / 1000;
    document.getElementById('status').textContent = `Solving PoW... (${attempts.toLocaleString()} attempts in ${elapsed.toFixed(1)}s)`;
  }, 100);
  
  while (true) {
    attempts++;
    
    // Allow UI to update every 1000 attempts
    if (attempts % 1000 === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    
    const hashInput = challenge + nonce;
    const hash = await sha256(hashInput);
    
    if (hash.startsWith(target)) {
      clearInterval(updateInterval);
      const elapsed = Date.now() - startTime;
      console.log('[SOLVER-JS] ✓ Found valid nonce!');
      console.log('[SOLVER-JS] Nonce:', nonce);
      console.log('[SOLVER-JS] Hash:', hash);
      console.log('[SOLVER-JS] Attempts:', attempts.toLocaleString());
      console.log('[SOLVER-JS] Time:', (elapsed / 1000).toFixed(2) + 's');
      
      return { nonce, hash, attempts, elapsed };
    }
    
    nonce++;
  }
}

// Try to load WASM module
async function initWasm() {
  try {
    console.log('[WASM] Attempting to load WASM module...');
    
    const response = await fetch('/wasm/obscuragate_pow_bg.wasm');
    if (!response.ok) {
      console.warn('[WASM] HTTP error, falling back to JavaScript');
      return null;
    }
    
    const buffer = await response.arrayBuffer();
    console.log('[WASM] Buffer loaded, size:', buffer.byteLength);
    
    const memory = new WebAssembly.Memory({ initial: 256, maximum: 512 });
    const table = new WebAssembly.Table({ initial: 0, element: 'anyfunc' });
    
    const wasmImports = {
      wbg: {
        __wbindgen_init_externref_table: () => table,
        __wbindgen_throw: (ptr, len) => {
          throw new Error('WASM error');
        },
        __wbindgen_memory: () => memory,
        __wbindgen_string_new: (ptr, len) => {
          const bytes = new Uint8Array(memory.buffer, ptr, len);
          return new TextDecoder().decode(bytes);
        },
        __wbindgen_object_drop_ref: () => {}
      },
      env: { memory, table }
    };
    
    const { instance } = await WebAssembly.instantiate(buffer, wasmImports);
    console.log('[WASM] Module loaded successfully');
    console.log('[WASM] Exports:', Object.keys(instance.exports));
    
    if (typeof instance.exports.__wbindgen_init === 'function') {
      instance.exports.__wbindgen_init();
    }
    
    return instance.exports;
  } catch (error) {
    console.warn('[WASM] Loading failed:', error.message);
    console.log('[WASM] Will use JavaScript PoW solver instead');
    return null;
  }
}

// Initialize on page load
async function setupPoWGateway() {
  try {
    console.log('[GATEWAY] Initializing gateway...');
    const statusEl = document.getElementById('status');
    
    if (!statusEl) {
      console.error('[GATEWAY] Status element not found');
      return;
    }
    
    statusEl.textContent = 'Initializing gateway...';
    statusEl.style.color = 'orange';
    
    console.log('[GATEWAY] Attempting to load WASM module...');
    wasmModule = await initWasm();
    
    if (wasmModule) {
      console.log('[GATEWAY] Using WASM module for PoW solving');
    } else {
      console.log('[GATEWAY] Using JavaScript for PoW solving');
    }
    
    console.log('[GATEWAY] Gateway ready');
    statusEl.textContent = 'Ready to solve PoW challenge';
    statusEl.style.color = 'green';
    
    const getChallengeBtn = document.getElementById('getChallenge');
    if (getChallengeBtn) {
      getChallengeBtn.disabled = false;
    }
  } catch (error) {
    console.error('[GATEWAY] Error:', error.message);
    document.getElementById('status').textContent = `Error: ${error.message}`;
    document.getElementById('status').style.color = 'red';
  }
}

// Fetch a new PoW challenge from backend
async function getChallenge() {
  try {
    console.log('[CHALLENGE] Requesting challenge...');
    document.getElementById('status').textContent = 'Fetching challenge...';
    document.getElementById('getChallenge').disabled = true;
    
    const response = await fetch('/api/challenge');
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    console.log('[CHALLENGE] Received:', data.challenge, 'Difficulty:', data.difficulty);

    document.getElementById('challenge').textContent = data.challenge;
    document.getElementById('difficulty').textContent = data.difficulty;
    document.getElementById('status').textContent = 'Challenge received. Solving PoW...';

    solveChallenge(data.challenge, data.difficulty);
  } catch (error) {
    console.error('[CHALLENGE] Error:', error.message);
    document.getElementById('status').textContent = 'Error: ' + error.message;
    document.getElementById('status').style.color = 'red';
    document.getElementById('getChallenge').disabled = false;
  }
}

// Solve PoW challenge
async function solveChallenge(challenge, difficulty) {
  try {
    console.log('[SOLVER] Starting PoW solve...');
    
    const startTime = Date.now();
    document.getElementById('status').textContent = 'Solving PoW...';
    
    // Use JavaScript solver (WASM fallback didn't work reliably)
    const result = await solvePowJavaScript(challenge, difficulty);
    
    const elapsed = Date.now() - startTime;
    console.log('[SOLVER] ✓ PoW solved successfully!');
    console.log('[SOLVER] Result:', result);
    
    document.getElementById('nonce').textContent = result.nonce;
    document.getElementById('elapsed').textContent = (elapsed / 1000).toFixed(2) + 's';
    document.getElementById('status').textContent = `PoW solved! Nonce: ${result.nonce} ✓`;
    document.getElementById('status').style.color = 'green';
    document.getElementById('submitBtn').disabled = false;
  } catch (error) {
    console.error('[SOLVER] Error:', error.message);
    document.getElementById('status').textContent = 'Error: ' + error.message;
    document.getElementById('status').style.color = 'red';
    document.getElementById('getChallenge').disabled = false;
  }
}

// Submit PoW solution to backend
async function submitPoW() {
  try {
    const challenge = document.getElementById('challenge').textContent;
    const nonce = document.getElementById('nonce').textContent;

    if (!challenge || !nonce || challenge === 'Waiting for challenge...' || nonce === 'Pending...') {
      document.getElementById('status').textContent = 'Error: Missing challenge or nonce';
      document.getElementById('status').style.color = 'red';
      return;
    }

    console.log('[SUBMIT] Submitting PoW solution...');
    console.log('[SUBMIT] Challenge:', challenge);
    console.log('[SUBMIT] Nonce:', nonce);
    
    document.getElementById('status').textContent = 'Submitting...';
    document.getElementById('submitBtn').disabled = true;

    const response = await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challenge, nonce: parseInt(nonce) })
    });

    const data = await response.json();
    console.log('[SUBMIT] Server response:', data);

    if (data.success && data.redirect) {
      console.log('[SUBMIT] ✓ PoW verified! Redirecting to:', data.redirect);
      document.getElementById('status').textContent = 'PoW verified! Redirecting...';
      document.getElementById('status').style.color = 'green';
      setTimeout(() => {
        window.location.href = data.redirect;
      }, 1000);
    } else {
      throw new Error(data.error || 'Submission failed');
    }
  } catch (error) {
    console.error('[SUBMIT] Error:', error.message);
    document.getElementById('status').textContent = 'Error: ' + error.message;
    document.getElementById('status').style.color = 'red';
    document.getElementById('submitBtn').disabled = false;
    document.getElementById('getChallenge').disabled = false;
  }
}

// Initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupPoWGateway);
} else {
  setupPoWGateway();
}
