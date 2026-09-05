# Local Sentinel Agent (Placeholder Baseline)
# Local Sentinel Agent (KS Sentinel 2.0)

**Module:** 0 — Architecture Foundation  
**Target Module for Implementation:** Module 3 — Local Sentinel Agent  
**Module:** 3 — Local Sentinel Agent  
**Status:** ACTIVE BASELINE  

---

## Purpose
## 1. Overview

The **Local Sentinel Agent** is a Windows host background application/service responsible for communicating securely with the Server Gateway and executing authorized host capabilities.
The **Local Sentinel Agent** is the local Windows-side background process responsible for securely communicating with the KS Sentinel Server Gateway. It provides a stable identity, explicit lifecycle management, health monitoring, and the foundation for future capability brokering.

```text
KS Sentinel Web OS (Browser)
        ↓ HTTP / Proxy
Secure Server Gateway (Express on port 5000)
    GET  /api/agent/status
    POST /api/agent/register
    POST /api/agent/heartbeat
    POST /api/agent/disconnect
        ↑ Safe Loopback / TLS Communication
Local Sentinel Agent (Windows host process)
        ↓ (Future Modules: Validated Capability Hooks)
Authorized Machine Capabilities
```

---

## Architectural Role
## 2. Module 3 Scope: What the Agent Does

```text
Server Gateway
      ↓ (Encrypted Capability Messages)
Local Sentinel Agent
      ↓ (Host APIs / Native Commands)
Windows Host Machine Resources
```
1. **Process & Identity Management:** Provides a stable agent identifier (`agentId`, `agentVersion`, `protocolVersion`, `platform`, `nodeVersion`).
2. **Explicit Lifecycle States:**
   $$\text{STARTING} \rightarrow \text{READY} \rightarrow \text{CONNECTING} \rightarrow \text{CONNECTED} \rightarrow \text{STOPPING} \rightarrow \text{STOPPED}$$
3. **Secure Gateway Communication:**
   - **Handshake / Registration:** Registers identity with the Gateway via `POST /api/agent/register`.
   - **Heartbeat:** Periodically confirms liveness via `POST /api/agent/heartbeat`.
   - **Clean Disconnect:** Notifies the Gateway of planned shutdowns via `POST /api/agent/disconnect`.
4. **Health Reporting:** Exposes agent process health (`status`, `uptimeSeconds`, `lifecycleState`, `connected`, `capabilitiesCount`).
5. **Capability Discovery Foundation:** Establishes the capability catalog interface. In Module 3, the capability catalog contains zero executable hooks.

---

## Security Restrictions
## 3. Strict Security Boundary: What the Agent Intentionally Does NOT Do

- No arbitrary shell string execution.
- No direct client-to-agent connection bypassing Gateway security token checks.
- Sandboxed to explicit user-authorized paths and capability hooks.
In strict adherence to the KS Sentinel Security Boundary:
- ❌ **No Arbitrary Shell Execution:** No `exec()`, `spawn()`, PowerShell, or cmd.exe execution.
- ❌ **No Direct Browser Access:** The browser never communicates directly with the Local Agent; all interaction is mediated by the Gateway.
- ❌ **No Machine Telemetry:** Host metrics (CPU, RAM, storage, process lists) are not collected in Module 3 (belong to Module 4).
- ❌ **No Filesystem Manipulation:** No arbitrary file reading or writing.
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
