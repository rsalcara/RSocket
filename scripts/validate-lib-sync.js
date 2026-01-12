#!/usr/bin/env node

/**
 * Validates that lib/ folder is in sync with src/ folder
 *
 * This script:
 * 1. Compiles TypeScript from src/ to a temp directory
 * 2. Compares the compiled output with committed lib/
 * 3. Reports any differences
 *
 * Exit codes:
 * - 0: lib/ is in sync with src/
 * - 1: lib/ is out of sync (needs recompilation)
 * - 2: Compilation failed
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`);
}

function execCommand(command, options = {}) {
  try {
    return execSync(command, {
      encoding: 'utf8',
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options
    });
  } catch (error) {
    if (!options.ignoreError) {
      throw error;
    }
    return null;
  }
}

function main() {
  log('\n🔍 Validating lib/ and src/ synchronization...\n', 'cyan');

  // Step 1: Check if git is clean for lib/
  log('📋 Step 1: Checking git status...', 'blue');
  const gitStatus = execCommand('git status --porcelain lib/', { silent: true, ignoreError: true });

  if (gitStatus && gitStatus.trim()) {
    log('⚠️  Warning: lib/ has uncommitted changes', 'yellow');
    log(gitStatus, 'yellow');
  }

  // Step 2: Compile TypeScript
  log('\n📋 Step 2: Compiling TypeScript...', 'blue');
  try {
    execCommand('npx tsc', { silent: false });
    log('✅ TypeScript compilation successful', 'green');
  } catch (error) {
    log('❌ TypeScript compilation failed', 'red');
    log('Run "npx tsc" to see detailed errors', 'red');
    process.exit(2);
  }

  // Step 3: Check for differences
  log('\n📋 Step 3: Checking for differences...', 'blue');
  const diff = execCommand('git diff --name-only lib/', { silent: true, ignoreError: true });

  if (!diff || !diff.trim()) {
    log('\n✅ SUCCESS: lib/ is in sync with src/\n', 'green');
    log('All compiled files match the source files.', 'green');
    process.exit(0);
  }

  // Step 4: Report differences
  log('\n❌ ERROR: lib/ is out of sync with src/\n', 'red');
  log('The following files have differences:', 'yellow');
  log(diff, 'yellow');

  log('\n📊 Detailed diff:', 'cyan');
  execCommand('git diff lib/');

  log('\n⚠️  SOLUTION:', 'yellow');
  log('1. Run: npm run build:tsc', 'yellow');
  log('2. Review the changes in lib/', 'yellow');
  log('3. Commit the updated lib/ files', 'yellow');
  log('4. Push to repository\n', 'yellow');

  process.exit(1);
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = { main };
