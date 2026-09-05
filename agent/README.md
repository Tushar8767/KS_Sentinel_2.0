# Local Sentinel Agent (KS Sentinel 2.0)

**Module:** 3 — Local Sentinel Agent & Module 4 — Remote Machine Information  
**Status:** ACTIVE BASELINE  

---

## 1. Overview

The **Local Sentinel Agent** is the local Windows-side background process responsible for securely communicating with the KS Sentinel Server Gateway. It provides a stable identity, explicit lifecycle management, health monitoring, capability discovery, and read-only host machine telemetry.

```text
KS Sentinel Web OS (Browser)
        ↓ HTTP / Proxy
Secure Server Gateway (Express on port 5000)
    GET  /api/agent/status
    GET  /api/machine/info       <-- Module 4: Read-Only Host Telemetry
    POST /api/agent/register
    POST /api/agent/heartbeat
    POST /api/agent/disconnect
        ↑ Safe Loopback / TLS Communication
Local Sentinel Agent (Windows host process)
    ├── Identity (agentId, platform, nodeVersion)
    ├── Lifecycle (STARTING -> READY -> CONNECTING -> CONNECTED -> STOPPING -> STOPPED)
    ├── Capability Registry (machine.info.read)
    └── Machine Info Provider (CPU, Memory, Storage, Host, Network)
```

---

## 2. Capabilities

### `machine.info.read` (Module 4)
- **ID:** `machine.info.read`
- **Type:** Read-Only
- **Scope:** Collects safe host hardware & OS metadata:
  - Hostname, OS platform, architecture, release, uptime
  - CPU model, core/thread count, clock speed
  - System memory total, free, used, usage percentage
  - Storage drive total, free, used, usage percentage (via `fs.statfsSync`)
  - Active non-internal IPv4 interfaces
- **Security:** Pure Node.js C-library calls (`os`, `fs.statfsSync`). Zero shell invocations, zero subprocesses.

---

## 3. Strict Security Boundary

In strict adherence to the KS Sentinel Security Boundary:
- ❌ **No Arbitrary Shell Execution:** No `exec()`, `spawn()`, PowerShell, or cmd.exe execution.
- ❌ **No Shell Telemetry Tools:** No `wmic`, `powershell`, `cmd`, `systeminfo`, `netstat`, or `ipconfig`.
- ❌ **No Direct Browser Access:** The browser never communicates directly with the Local Agent; all interaction is mediated by the Gateway.
- ❌ **No Filesystem Browsing:** No arbitrary directory traversal or file reading/writing.
- ❌ **No Process Control:** No process inspection or termination.
- ❌ **No Trust/Policy Bypass:** The Agent does not grant authority or make authorization decisions.

---

## 4. Configuration

Configure the agent using environment variables or a local `.env` file based on `.env.example`:

| Variable | Default | Description |
| :--- | :--- | :--- |
| `GATEWAY_URL` | `http://localhost:5000` | Secure Gateway HTTP/TLS base URL |
| `AGENT_ID` | `sentinel_agent_<platform>_<pid>` | Unique agent identifier |
| `AGENT_NAME` | `Local Sentinel Host Service` | Descriptive label |
| `HEARTBEAT_INTERVAL_MS` | `5000` | Frequency of heartbeat pings (ms) |
| `NODE_ENV` | `development` | Node execution environment |

---

## 5. Startup & Usage

### Start the Agent Standalone:
```bash
cd agent
npm start
```

### From Project Root:
```bash
npm run agent
# or in development watch mode:
npm run dev:agent
```

### Run Tests:
```bash
npm --prefix agent test
```
