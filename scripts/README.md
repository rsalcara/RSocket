# Scripts Directory

Utility scripts for development, validation, and release processes.

## 📋 Available Scripts

### 1. `validate-lib-sync.js`

**Purpose:** Validates that compiled `lib/` folder is in sync with `src/` source files.

**Usage:**
```bash
# Via npm script (recommended)
npm run validate:lib-sync

# Direct execution
node scripts/validate-lib-sync.js
```

**Exit Codes:**
- `0` - lib/ is in sync ✅
- `1` - lib/ is out of sync ❌
- `2` - TypeScript compilation failed ❌

**Example Output:**
```
🔍 Validating lib/ and src/ synchronization...

📋 Step 1: Checking git status...
📋 Step 2: Compiling TypeScript...
✅ TypeScript compilation successful
📋 Step 3: Checking for differences...

✅ SUCCESS: lib/ is in sync with src/
```

**When to Use:**
- Before creating pull requests
- Before releases
- After making changes to `src/`
- Automatically runs via CI/CD

---

### 2. `pre-commit-compile.sh`

**Purpose:** Git pre-commit hook that auto-compiles TypeScript when `src/` files change.

**Setup:**
```bash
# Make executable
chmod +x scripts/pre-commit-compile.sh

# Install as git hook
ln -s ../../scripts/pre-commit-compile.sh .git/hooks/pre-commit

# Or with Husky (if available)
npx husky add .husky/pre-commit "bash scripts/pre-commit-compile.sh"
```

**What it Does:**
1. Detects if `.ts` files in `src/` are staged
2. Compiles TypeScript automatically
3. Stages `lib/` changes to include in commit
4. Fails commit if compilation errors

**Example Output:**
```
🔍 Pre-commit: Checking if TypeScript compilation is needed...

📝 TypeScript files changed:
src/Utils/retry-utils.ts

🔨 Compiling TypeScript...
✅ TypeScript compilation successful

📦 lib/ folder was updated by compilation
Modified files:
lib/Utils/retry-utils.js
lib/Utils/retry-utils.d.ts

Adding lib/ changes to this commit...
✅ lib/ changes staged and will be included in this commit

✅ Pre-commit check complete!
```

**Benefits:**
- Never forget to compile
- Atomic commits (src + lib together)
- Catches TypeScript errors before commit
- Optional - not required

---

## 🔧 Integration with CI/CD

These scripts are integrated into GitHub Actions workflows:

### CI Validation
**Workflow:** `.github/workflows/validate-lib-sync.yml`
- Runs on: Every push, every PR
- Uses: `validate-lib-sync.js` logic

### Release Workflows
**Workflows:**
- `.github/workflows/publish-release.yml`
- `.github/workflows/manual-release.yml`

Both run:
1. `npm run validate:lib-sync` - Validate before release
2. `npm run build:tsc` - Safety recompilation
3. Verify no changes - Fail if lib/ changed

---

## 📚 See Also

- **Release Process:** [`../RELEASE_PROCESS.md`](../RELEASE_PROCESS.md)
- **Package Scripts:** [`../package.json`](../package.json) - See `scripts` section
- **CI Workflows:** [`../.github/workflows/`](../.github/workflows/)

---

## 🆘 Troubleshooting

### Script Permission Denied

```bash
chmod +x scripts/validate-lib-sync.js
chmod +x scripts/pre-commit-compile.sh
```

### Hook Not Running

```bash
# Check if installed
ls -la .git/hooks/pre-commit

# Reinstall
rm .git/hooks/pre-commit
ln -s ../../scripts/pre-commit-compile.sh .git/hooks/pre-commit
```

### Validation Fails

```bash
# See detailed diff
npm run validate:lib-sync

# Manually compile
npm run build:tsc

# Check what changed
git diff lib/
```

---

## 🎯 Quick Reference

| Task | Command |
|------|---------|
| Validate sync | `npm run validate:lib-sync` |
| Compile TypeScript | `npm run build:tsc` |
| Install pre-commit hook | `ln -s ../../scripts/pre-commit-compile.sh .git/hooks/pre-commit` |
| Check hook status | `ls -la .git/hooks/pre-commit` |
| Remove hook | `rm .git/hooks/pre-commit` |
