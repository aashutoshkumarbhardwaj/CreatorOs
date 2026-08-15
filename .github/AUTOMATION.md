# 🤖 GitHub Automation

This repository uses **simple, lightweight GitHub Actions** to automate issue management.

## What's Automated

### 1. **Auto-Label Issues** (`.github/workflows/auto-label.yml`)
Runs when issues are opened or edited.
- Detects: bug, enhancement, documentation, question
- Marks incomplete issues with `needs-info` label
- No configuration needed - works out of the box

**Script**: `scripts/auto-label.js`

### 2. **Issue Reminders** (`.github/workflows/issue-reminder.yml`)
Runs every 12 hours.
- Finds open assigned issues inactive for 32+ hours
- Comments reminder once (avoids spam)
- Asks for blockers, progress, and ETA

**Script**: `scripts/remind-issues.js`

### 3. **OpenSSF Criticality Score** (`.github/workflows/criticality-score.yml`)
Runs weekly on Sunday and on `main` push / manual trigger.
- Evaluates repository criticality metric using Rob Pike logarithmic algorithm
- Target threshold: `>= 0.40`
- Generates detailed step summary reports

**Script**: `.github/scripts/calculate-criticality-score.js`

### 4. **OpenSSF Scorecard Analysis** (`.github/workflows/scorecard.yml`)
Runs weekly to check repository supply-chain security best practices.
- Evaluates code reviews, vulnerability scanning, and branch protection
- Publishes SARIF reports to GitHub Code Scanning

## Local Testing

### Test OpenSSF Criticality Score
```bash
export GITHUB_TOKEN="your_token" # optional
export GITHUB_REPOSITORY="owner/repo"

node .github/scripts/calculate-criticality-score.js
```

### Test Auto-Label
```bash
export GITHUB_TOKEN="your_token"
export GITHUB_REPOSITORY_OWNER="your_username"
export GITHUB_REPOSITORY="your_username/repo"
export GITHUB_EVENT_ISSUE_NUMBER="123"

node .github/scripts/auto-label.js
```

### Test Reminders
```bash
export GITHUB_TOKEN="your_token"
export GITHUB_REPOSITORY_OWNER="your_username"
export GITHUB_REPOSITORY="your_username/repo"

node .github/scripts/remind-issues.js
```

## Setup

1. **No setup needed!** Workflows use `${{ secrets.GITHUB_TOKEN }}` which GitHub provides automatically.

2. **To use locally**, generate a personal access token:
   - Go to GitHub → Settings → Developer settings → Personal access tokens
   - Create token with `repo` and `issues` scopes
   - Export as `GITHUB_TOKEN`

## File Structure

```
.github/
  workflows/
    auto-label.yml         # Labels issues automatically
    issue-reminder.yml     # Reminds assignees
    criticality-score.yml  # Calculates OpenSSF Criticality Score
    scorecard.yml          # Runs OpenSSF Scorecard supply-chain security analysis
  scripts/
    auto-label.js          # Labeling logic
    remind-issues.mjs      # Reminder logic
    calculate-criticality-score.js # OpenSSF Criticality calculation logic
  ISSUE_TEMPLATE/          # Issue templates (optional)
  pull_request_template.md
```

## Design Philosophy

✓ **Boring** - Simple, predictable behavior  
✓ **Easy to debug** - Transparent logging  
✓ **No spam** - Reminds only once per issue  
✓ **Maintainable** - <100 lines per script  
✓ **Zero config** - Works immediately  

## Future Additions

When you have more contributors, consider:
- Stale issue auto-closing (30+ days inactive)
- PR greetings for first-time contributors
- Automatic assignment rotation
- Contributor milestone celebrations

For now: **Keep it simple**. Scale when needed.
