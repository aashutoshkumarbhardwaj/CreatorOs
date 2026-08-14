# 🛡️ OpenSSF Criticality & Security Maintenance Guide

This document outlines the guidelines and best practices for maintainers and contributors of **CreatorOS** to achieve and maintain an **OpenSSF Criticality Score of 0.40 or above** and pass **OpenSSF Scorecard** supply-chain security checks.

---

## 1. What is the OpenSSF Criticality Score?

The **OpenSSF Criticality Score** quantifies the influence, activity, and community adoption of an open-source project on a scale from `0.00` to `1.00`.

### **Formula & Metric Weights**

$$\text{Score} = \frac{\sum w_i \cdot S_i}{\sum w_i}, \quad S_i = \frac{\ln(1 + x_i)}{\ln(1 + T_i)}$$

| Metric | Weight | Threshold ($T_i$) | Description & Maintenance Target |
| :--- | :---: | :---: | :--- |
| **Contributor Count** | `0.20` | 5,000 | Total unique contributors. Encourage community contributions. |
| **Dependents Count** | `0.20` | 50,000 | Downstream repository usage & stargazers. |
| **Created Since** | `0.10` | 120 mo | Project longevity (naturally increases over time). |
| **Updated Recency** | `0.10` | 120 mo | Keeps project active with frequent commits and updates. |
| **Organization Count**| `0.10` | 10 | Diversity of contributor organizations. |
| **Commit Frequency**  | `0.10` | 1,000/wk | Maintain continuous commit cadence (aim for 2+ commits/wk). |
| **Closed Issues (90d)**| `0.05` | 500 | Active resolution of reported issues. |
| **Updated Issues (90d)**| `0.05`| 500 | Keeping issues up-to-date and triage active. |
| **Comment Frequency** | `0.05` | 15 | Active discussions on issues and pull requests. |
| **Recent Releases**   | `0.05` | 26/yr | Tag regular semver releases (aim for bi-weekly/monthly releases). |

---

## 2. Action Plan to Maintain $\ge 0.40$ Criticality Score

1. **Maintain Steady Commit Cadence**: Avoid long periods without commits on `main`. Merge reviewed PRs regularly.
2. **Tag Regular Releases**: Create GitHub Releases (e.g. `v0.1.0`, `v0.2.0`) as new features and fixes land.
3. **Active Issue Triage**: Ensure issues are assigned, commented on, and resolved within expected timelines.
4. **Foster Community Contributors**: Encourage external contributions via GSSoC and open-source hackathons to increase contributor and organization count.
5. **Continuous Monitoring**: The automated `.github/workflows/criticality-score.yml` runs every Sunday and alerts maintainers if the score drops below `0.40`.

---

## 3. OpenSSF Scorecard Supply-Chain Security Best Practices

In addition to criticality, maintain overall security posture by following Scorecard recommendations:

- **Code Review**: Require 1+ approving code review on all pull requests.
- **Dependency Pinning**: Keep `package-lock.json` updated and pin GitHub Action versions to explicit SHAs or semver tags.
- **Vulnerability Scanning**: Remediate Dependabot or Code Scanning alerts promptly.
- **Security Policy**: Maintain `SECURITY.md` with instructions on private vulnerability reporting.
- **Branch Protection**: Protect `main` branch from direct force pushes.

---

## 4. Local Execution & Verification

Run the score calculator locally at any time:

```bash
node .github/scripts/calculate-criticality-score.js
```
