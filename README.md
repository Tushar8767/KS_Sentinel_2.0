# KS Sentinel 2.0

**KS Sentinel 2.0** is a web-based Virtual Operating Environment designed to provide secure, controlled remote access to authorized local-machine resources, development environments, system state, AI services, and cybersecurity capabilities.

🔗 **[Live Demo](https://ks-sentinel-server.onrender.com/)** *(Active instance: [ks-sentinel-2-0.onrender.com](https://ks-sentinel-2-0.onrender.com/))* · **[GitHub Repository](https://github.com/Tushar8767/KS_Sentinel_2.0)**

> [!IMPORTANT]
> **Status:** Module 0 Baseline Established (Architecture Foundation)  
> All security boundaries, repository structures, and governance documentation are locked.

---

## High-Level Architecture

```text
CLIENT (React + Vite)
        ↓ HTTP / API
SERVER GATEWAY (Node.js + Express)
        ↓ Secure Capability Broker (IPC / WS)
LOCAL SENTINEL AGENT (Windows Service / App)
        ↓
AUTHORIZED LOCAL MACHINE CAPABILITIES
```

---

## Directory Structure

```text
KS_Sentinel_2.0/
├── client/          # Frontend React + Vite Virtual OS application
├── server/          # Express API & Secure Gateway
├── agent/           # Local Sentinel Agent (Windows host application space)
├── docs/            # Architectural & Governance Documentation
├── scripts/         # Development and build helper scripts
├── tests/           # Integration & automated test scripts
├── .env.example     # Environment template
├── .gitignore       # Git ignore specifications
├── package.json     # Workspace root configuration
└── README.md        # Project landing page
```

---

## Core Principles

1. **Local-first** — Control remains on the user's host machine.
2. **Least privilege** — Grant only explicit, granular access.
3. **Explicit authorization** — User defines exactly what paths and operations are permitted.
4. **No unrestricted filesystem access** — Sandboxed access to authorized folders only.
5. **No unrestricted shell execution** — Pre-defined capability APIs instead of arbitrary terminal commands.
6. **AI is not authority** — AI cannot self-grant permissions or execute administrative actions.
7. **Sensitive actions require policy and authorization** — Multistep validation for non-trivial actions.
8. **Modular architecture** — 28 strict modules (0 through 27) built sequentially.
9. **Clear frontend/backend/agent boundaries** — Distinct responsibilities and network boundaries.
10. **Every major module must be independently testable** — End-to-end and unit testing required per module.

---

## Documentation

Comprehensive documentation is available in the [`docs/`](./docs/) directory:

- [ARCHITECTURE.md](./docs/ARCHITECTURE.md) — System boundaries, components, execution broker, trust pipeline.
- [MODULES.md](./docs/MODULES.md) — The locked 0–27 module roadmap.
- [SECURITY_BOUNDARY.md](./docs/SECURITY_BOUNDARY.md) — Sandbox limits, Local Agent rationale, capability model.
- [DEVELOPMENT_RULES.md](./docs/DEVELOPMENT_RULES.md) — Governance lifecycle: `DESIGN → IMPLEMENT → TEST → SECURITY TEST → BUILD → GIT COMMIT → LOCK MODULE → NEXT MODULE`.

---

## Getting Started

### Prerequisites
- Node.js (v18+)
- npm (v9+)

### Installation

Install dependencies across workspace packages:
```bash
npm install
```

### Running the Project

#### Run Client & Server Concurrently
```bash
npm run dev
```

#### Run Client Independently
```bash
npm run dev:client
```
Accessible at: `http://localhost:5173`

#### Run Server Gateway Independently
```bash
npm run dev:server
```
API endpoint check: `http://localhost:5000/api/health`

### Testing & Verification
```bash
npm test
```

