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
const requestCounts = new Map(); // Track requests per IP
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_CHALLENGES_PER_MINUTE = 10; // Max challenges per IP per minute
const BAN_THRESHOLD = 100; // Ban after 100 failed attempts per hour
const BAN_DURATION = 60 * 60 * 1000; // 1 hour ban

const bannedIPs = new Map(); // Track banned IPs

// Serve static files from 'public' folder with WASM MIME type support
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.wasm')) {
      res.setHeader('Content-Type', 'application/wasm');
      res.setHeader('Content-Disposition', 'inline');
    }
  },
}));

app.use(express.json());

// In-memory store for issued challenges
const challenges = new Map();
const CHALLENGE_EXPIRY = 5 * 60 * 1000; // 5 minutes

// Track failed attempts per IP
const failedAttempts = new Map();
const FAILED_ATTEMPT_WINDOW = 60 * 60 * 1000; // 1 hour

// Cleanup expired challenges periodically
setInterval(() => {
  const now = Date.now();
  
  // Clean expired challenges
  for (const [key, value] of challenges.entries()) {
    if (now - value.timestamp > CHALLENGE_EXPIRY) {
      challenges.delete(key);
    }
  }
  
  // Clean expired failed attempts
  for (const [ip, data] of failedAttempts.entries()) {
    if (now - data.firstAttempt > FAILED_ATTEMPT_WINDOW) {
      failedAttempts.delete(ip);
    }
  }
  
  // Clean expired bans
  for (const [ip, banTime] of bannedIPs.entries()) {
    if (now - banTime > BAN_DURATION) {
      bannedIPs.delete(ip);
      console.log('[SECURITY] Ban expired for IP:', ip);
    }
  }
}, 30 * 1000); // Check every 30 seconds

// Helper to get client IP
function getClientIP(req) {
  return req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.ip;
}

// Check if IP is rate limited
function checkRateLimit(ip) {
  const now = Date.now();
  
  // Check if banned
  if (bannedIPs.has(ip)) {
    return { allowed: false, reason: 'IP is temporarily banned due to suspicious activity' };
  }
  
  if (!requestCounts.has(ip)) {
    requestCounts.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return { allowed: true };
  }
  
  const data = requestCounts.get(ip);
  
  if (now > data.resetTime) {
    // Reset the counter
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

// API to get a new PoW challenge
app.get('/api/challenge', (req, res) => {
  const ip = getClientIP(req);
  
  // Check rate limit
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
  console.log('[API] Generating challenge:', challenge);

  // Pre-solve the challenge
  console.log('[API] Pre-solving challenge...');
  const nonce = solvePoW(challenge, difficulty);

  // Store challenge with solution for verification
  challenges.set(challenge, {
    difficulty,
    nonce,
    timestamp: Date.now(),
    ip // Track which IP this challenge was issued to
  });

  console.log('[API] Challenge solved. Nonce:', nonce);

  res.json({
    challenge,
    difficulty,
    nonce,
    message: 'Server-computed Proof of Work challenge'
  });
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

  // Verify the challenge came from this IP (prevents reuse from other IPs)
  if (challengeData.ip !== ip) {
    console.log('[SECURITY] Challenge reuse attempt from different IP');
    console.log('[SECURITY] Challenge IP:', challengeData.ip, 'Submission IP:', ip);
    trackFailedAttempt(ip);
    return res.status(403).json({ error: 'Challenge validation failed' });
  }

  const { difficulty } = challengeData;
  const nonceString = nonce.toString();
  const hashInput = challenge + nonceString;

  console.log('[SUBMIT] Validating: Hash input:', hashInput);

  const hash = crypto.createHash('sha256').update(hashInput).digest('hex');
  const target = '0'.repeat(difficulty);

  console.log('[SUBMIT] Hash:', hash);
  console.log('[SUBMIT] Hash starts with target:', hash.startsWith(target));

  if (hash.startsWith(target)) {
    console.log('[SUBMIT] ✓ SUCCESS - PoW valid from', ip);
    challenges.delete(challenge);
    
    // Clear failed attempts on successful submission
    failedAttempts.delete(ip);

    const redirectUrl = mirrors[Math.floor(Math.random() * mirrors.length)];

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

// Stats endpoint (for monitoring)
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
  console.log(`╚════════════════════════════════════════╝\n`);
});
