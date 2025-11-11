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

const express = require('express');
const crypto = require('crypto');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Configurable mirror URLs - modify these as needed
const mirrors = [
  'https://mirror1.example.com/',
  'https://mirror2.example.com/',
  'https://mirror3.example.com/',
  'https://mirror4.example.com/'
];

// Rate limiting and DDoS protection
const requestCounts = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000;
const MAX_CHALLENGES_PER_MINUTE = 10;
const BAN_THRESHOLD = 100;
const BAN_DURATION = 60 * 60 * 1000;

const bannedIPs = new Map();

// Serve static files from 'public' folder
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.wasm')) {
      res.setHeader('Content-Type', 'application/wasm');
      res.setHeader('Content-Disposition', 'inline');
    }
  },
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// In-memory store for issued challenges
const challenges = new Map();
const CHALLENGE_EXPIRY = 5 * 60 * 1000; // 5 minutes

// Track failed attempts per IP
const failedAttempts = new Map();
const FAILED_ATTEMPT_WINDOW = 60 * 60 * 1000;

// Cleanup expired data periodically
setInterval(() => {
  const now = Date.now();
  
  for (const [key, value] of challenges.entries()) {
    if (now - value.timestamp > CHALLENGE_EXPIRY) {
      challenges.delete(key);
    }
  }
  
  for (const [ip, data] of failedAttempts.entries()) {
    if (now - data.firstAttempt > FAILED_ATTEMPT_WINDOW) {
      failedAttempts.delete(ip);
    }
  }
  
  for (const [ip, banTime] of bannedIPs.entries()) {
    if (now - banTime > BAN_DURATION) {
      bannedIPs.delete(ip);
      console.log('[SECURITY] Ban expired for IP:', ip);
    }
  }
}, 30 * 1000);

// Helper to get client IP
function getClientIP(req) {
  return req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.ip;
}

// Check if IP is rate limited
function checkRateLimit(ip) {
  const now = Date.now();
  
  if (bannedIPs.has(ip)) {
    return { allowed: false, reason: 'IP is temporarily banned due to suspicious activity' };
  }
  
  if (!requestCounts.has(ip)) {
    requestCounts.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return { allowed: true };
  }
  
  const data = requestCounts.get(ip);
  
  if (now > data.resetTime) {
    data.count = 1;
    data.resetTime = now + RATE_LIMIT_WINDOW;
    return { allowed: true };
  }
  
  data.count++;
  
  if (data.count > MAX_CHALLENGES_PER_MINUTE) {
    return { allowed: false, reason: `Rate limited: max ${MAX_CHALLENGES_PER_MINUTE} challenges per minute` };
  }
  
  return { allowed: true };
}

// Track failed attempt
function trackFailedAttempt(ip) {
  const now = Date.now();
  
  if (!failedAttempts.has(ip)) {
    failedAttempts.set(ip, { count: 1, firstAttempt: now });
  } else {
    const data = failedAttempts.get(ip);
    data.count++;
    
    if (data.count >= BAN_THRESHOLD) {
      console.log('[SECURITY] Banning IP:', ip, '- Too many failed attempts');
      bannedIPs.set(ip, now);
      failedAttempts.delete(ip);
    }
  }
}

// Helper to generate random challenge string
function generateChallenge() {
  return crypto.randomBytes(16).toString('hex');
}

// Server-side PoW solver
function solvePoW(challenge, difficulty) {
  const target = '0'.repeat(difficulty);
  let nonce = 0;

  while (true) {
    const hashInput = challenge + nonce;
    const hash = crypto.createHash('sha256').update(hashInput).digest('hex');

    if (hash.startsWith(target)) {
      return nonce;
    }

    nonce++;
  }
}

