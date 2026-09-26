# Security Policy

## Supported versions

Security fixes are targeted at the current `main` branch. Older commits and unreleased branches may not receive security updates.

## Reporting a vulnerability

Please do not open a public GitHub issue for an unpatched security vulnerability.

Use GitHub's private vulnerability reporting feature from this repository's **Security** tab. When submitting a report, include:

- A clear description of the vulnerability and its security impact.
- The affected endpoint, file, component, or feature.
- Reproduction steps or a minimal proof of concept.
- Relevant request/response examples, logs, or screenshots with secrets removed.
- Any suggested mitigation or temporary workaround, if known.

Please allow maintainers reasonable time to investigate and prepare a fix before public disclosure.

## What to expect

Maintainers should acknowledge a valid report, investigate the affected code path, and coordinate remediation or disclosure timing with the reporter.

## Sensitive information

Never include passwords, API keys, access tokens, private credentials, or other secrets in issues, pull requests, or vulnerability reports. Redact sensitive values from logs and examples before sharing them.

## Scope

Security reports involving authentication, authorization, account isolation, CSRF, OAuth, webhooks, billing, data exposure, injection, unsafe file handling, dependency vulnerabilities, or other security-sensitive behavior are in scope.
