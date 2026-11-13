
#!/usr/bin/env node

/**
 * Simple Auto-Labeling Script
 * Detects issue type and applies appropriate labels
 */

const { Octokit } = require("@octokit/rest");

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

const [owner, repo] = (process.env.GITHUB_REPOSITORY || "").split("/");
const issueNumber = process.env.GITHUB_EVENT_ISSUE_NUMBER;

async function autoLabel() {
  try {
    if (!owner || !repo || !issueNumber || !process.env.GITHUB_TOKEN) {
      throw new Error("Missing required GitHub environment variables");
    }

    const issue = await octokit.issues.get({
      owner,
      repo,
      issue_number: Number(issueNumber),
    });

    const { title, body, labels } = issue.data;

    const content = `${title} ${body || ""}`.toLowerCase();
    const currentLabels = labels.map((label) => label.name);

    const labelsToAdd = [];

    // Detect issue type
    if (/\b(bug|error|broken)\b/.test(content)) {
      if (!currentLabels.includes("bug")) {
        labelsToAdd.push("bug");
      }
    } else if (/\b(feature|enhancement|request)\b/.test(content)) {
      if (!currentLabels.includes("enhancement")) {
        labelsToAdd.push("enhancement");
      }
    } else if (/\b(documentation|docs|readme|guide)\b/.test(content)) {
      if (!currentLabels.includes("documentation")) {
        labelsToAdd.push("documentation");
      }
    } else if (content.includes("?") || /\b(how to|question)\b/.test(content)) {
      if (!currentLabels.includes("question")) {
        labelsToAdd.push("question");
      }
    }

    // Check for incomplete issues
    if (!body || body.trim().length < 20) {
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

      console.log(`Added labels: ${labelsToAdd.join(", ")}`);
    } else {
      console.log("No new labels to add.");
    }
  } catch (error) {
    console.error("Auto-label failed:", error.message);
    process.exit(1);
  }
}

autoLabel();
