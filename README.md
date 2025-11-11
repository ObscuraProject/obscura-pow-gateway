# ObscuraGate PoW Gateway

**A Proof-of-Work Authentication Gateway with WebAssembly Support for JavaScript-Disabled Browsers**

## Overview

ObscuraGate PoW Gateway is a complete authentication system that uses Proof-of-Work (PoW) challenges to verify user legitimacy before granting access. Uniquely designed to work in restricted browser environments where JavaScript may be disabled by default.

### Key Features

✓ **Minimal JavaScript** - Only ~200 lines of JS needed to load and execute WebAssembly  
✓ **WebAssembly-Powered** - SHA-256 PoW computation using Rust compiled to WASM  
✓ **Multiple Mirror Support** - Redirect authenticated users to any of multiple configured links  
✓ **Challenge Expiry** - Prevent brute-force attacks with automatic challenge invalidation  
✓ **Server-Side Verification** - All PoW solutions verified on backend  
✓ **Configurable Difficulty** - Adjust computational requirements per use case  
✓ **Production Ready** - Includes security considerations and deployment guides  

## Quick Start

### Prerequisites
```bash
node --version          # v14 or higher
rustc --version         # Latest stable
wasm-pack --version     # Installed via cargo
```

### Installation (5 minutes)

```bash
# 1. Create project structure
mkdir -p obscuragate-pow-gateway/{backend/public/wasm,rust-pow/src}
cd obscuragate-pow-gateway

# 2. Copy all source files (from this ZIP)

# 3. Build WASM
cd rust-pow
wasm-pack build --target web --release
cp pkg/obscuragate_pow_bg.wasm ../backend/public/wasm/
cd ../backend

# 4. Install dependencies
npm install

# 5. Start server
npm start

# 6. Open browser
# Navigate to http://localhost:3000
```

## API Reference

### GET /api/challenge
Retrieves a new Proof-of-Work challenge.

### POST /api/submit
Submits a Proof-of-Work solution for verification.

### GET /api/health
Health check endpoint.

## Documentation

See the included markdown files:
- **QUICKSTART.md** - 5-minute setup guide
- **INSTALL.md** - Detailed installation instructions
- **CONFIG.md** - Configuration reference
- **ARCHITECTURE.md** - Technical architecture
- **DELIVERY.md** - File organization guide
- **INDEX.md** - Documentation index

## Technology Stack

| Component | Technology |
|-----------|-----------|
| Backend | Node.js v14+ |
| Web Framework | Express.js |
| WASM Computation | Rust |
| Frontend | HTML5/CSS3 |

## Security Features

✓ Cryptographically secure random challenge generation  
✓ Single-use challenges (one submission per challenge)  
✓ Automatic challenge expiry (configurable TTL)  
✓ Server-side solution verification only  
✓ SHA-256 based difficulty system  

## Performance

- WASM Module Load: 100-300ms
- Difficulty 3 Solve: ~1 second
- Difficulty 4 Solve: ~3-5 seconds (default)
- Difficulty 5 Solve: ~10-20 seconds
- Backend Verification: <50ms

## Docker Deployment

```bash
docker-compose up -d
```

Access at: http://localhost:3000

## License

Proprietary - Modify as needed for your deployment.

---

**Start with QUICKSTART.md for a 5-minute setup!**
