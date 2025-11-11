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

// Cleanup expired challenges periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of challenges.entries()) {
    if (now - value.timestamp > CHALLENGE_EXPIRY) {
      challenges.delete(key);
    }
  }
}, 60 * 1000);

// Helper to generate random challenge string
function generateChallenge() {
  return crypto.randomBytes(16).toString('hex');
}

// API to get a new PoW challenge
app.get('/api/challenge', (req, res) => {
  const challenge = generateChallenge();
  const difficulty = 4;

  challenges.set(challenge, {
    difficulty,
    timestamp: Date.now()
  });

  res.json({
    challenge,
    difficulty,
    message: 'Solve this PoW challenge by finding a nonce such that SHA256(challenge + nonce) starts with the required leading zeros'
  });
});

// API to submit PoW solution
app.post('/api/submit', (req, res) => {
  const { challenge, nonce } = req.body;

  if (!challenge || nonce === undefined) {
    return res.status(400).json({ error: 'Missing challenge or nonce' });
  }

  const challengeData = challenges.get(challenge);
  if (!challengeData) {
    return res.status(400).json({ error: 'Unknown or expired challenge' });
  }

  const { difficulty } = challengeData;
  const hashInput = challenge + nonce.toString();
  const hash = crypto.createHash('sha256').update(hashInput).digest('hex');
  const target = '0'.repeat(difficulty);

  if (hash.startsWith(target)) {
    challenges.delete(challenge);
    const redirectUrl = mirrors[Math.floor(Math.random() * mirrors.length)];

    return res.json({
      success: true,
      redirect: redirectUrl,
      hash,
      nonce
    });
  } else {
    return res.status(400).json({
      error: 'Invalid PoW solution',
      hash,
      required: `hash must start with ${target}`
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', mirrors: mirrors.length });
});

// Start server
app.listen(port, () => {
  console.log(`\n╔════════════════════════════════════════╗`);
  console.log(`║  ObscuraGate PoW Gateway Backend      ║`);
  console.log(`║  Listening on http://localhost:${port}  ║`);
  console.log(`║  Mirrors configured: ${mirrors.length}           ║`);
  console.log(`║  WASM Module: /wasm/obscuragate_pow_bg.wasm ║`);
  console.log(`╚════════════════════════════════════════╝\n`);
});