// API to get a new PoW challenge (JSON response)
app.get('/api/challenge', (req, res) => {
  const ip = getClientIP(req);
  
  const rateLimitCheck = checkRateLimit(ip);
  if (!rateLimitCheck.allowed) {
    console.log('[SECURITY] Rate limit exceeded for IP:', ip);
    return res.status(429).json({ 
      error: rateLimitCheck.reason,
      retryAfter: 60
    });
  }

  const challenge = generateChallenge();
  const difficulty = 4;

  console.log('[API] Challenge request from', ip);

  const nonce = solvePoW(challenge, difficulty);

  challenges.set(challenge, {
    difficulty,
    nonce,
    timestamp: Date.now(),
    ip
  });

  console.log('[API] Challenge solved. Nonce:', nonce);

  res.json({
    challenge,
    difficulty,
    nonce,
    message: 'Server-computed Proof of Work challenge'
  });
});

// Form-based challenge request (for JavaScript-disabled users)
app.post('/challenge', (req, res) => {
  const ip = getClientIP(req);
  
  const rateLimitCheck = checkRateLimit(ip);
  if (!rateLimitCheck.allowed) {
    console.log('[SECURITY] Rate limit exceeded for form request from IP:', ip);
    return res.send(`
      <!DOCTYPE html>
      <html>
      <head><title>Error</title></head>
      <body style="font-family: monospace; color: #00ff00; background: #000; padding: 20px;">
        <h1>Error</h1>
        <p>${rateLimitCheck.reason}</p>
        <p><a href="/">Back to gateway</a></p>
      </body>
      </html>
    `);
  }

  const challenge = generateChallenge();
  const difficulty = 4;

  console.log('[FORM] Challenge request from', ip);

  const nonce = solvePoW(challenge, difficulty);

  challenges.set(challenge, {
    difficulty,
    nonce,
    timestamp: Date.now(),
    ip
  });

  console.log('[FORM] Challenge solved. Nonce:', nonce);

  // Return HTML with form pre-filled
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>ObscuraGate PoW Gateway</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Courier New', monospace; background: linear-gradient(135deg, #0f0c29, #302b63, #24243e); color: #00ff00; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
        .container { background: rgba(0, 0, 0, 0.85); border: 2px solid #00ff00; border-radius: 8px; padding: 40px; max-width: 600px; width: 100%; box-shadow: 0 0 20px rgba(0, 255, 0, 0.3); }
        .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #00ff00; padding-bottom: 20px; }
        .header h1 { font-size: 28px; text-shadow: 0 0 10px #00ff00; margin-bottom: 5px; }
        .header p { color: #00cc00; font-size: 12px; letter-spacing: 2px; }
        .field { margin-bottom: 20px; }
        .label { display: block; margin-bottom: 8px; font-size: 12px; color: #00ff00; text-transform: uppercase; letter-spacing: 1px; }
        input { background: rgba(0, 50, 0, 0.5); border: 1px solid #00ff00; border-radius: 4px; padding: 12px; font-size: 12px; color: #00ff00; font-family: 'Courier New', monospace; width: 100%; }
        .buttons { display: flex; gap: 10px; margin-bottom: 20px; margin-top: 20px; }
        button { flex: 1; padding: 12px 20px; background: rgba(0, 255, 0, 0.1); border: 1px solid #00ff00; color: #00ff00; cursor: pointer; font-family: 'Courier New', monospace; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; border-radius: 4px; }
        button:hover { background: rgba(0, 255, 0, 0.2); box-shadow: 0 0 10px rgba(0, 255, 0, 0.5); }
        .status { background: rgba(0, 100, 0, 0.3); border: 1px solid #00ff00; border-radius: 4px; padding: 15px; text-align: center; font-size: 12px; color: #00ff00; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>⚡ ObscuraGate PoW Gateway ⚡</h1>
          <p>Proof of Work Authentication System</p>
        </div>
        <form method="POST" action="/api/submit">
          <div class="field">
            <span class="label">Challenge ID</span>
            <input type="text" name="challenge" value="${challenge}" readonly>
          </div>
          <div class="field">
            <span class="label">Difficulty</span>
            <input type="text" value="${difficulty}" readonly>
          </div>
          <div class="field">
            <span class="label">Calculated Nonce</span>
            <input type="text" name="nonce" value="${nonce}" readonly>
          </div>
          <div class="status">
            > Challenge received! Ready to submit.
          </div>
          <div class="buttons">
            <button type="button" onclick="location.href='/';">Back</button>
            <button type="submit">Submit</button>
          </div>
        </form>
      </div>
    </body>
    </html>
  `);
});

// API to submit PoW solution
app.post('/api/submit', (req, res) => {
  const ip = getClientIP(req);
  const { challenge, nonce } = req.body;

  console.log('[SUBMIT] Received submission from', ip);
  console.log('[SUBMIT] Challenge:', challenge);
  console.log('[SUBMIT] Nonce:', nonce);

  if (!challenge || nonce === undefined) {
    trackFailedAttempt(ip);
    return res.status(400).json({ error: 'Missing challenge or nonce' });
  }

  const challengeData = challenges.get(challenge);
  if (!challengeData) {
    trackFailedAttempt(ip);
    return res.status(400).json({ error: 'Unknown or expired challenge' });
  }

  if (challengeData.ip !== ip) {
    console.log('[SECURITY] Challenge reuse attempt from different IP');
    trackFailedAttempt(ip);
    return res.status(403).json({ error: 'Challenge validation failed' });
  }

  const { difficulty } = challengeData;
  const nonceString = nonce.toString();
  const hashInput = challenge + nonceString;

  const hash = crypto.createHash('sha256').update(hashInput).digest('hex');
  const target = '0'.repeat(difficulty);

  console.log('[SUBMIT] Hash:', hash);
  console.log('[SUBMIT] Hash starts with target:', hash.startsWith(target));

  if (hash.startsWith(target)) {
    console.log('[SUBMIT] ✓ SUCCESS - PoW valid from', ip);
    challenges.delete(challenge);
    failedAttempts.delete(ip);

    const redirectUrl = mirrors[Math.floor(Math.random() * mirrors.length)];

    // Check if this is a form submission (no Accept: application/json header)
    if (!req.headers.accept || !req.headers.accept.includes('application/json')) {
      // HTML redirect
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Redirecting...</title>
          <meta http-equiv="refresh" content="2; url=${redirectUrl}">
        </head>
        <body style="font-family: monospace; color: #00ff00; background: #000; padding: 20px;">
          <h1>✓ PoW Verified!</h1>
          <p>Redirecting to: ${redirectUrl}</p>
          <p>If not redirected, <a href="${redirectUrl}" style="color: #00ff00;">click here</a></p>
        </body>
        </html>
      `);
    }

    // JSON response for AJAX
    return res.json({
      success: true,
      redirect: redirectUrl,
      hash,
      nonce
    });
  } else {
    console.log('[SUBMIT] ✗ FAILED - Invalid PoW from', ip);
    trackFailedAttempt(ip);
    return res.status(400).json({
      error: 'Invalid PoW solution',
      hash,
      required: `hash must start with ${target}`
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    mirrors: mirrors.length,
    activeIPs: requestCounts.size,
    bannedIPs: bannedIPs.size
  });
});

// Stats endpoint
app.get('/api/stats', (req, res) => {
  res.json({
    activeChallenges: challenges.size,
    rateLimitedIPs: requestCounts.size,
    bannedIPs: bannedIPs.size,
    trackedFailedAttempts: failedAttempts.size
  });
});

// Start server
app.listen(port, () => {
  console.log(`\n╔════════════════════════════════════════╗`);
  console.log(`║  ObscuraGate PoW Gateway Backend      ║`);
  console.log(`║  Listening on http://localhost:${port}  ║`);
  console.log(`║  Mirrors configured: ${mirrors.length}           ║`);
  console.log(`║  Mode: Server-side PoW with DDoS      ║`);
  console.log(`║  Rate limit: ${MAX_CHALLENGES_PER_MINUTE} challenges/min per IP ║`);
  console.log(`║  Ban threshold: ${BAN_THRESHOLD} failed attempts/hour   ║`);
  console.log(`║  Works with/without JavaScript        ║`);
  console.log(`╚════════════════════════════════════════╝\n`);
});
