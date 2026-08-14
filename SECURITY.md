# Security Policy

## Supported Versions

We provide security updates and patches for the following versions of **Figma to Code**:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

---

## Reporting a Vulnerability

The **Figma to Code** team takes security issues seriously. If you discover a security vulnerability in this project, please report it privately rather than creating a public issue.

### How to Report

1. **GitHub Private Vulnerability Reporting (Preferred)**:
   Navigate to the [Security tab](https://github.com/kowshik3383/figma-to-code-plugin/security) of this repository and click **Report a vulnerability**.
2. **Direct Contact**:
   If private vulnerability reporting is unavailable, please open an issue requesting a private communication channel without disclosing vulnerability details publicly.

### What to Include

Please provide:

- A clear description of the vulnerability and its potential impact.
- Step-by-step instructions or proof-of-concept to reproduce the issue.
- Details about the environment (Figma desktop version, browser, OS).
- Any proposed mitigations or fixes if available.

### Response Timeline

- **Acknowledgement**: We aim to acknowledge reports within 48 hours.
- **Assessment**: We will evaluate the impact and investigate the root cause.
- **Resolution**: Once a fix is verified, a patched release will be published along with a security advisory acknowledging your contribution (if desired).

---

## Privacy & Security Architecture

- **Local Execution Only**: All parsing, transpilation, and code generation processes occur entirely within the local sandbox environment of the Figma plugin.
- **Zero Network Traffic**: The plugin's `manifest.json` specifies `"networkAccess": { "allowedDomains": ["none"] }`, forbidding any external network requests.
- **No Telemetry**: No tracking, analytics, third-party pixels, or session recording libraries are used.
