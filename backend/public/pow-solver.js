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

// Load WebAssembly module
async function initWasm() {
  try {
    console.log('[WASM] Starting module load...');
    
    const response = await fetch('/wasm/obscuragate_pow_bg.wasm');
    console.log('[WASM] Fetch response status:', response.status);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: Failed to fetch WASM file`);
    }
    
    const buffer = await response.arrayBuffer();
    console.log('[WASM] Buffer size:', buffer.byteLength, 'bytes');
    
    // Create memory
    const memory = new WebAssembly.Memory({ initial: 256, maximum: 512 });
    
    // Create table for function references
    const table = new WebAssembly.Table({ initial: 0, element: 'anyfunc' });
    
    // Create all required wbindgen imports
    const wasmImports = {
      wbg: {
        __wbindgen_init_externref_table: (table_ptr) => {
          console.log('[WASM] __wbindgen_init_externref_table called');
          return table;
        },
        __wbindgen_throw: (ptr, len) => {
          const bytes = new Uint8Array(memory.buffer, ptr, len);
          const message = new TextDecoder().decode(bytes);
          console.error('[WASM] Error:', message);
          throw new Error(message);
        },
        __wbindgen_memory: () => {
          return memory;
        },
        __wbindgen_string_new: (ptr, len) => {
          const bytes = new Uint8Array(memory.buffer, ptr, len);
          return new TextDecoder().decode(bytes);
        },
        __wbindgen_object_drop_ref: (i) => {
          console.log('[WASM] Drop ref:', i);
        }
      },
      env: {
        memory: memory,
        table: table
      }
    };
    
    console.log('[WASM] Instantiating module...');
    const { instance } = await WebAssembly.instantiate(buffer, wasmImports);
    
    console.log('[WASM] Module instantiated successfully');
    console.log('[WASM] Available exports:', Object.keys(instance.exports));
    
    // Call init if it exists
    if (typeof instance.exports.__wbindgen_init === 'function') {
      console.log('[WASM] Calling __wbindgen_init...');
      instance.exports.__wbindgen_init();
    }
    
    return instance.exports;
  } catch (error) {
    console.error('[WASM] Load failed:', error.message);
    throw error;
  }
}

// Initialize WASM on page load
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
    
    console.log('[GATEWAY] Loading WASM module...');
    wasmModule = await initWasm();
    
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

// Solve PoW challenge using WASM module
function solveChallenge(challenge, difficulty) {
  try {
    console.log('[SOLVER] Starting solve...');
    
    if (!wasmModule) {
      throw new Error('WASM module not loaded');
    }

    if (typeof wasmModule.solve_pow !== 'function') {
      const funcs = Object.keys(wasmModule).filter(k => typeof wasmModule[k] === 'function');
      throw new Error('solve_pow not found. Available: ' + funcs.join(', '));
    }

    const startTime = Date.now();
    document.getElementById('status').textContent = 'Solving PoW...';
    
    console.log('[SOLVER] Calling solve_pow...');
    const nonce = wasmModule.solve_pow(challenge, difficulty);
    console.log('[SOLVER] Result:', nonce);

    const elapsed = Date.now() - startTime;
    document.getElementById('nonce').textContent = nonce;
    document.getElementById('elapsed').textContent = (elapsed / 1000).toFixed(2) + 's';
    document.getElementById('status').textContent = 'PoW solved! Nonce: ' + nonce;
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

    console.log('[SUBMIT] Submitting...');
    document.getElementById('status').textContent = 'Submitting...';
    document.getElementById('submitBtn').disabled = true;

    const response = await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challenge, nonce: parseInt(nonce) })
    });

    const data = await response.json();

    if (data.success && data.redirect) {
      console.log('[SUBMIT] Success! Redirecting to:', data.redirect);
      document.getElementById('status').textContent = 'Redirecting...';
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
