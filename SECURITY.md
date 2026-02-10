# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.7.x   | Yes       |
| < 0.7   | No        |

## Reporting a Vulnerability

If you discover a security vulnerability in ACLI, please report it responsibly.

### How to Report

1. **DO NOT** open a public GitHub Issue for security vulnerabilities.
2. Use [GitHub Security Advisories](https://github.com/lifeprompt-team/acli/security/advisories/new) to report privately.
3. Alternatively, email: **security@lifeprompt.com**

### What to Include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### Response Timeline

| Action | Timeline |
|--------|----------|
| Acknowledgment | Within 48 hours |
| Initial assessment | Within 1 week |
| Patch release | Within 2 weeks of confirmation |

## Security Model

ACLI is designed with a **defense-in-depth** security model for AI agent tool execution.

### Core Guarantees (provided by ACLI)

| Layer | Protection | Description |
|-------|-----------|-------------|
| **Shell-less Execution** | Shell injection prevention | All input is parsed in-process. No shell (`/bin/sh`, `cmd.exe`) is ever invoked. Shell metacharacters (`;`, `|`, `&&`, `$()`, backticks) are treated as literal text. |
| **Command Whitelist** | Command injection prevention | Only explicitly registered commands can be executed. Unknown commands return `COMMAND_NOT_FOUND`. |
| **Argument Validation** | Input validation | All arguments are validated through Zod schemas before reaching handlers. Type mismatches, missing required arguments, and constraint violations are rejected. |
| **DoS Prevention** | Resource exhaustion prevention | Hard limits on command length (10,000 chars), argument count (100), and individual argument length (10,000 chars). |
| **Tokenizer Safety** | Parsing safety | POSIX-like tokenization without shell expansion. No variable substitution, no globbing, no command substitution. |

### Implementation Responsibilities (NOT provided by ACLI)

The following security concerns are **the responsibility of ACLI tool implementers**:

| Concern | Responsibility | Guidance |
|---------|---------------|----------|
| **Path Traversal** | Handler implementation | Validate file paths in your handlers. Reject paths containing `..` or absolute paths if your tool accesses the filesystem. |
| **Authentication & Authorization** | Server implementation | Implement access control in your MCP server or handler middleware. Use the `PERMISSION_DENIED` error code. |
| **Audit Logging** | Server implementation | Log command executions for compliance needs. ACLI provides command and argument data; logging infrastructure is your responsibility. |
| **Rate Limiting** | Server implementation | Implement rate limiting at the MCP server level. Use the `RATE_LIMITED` error code. |
| **Data Sanitization** | Handler implementation | Sanitize data before passing to external systems (databases, APIs, etc.). ACLI validates types but does not sanitize content. |
| **Timeout Handling** | Handler implementation | Implement timeouts for long-running operations. Use the `TIMEOUT` error code. |

### Error Codes for Security Events

ACLI defines standard error codes that implementations SHOULD use:

- `PERMISSION_DENIED` — Authentication or authorization failure
- `RATE_LIMITED` — Too many requests
- `TIMEOUT` — Operation exceeded time limit
- `PATH_TRAVERSAL_BLOCKED` — Path traversal attempt detected (if implemented)

### Dependency Security

- ACLI has **zero runtime dependencies** (zod and MCP SDK are peer dependencies).
- npm packages are published with **provenance** via GitHub Actions for supply chain verification.
- All releases are built in CI from tagged commits on the `main` branch.
