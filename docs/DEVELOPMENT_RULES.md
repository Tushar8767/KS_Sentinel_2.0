# KS Sentinel 2.0 — Development Rules & Governance

**Module:** 0 — Architecture Foundation  
**Status:** LOCKED GOVERNANCE POLICY  

---

## 1. Locked Module Development Lifecycle

Every module in KS Sentinel 2.0 must follow this exact sequential lifecycle without exception:

```text
DESIGN
  ↓
IMPLEMENT
  ↓
TEST
  ↓
SECURITY TEST
  ↓
BUILD
  ↓
GIT COMMIT
  ↓
LOCK MODULE
  ↓
NEXT MODULE
```

---

## 2. Mandatory Rules of Engagement

1. **One Module at a Time:**
   Work is strictly scoped to the active module. Never jump ahead to implement features belonging to future modules.

2. **No Unnecessary Application Features:**
   Do not add unrequested utility methods, speculative endpoints, or placeholder UI components outside the scope of the target module.

3. **No Superficial Symptom Patches:**
   When tests fail or build errors occur, identify and resolve the root cause. Never swallow errors, return dummy fallbacks, comment out broken assertions, or delete failing unit tests.

4. **Never Guess API Contracts or Schemas:**
   Inspect existing source code and configuration files before consuming or extending APIs.

5. **Empirical Verification Required:**
   No module or task is complete until automated tests and manual build/start commands have been executed and verified clean.

---

## 3. Core Architectural Principles

- **Local-first:** System state and control reside on the local user machine.
- **Least privilege:** Request and grant only the absolute minimum permissions required.
- **Explicit authorization:** All access to local resources must be explicitly authorized by the user.
- **No unrestricted filesystem access:** Path-restricted, capability-bounded access only.
- **No unrestricted shell execution:** No arbitrary shell/command execution endpoints.
- **AI is not authority:** AI models cannot grant permissions, bypass security checks, or act as system authority.
- **Sensitive actions require policy and authorization:** Multi-layer evaluation via Trust, Authority, Policy, and Execution Broker.
- **Modular architecture:** Independent, clean separation across Client, Server Gateway, and Local Agent.
- **Clear boundaries:** Strict interface definitions between web browser, server, and local agent.
- **Independently testable:** Every major module must include automated verification tests.

---

## 4. Antigravity Assistant Instructions

Antigravity operates as an implementation assistant within the parameters set by this baseline. Each module task must specify:
1. Target module
2. Exact objective
3. Existing architecture context
4. Exact files allowed to change
5. API contract specifications
6. Security restrictions
7. Acceptance criteria
8. Required automated tests

