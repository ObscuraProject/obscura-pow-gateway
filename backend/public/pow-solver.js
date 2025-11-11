// Minimal JavaScript shim for WebAssembly PoW solver
// This is the only JS required - it loads and executes the WASM module

let wasmModule = null;

// Load WebAssembly module
async function initWasm() {
  try {
    const response = await fetch('/wasm/obscuragate_pow_bg.wasm');
    const buffer = await response.arrayBuffer();
    const wasmImports = {
      env: {
        memory: new WebAssembly.Memory({ initial: 256, maximum: 512 })
      }
    };
    const wasmModule = await WebAssembly.instantiate(buffer, wasmImports);
    return wasmModule.instance.exports;
  } catch (error) {
    console.error('Failed to load WASM module:', error);
    throw error;
  }
}

// Initialize WASM on page load
async function setupPoWGateway() {
  try {
    wasmModule = await initWasm();
    document.getElementById('status').textContent = 'Ready to solve PoW challenge';
    document.getElementById('getChallenge').disabled = false;
  } catch (error) {
    document.getElementById('status').textContent = 'Error loading WASM module';
    document.getElementById('status').style.color = 'red';
  }
}

// Fetch a new PoW challenge from backend
async function getChallenge() {
  try {
    document.getElementById('status').textContent = 'Fetching challenge...';
    const response = await fetch('/api/challenge');
    const data = await response.json();

    document.getElementById('challenge').textContent = data.challenge;
    document.getElementById('difficulty').textContent = data.difficulty;
    document.getElementById('status').textContent = 'Challenge received. Solving PoW...';

    // Solve PoW using WASM
    solveChallenge(data.challenge, data.difficulty);
  } catch (error) {
    document.getElementById('status').textContent = 'Error fetching challenge: ' + error;
    document.getElementById('status').style.color = 'red';
  }
}

// Solve PoW challenge using WASM module
function solveChallenge(challenge, difficulty) {
  try {
    if (!wasmModule) {
      throw new Error('WASM module not loaded');
    }

    const startTime = Date.now();
    document.getElementById('status').textContent = 'Solving PoW (calculating nonce)...';

    // Call WASM function to solve PoW
    // Note: This runs in the browser and may take a few seconds
    const nonce = wasmModule.solve_pow(challenge, difficulty);

    const elapsed = Date.now() - startTime;
    document.getElementById('nonce').textContent = nonce;
    document.getElementById('elapsed').textContent = (elapsed / 1000).toFixed(2) + 's';
    document.getElementById('status').textContent = 'PoW solved! Nonce: ' + nonce;
    document.getElementById('submitBtn').disabled = false;
  } catch (error) {
    document.getElementById('status').textContent = 'Error solving PoW: ' + error;
    document.getElementById('status').style.color = 'red';
  }
}

// Submit PoW solution to backend
async function submitPoW() {
  try {
    const challenge = document.getElementById('challenge').textContent;
    const nonce = document.getElementById('nonce').textContent;

    if (!challenge || !nonce) {
      document.getElementById('status').textContent = 'Error: Challenge or nonce missing';
      return;
    }

    document.getElementById('status').textContent = 'Submitting PoW solution...';
    document.getElementById('submitBtn').disabled = true;

    const response = await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challenge, nonce })
    });

    const data = await response.json();

    if (data.success && data.redirect) {
      document.getElementById('status').textContent = 'PoW verified! Redirecting...';
      document.getElementById('status').style.color = 'green';
      setTimeout(() => {
        window.location.href = data.redirect;
      }, 1000);
    } else {
      document.getElementById('status').textContent = 'Error: ' + data.error;
      document.getElementById('status').style.color = 'red';
      document.getElementById('submitBtn').disabled = false;
    }
  } catch (error) {
    document.getElementById('status').textContent = 'Error submitting PoW: ' + error;
    document.getElementById('status').style.color = 'red';
    document.getElementById('submitBtn').disabled = false;
  }
}

// Initialize on page load
window.addEventListener('load', setupPoWGateway);