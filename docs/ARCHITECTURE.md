# KS Sentinel 2.0 — Architecture Specification

**Module:** 0 — Architecture Foundation  
**Status:** LOCKED ARCHITECTURAL BASELINE  

---

## System Overview

KS Sentinel 2.0 is a web-based Virtual Operating Environment designed to provide secure, controlled remote access to authorized local-machine resources, development environments, system state, AI services, and cybersecurity capabilities.

It decouples the user interface from direct OS execution using a three-tier architecture:

```text
Web OS Client (React + Vite)
        ↓ HTTP / WebSocket (Secure Session)
Secure Server Gateway (Node.js + Express)
        ↓ Authenticated Capability IPC / TLS
Local Sentinel Agent (Windows Local Service)
        ↓ Validated API Hooks
Windows Host Capabilities
```

---

## Architectural Components

### 1. Web OS Client
- **Role:** Primary visual workspace and user interaction interface.
- **Technology:** React, Vite, React Router.
- **Responsibilities:**
  - Renders the virtual desktop, window manager, dashboard, and application windows.
  - Formulates structured requests to the Secure Gateway.
  - Maintains zero direct access to host OS APIs or browser-escaped resources.

### 2. Secure Server Gateway
- **Role:** Secure proxy, session authenticator, and request router.
- **Technology:** Node.js, Express.
- **Responsibilities:**
  - Authenticates user client sessions.
  - Validates API request syntax and parameters.
  - Enforces high-level CORS, rate limiting, and input sanitization.
  - Forwards authorized actions to the Local Sentinel Agent.
  - Prevents arbitrary command injection by exposing strictly defined capability endpoints.

### 3. Local Sentinel Agent
- **Role:** Host machine executor and state provider.
- **Technology:** Windows-compatible application / background service.
- **Responsibilities:**
  - Manages heartbeat connection with the Server Gateway.
  - Holds local authorization policies (e.g. approved paths, process rules).
  - Executes explicit capability commands (e.g., retrieving system metrics, querying approved git status).
  - Isolates web clients from direct Windows API / shell invocations.

### 4. Execution Broker (Future Architecture)
- **Role:** Action validation gatekeeper between intent and execution.
- **Responsibilities:**
  - Intercepts all state-modifying requests before reaching the Local Agent.
  - Evaluates action risk levels (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`).
  - Requires step-up confirmation or policy checks for destructive operations.

---

## Security Pipeline: Trust / Authority / Policy

Every request that affects system state or retrieves host information must traverse the security pipeline:

```text
User / AI Intent
       ↓
Action Service
       ↓
Trust Evaluation (Is the session & client authenticated?)
       ↓
Authority Check (Does the role/user have privilege for this capability?)
       ↓
Policy Verification (Is the target path/resource within authorized bounds?)
       ↓
Execution Broker (Formulate validated command packet)
       ↓
Local Sentinel Agent (Execute validated host call)
       ↓
Windows OS
```

---

## Communication Boundaries

1. **Client ↔ Gateway Boundary:**
   - Transport: HTTPS / WebSockets.
   - Authentication: Session Tokens / Bearer Tokens.
   - Access Model: REST API endpoints limited to validated schema inputs.

2. **Gateway ↔ Local Agent Boundary:**
   - Transport: Encrypted Local IPC / TLS WebSocket.
   - Authentication: Cryptographic Agent Token / Mutual Auth.
   - Protocol: Structured JSON Capability Messages (No raw shell string execution).

3. **Local Agent ↔ Host OS Boundary:**
   - Transport: Native Node / System APIs.
   - Scope: Sandboxed strictly to user-granted resource paths.

---

## Capability-Based Access Control Model

KS Sentinel 2.0 rejects arbitrary terminal execution (`/api/execute` or raw shell strings). All interaction with the local machine must occur through **pre-defined, validated capability messages**.

### Example Future Capability Specs (Illustrative Only — Not Implemented in Module 0):

| Capability ID | Description | Risk Level | Target Scope |
| :--- | :--- | :--- | :--- |
| `GET_MACHINE_STATUS` | Check if agent & machine are online | `LOW` | Read-only state |
| `GET_SYSTEM_INFO` | Retrieve CPU, RAM, OS metrics | `LOW` | Read-only telemetry |
| `GET_AUTHORIZED_FILES` | List explicitly authorized workspace paths | `LOW` | Read-only paths |
| `GET_GIT_STATUS` | Query Git branch & change set for project | `LOW` | Authorized Git directory |
| `OPEN_VSCODE` | Launch VS Code editor at authorized project path | `MEDIUM` | Host Application |
| `OPEN_EXPLORER` | Launch Windows File Explorer at authorized path | `MEDIUM` | Host Application |
| `GET_PROCESS_LIST` | List active background processes | `MEDIUM` | Host Telemetry |

---

## Core Security Rules

- **AI is NOT Authority:** AI services (Module 11–13) can suggest actions or generate code, but cannot override policies or bypass the Execution Broker.
- **Explicit Path Scoping:** File access requires explicit user authorization per directory or project.
- **Audit Logging:** Every capability request, success, or failure must be recorded in the system audit stream.

