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

// Initialize on page load
function setupPoWGateway() {
  try {
    console.log('[GATEWAY] Initializing gateway for JavaScript-enabled users...');
    
    const statusEl = document.getElementById('status');
    const getChallengeBtn = document.getElementById('getChallenge');
    const submitBtn = document.getElementById('submitBtn');
    
    if (!statusEl || !getChallengeBtn) {
      console.error('[GATEWAY] Required elements not found');
      console.error('[GATEWAY] status:', statusEl);
      console.error('[GATEWAY] getChallenge:', getChallengeBtn);
      return;
    }
    
    // Enable the Get Challenge button immediately
    getChallengeBtn.disabled = false;
    
    // Update status to indicate JS is working
    statusEl.textContent = '> Ready';
    statusEl.className = 'status ready';
    
    console.log('[GATEWAY] Gateway ready for JavaScript users');
  } catch (error) {
    console.error('[GATEWAY] Error:', error.message);
    console.error('[GATEWAY] Stack:', error.stack);
    document.getElementById('status').textContent = '> Error: ' + error.message;
    document.getElementById('status').className = 'status error';
  }
}

// Fetch a new PoW challenge from backend
async function getChallenge() {
  try {
    console.log('[CHALLENGE] Requesting challenge...');
    const statusEl = document.getElementById('status');
    const getChallengeBtn = document.getElementById('getChallenge');
    
    statusEl.textContent = '> Fetching challenge...';
    statusEl.className = 'status loading';
    getChallengeBtn.disabled = true;
    
    const response = await fetch('/api/challenge');
    
    console.log('[CHALLENGE] Response status:', response.status);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('[CHALLENGE] Received challenge:', data.challenge);
    console.log('[CHALLENGE] Received nonce:', data.nonce);
    console.log('[CHALLENGE] Difficulty:', data.difficulty);

    // Update all the fields
    document.getElementById('challenge').textContent = data.challenge;
    document.getElementById('challenge-input').value = data.challenge;
    
    document.getElementById('difficulty').textContent = data.difficulty;
    
    document.getElementById('nonce').textContent = data.nonce;
    document.getElementById('nonce-input').value = data.nonce;
    
    document.getElementById('elapsed').textContent = '0.00s';
    
    // Enable submit button
    document.getElementById('submitBtn').disabled = false;
    
    statusEl.textContent = '> Challenge received! Ready to submit.';
    statusEl.className = 'status ready';
    getChallengeBtn.disabled = false;
  } catch (error) {
    console.error('[CHALLENGE] Error:', error.message);
    console.error('[CHALLENGE] Stack:', error.stack);
    document.getElementById('status').textContent = '> Error: ' + error.message;
    document.getElementById('status').className = 'status error';
    document.getElementById('getChallenge').disabled = false;
  }
}

// Submit PoW solution to backend
async function submitPoW(event) {
  // Prevent default form submission if called from form
  if (event) {
    event.preventDefault();
  }

  try {
    const challenge = document.getElementById('challenge').textContent;
    const nonce = document.getElementById('nonce').textContent;

    console.log('[SUBMIT] Preparing submission...');
    console.log('[SUBMIT] Challenge:', challenge);
    console.log('[SUBMIT] Nonce:', nonce);

    if (!challenge || !nonce || challenge === 'Waiting for challenge...' || nonce === 'Pending...') {
      document.getElementById('status').textContent = '> Error: No challenge. Click "Get Challenge" first.';
      document.getElementById('status').className = 'status error';
      return;
    }

    const statusEl = document.getElementById('status');
    const submitBtn = document.getElementById('submitBtn');
    
    statusEl.textContent = '> Submitting PoW solution...';
    statusEl.className = 'status loading';
    submitBtn.disabled = true;

    console.log('[SUBMIT] Sending to server...');
    const response = await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challenge, nonce: parseInt(nonce) })
    });

    console.log('[SUBMIT] Response status:', response.status);
    const data = await response.json();
    console.log('[SUBMIT] Server response:', data);

    if (data.success && data.redirect) {
      console.log('[SUBMIT] ✓ PoW verified! Redirecting to:', data.redirect);
      statusEl.textContent = '> ✓ PoW verified! Redirecting...';
      statusEl.className = 'status success';
      setTimeout(() => {
        window.location.href = data.redirect;
      }, 1000);
    } else {
      throw new Error(data.error || 'Submission failed');
    }
  } catch (error) {
    console.error('[SUBMIT] Error:', error.message);
    console.error('[SUBMIT] Stack:', error.stack);
    document.getElementById('status').textContent = '> Error: ' + error.message;
    document.getElementById('status').className = 'status error';
    document.getElementById('submitBtn').disabled = false;
    document.getElementById('getChallenge').disabled = false;
  }
}

// Attach event listeners when DOM is ready
function attachEventListeners() {
  const getChallengeBtn = document.getElementById('getChallenge');
  const submitBtn = document.getElementById('submitBtn');
  const form = document.querySelector('form');
  
  if (getChallengeBtn) {
    getChallengeBtn.addEventListener('click', getChallenge);
    console.log('[INIT] Get Challenge button event listener attached');
  }
  
  if (submitBtn) {
    submitBtn.addEventListener('click', submitPoW);
    console.log('[INIT] Submit button event listener attached');
  }
  
  if (form) {
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      submitPoW();
    });
    console.log('[INIT] Form submit event listener attached');
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  console.log('[INIT] DOM still loading, waiting for DOMContentLoaded');
  document.addEventListener('DOMContentLoaded', function() {
    console.log('[INIT] DOMContentLoaded fired');
    attachEventListeners();
    setupPoWGateway();
  });
} else {
  console.log('[INIT] DOM already loaded');
  attachEventListeners();
  setupPoWGateway();
}
