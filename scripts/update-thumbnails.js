#!/usr/bin/env node

/**
 * Utility script to update thumbnails for existing projects
 * Usage: node scripts/update-thumbnails.js [--dry-run] [--project-id=PROJECT_ID]
 */

import { createInterface } from 'readline';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5173';

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const projectIdArg = args.find(arg => arg.startsWith('--project-id='));
const specificProjectId = projectIdArg ? projectIdArg.split('=')[1] : null;

async function main() {
  console.log('🖼️  Thumbnail Update Utility\n');

  try {
    if (specificProjectId) {
      // Update specific project
      console.log(`Updating thumbnail for project: ${specificProjectId}`);
      await updateSingleProject(specificProjectId, dryRun);
    } else {
      // Check status first
      const status = await checkThumbnailStatus();
      console.log(`📊 Status Check:`);
      console.log(`   Total ready projects: ${status.totalReady}`);
      console.log(`   Projects needing thumbnails: ${status.needingUpdate}`);
      console.log(`   Firecrawl API available: ${status.hasApiKey ? '✅' : '❌'}\n`);

      if (status.needingUpdate === 0) {
        console.log('🎉 All projects already have thumbnails!');
        return;
      }

      if (!status.hasApiKey) {
        console.log('❌ Firecrawl API key not available. Cannot capture real screenshots.');
        return;
      }

      if (dryRun) {
        console.log(`🔍 DRY RUN: Would update ${status.needingUpdate} project thumbnails`);
        return;
      }

      // Ask for confirmation
      const confirmed = await askForConfirmation(
        `This will update ${status.needingUpdate} project thumbnails. Continue? (y/N): `
      );

      if (!confirmed) {
        console.log('❌ Operation cancelled');
        return;
      }

      // Perform bulk update
      console.log('🚀 Starting bulk thumbnail update...\n');
      await updateAllThumbnails();
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

async function checkThumbnailStatus() {
  const response = await fetch(`${API_BASE}/api/projects/update-thumbnails?action=check`);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return await response.json();
}

async function updateSingleProject(projectId, dryRun) {
  if (dryRun) {
    console.log(`🔍 DRY RUN: Would update thumbnail for project ${projectId}`);
    return;
  }

  const response = await fetch(`${API_BASE}/api/projects/update-thumbnails`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ projectId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`HTTP ${response.status}: ${error.error}`);
  }

  const result = await response.json();
  console.log('✅', result.message);
}

async function updateAllThumbnails() {
  const response = await fetch(`${API_BASE}/api/projects/update-thumbnails`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ updateAll: true }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`HTTP ${response.status}: ${error.error}`);
  }

  const result = await response.json();
  console.log('✅', result.message);
  console.log(`   📈 Updated: ${result.updated}`);
  console.log(`   ❌ Failed: ${result.failed}`);
  console.log(`   📊 Total: ${result.total}`);
}

function askForConfirmation(question) {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase().trim() === 'y' || answer.toLowerCase().trim() === 'yes');
    });
  });
}

// Run the script
main();