# Automated Test Suite

**Module:** 0 — Architecture Foundation  

---

## Test Organization

```text
tests/
├── server/
│   └── health.test.js    # Gateway health check & security boundary tests
└── README.md
```

---

## Running Tests

Execute all tests from the root directory:

```bash
npm test
```

Or run Node test runner directly:

```bash
node --test tests/server/health.test.js
```

