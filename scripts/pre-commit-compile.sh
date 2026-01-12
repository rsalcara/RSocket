#!/bin/bash

# Pre-commit hook to auto-compile TypeScript if src/ files changed
# Optional: Install with Husky or run manually before commits

set -e

COLORS_RED='\033[0;31m'
COLORS_GREEN='\033[0;32m'
COLORS_YELLOW='\033[1;33m'
COLORS_BLUE='\033[0;34m'
COLORS_CYAN='\033[0;36m'
COLORS_RESET='\033[0m'

echo -e "${COLORS_CYAN}🔍 Pre-commit: Checking if TypeScript compilation is needed...${COLORS_RESET}"

# Check if any .ts files in src/ are staged
STAGED_TS_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '^src/.*\.ts$' || true)

if [ -z "$STAGED_TS_FILES" ]; then
  echo -e "${COLORS_GREEN}✅ No TypeScript files changed - skipping compilation${COLORS_RESET}"
  exit 0
fi

echo -e "${COLORS_BLUE}📝 TypeScript files changed:${COLORS_RESET}"
echo "$STAGED_TS_FILES"

echo -e "\n${COLORS_YELLOW}🔨 Compiling TypeScript...${COLORS_RESET}"

# Compile TypeScript
if npx tsc; then
  echo -e "${COLORS_GREEN}✅ TypeScript compilation successful${COLORS_RESET}"
else
  echo -e "${COLORS_RED}❌ TypeScript compilation failed${COLORS_RESET}"
  echo -e "${COLORS_RED}Please fix compilation errors before committing${COLORS_RESET}"
  exit 1
fi

# Check if lib/ was modified by compilation
LIB_CHANGES=$(git diff --name-only lib/ || true)

if [ -n "$LIB_CHANGES" ]; then
  echo -e "\n${COLORS_YELLOW}📦 lib/ folder was updated by compilation${COLORS_RESET}"
  echo -e "${COLORS_YELLOW}Modified files:${COLORS_RESET}"
  echo "$LIB_CHANGES"

  echo -e "\n${COLORS_BLUE}Adding lib/ changes to this commit...${COLORS_RESET}"
  git add lib/

  echo -e "${COLORS_GREEN}✅ lib/ changes staged and will be included in this commit${COLORS_RESET}"
else
  echo -e "${COLORS_GREEN}✅ lib/ already in sync - no changes needed${COLORS_RESET}"
fi

echo -e "\n${COLORS_CYAN}✅ Pre-commit check complete!${COLORS_RESET}\n"
exit 0
