
#!/usr/bin/env node

/**
 * Simple Auto-Labeling Script
 * Automatically detects issue types and applies appropriate labels.
 *
 * Features:
 * - Detects: bug, enhancement, documentation, question
 * - Marks incomplete issues with needs-info
 * - Avoids duplicate labels
 */

const { Octokit } = require("@octokit/rest");

// Initialize GitHub API
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

// Get repository information
const repository = process.env.GITHUB_REPOSITORY;
const owner = process.env.GITHUB_REPOSITORY_OWNER;
const issueNumber = process.env.GITHUB_EVENT_ISSUE_NUMBER;

if (!process.env.GITHUB_TOKEN || !repository || !owner || !issueNumber) {
  console.error("❌ Missing required GitHub Actions environment variables.");
  process.exit(1);
}

const repo = repository.split("/")[1];

async function autoLabel() {
  try {
    // Fetch issue details
    const { data: issue } = await octokit.issues.get({
      owner,
      repo,
      issue_number: Number(issueNumber),
    });

    const title = issue.title || "";
    const body = issue.body || "";

    const content = `${title} ${body}`.toLowerCase();

    // Get existing labels
    const currentLabels = issue.labels.map((label) =>
      typeof label === "string" ? label : label.name
    );

    const labelsToAdd = [];

    // Detect issue type
    if (
      /\b(bug|error|broken|crash|failure)\b/.test(content)
    ) {
      if (!currentLabels.includes("bug")) {
        labelsToAdd.push("bug");
      }
    } else if (
      /\b(feature|enhancement|request|improvement)\b/.test(content)
    ) {
      if (!currentLabels.includes("enhancement")) {
        labelsToAdd.push("enhancement");
      }
    } else if (
      /\b(documentation|docs|readme|guide)\b/.test(content)
    ) {
      if (!currentLabels.includes("documentation")) {
        labelsToAdd.push("documentation");
      }
    } else if (
      content.includes("?") ||
      /\b(how to|question|help)\b/.test(content)
    ) {
      if (!currentLabels.includes("question")) {
        labelsToAdd.push("question");
      }
    }

    // Check for incomplete issues
    if (body.trim().length < 20) {
      if (!currentLabels.includes("needs-info")) {
        labelsToAdd.push("needs-info");
      }
    }

    // Apply labels
    if (labelsToAdd.length > 0) {
      await octokit.issues.addLabels({
        owner,
        repo,
        issue_number: Number(issueNumber),
        labels: labelsToAdd,
      });

      console.log(`✅ Added labels: ${labelsToAdd.join(", ")}`);
    } else {
      console.log("ℹ️ No new labels required.");
    }
  } catch (error) {
    console.error("❌ Auto-label failed:", error.message);
    process.exit(1);
  }
}

// Execute script
autoLabel();
