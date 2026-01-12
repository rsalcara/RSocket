#!/usr/bin/env node

/**
 * Baileys Configuration Checker
 *
 * Displays all Baileys-related environment variables and their current values.
 * Useful for debugging configuration issues and verifying settings.
 *
 * Usage:
 *   node scripts/check-baileys-config.js
 *   npm run config:check
 */

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
}

function colorize(text, color) {
  return `${COLORS[color] || ''}${text}${COLORS.reset}`
}

function printHeader(title) {
  console.log('\n' + colorize('═'.repeat(70), 'cyan'))
  console.log(colorize(`  ${title}`, 'bright'))
  console.log(colorize('═'.repeat(70), 'cyan') + '\n')
}

function printConfig(name, value, defaultValue, description) {
  const displayValue = value !== undefined ? value : defaultValue
  const isDefault = value === undefined
  const isEnabled = displayValue === 'true' || displayValue === true

  // Status indicator
  let status = colorize('○', 'gray')
  if (displayValue === 'true' || displayValue === true) {
    status = colorize('●', 'green')
  } else if (displayValue === 'false' || displayValue === false) {
    status = colorize('○', 'red')
  }

  // Value color
  let valueColor = 'cyan'
  if (isDefault) {
    valueColor = 'gray'
  } else if (isEnabled) {
    valueColor = 'green'
  } else if (displayValue === 'false') {
    valueColor = 'red'
  }

  // Format output
  const nameFormatted = colorize(name.padEnd(25), 'bright')
  const valueFormatted = colorize(
    (displayValue || 'undefined').toString().padEnd(15),
    valueColor
  )
  const defaultTag = isDefault ? colorize(' (default)', 'dim') : ''

  console.log(`${status} ${nameFormatted} ${valueFormatted}${defaultTag}`)

  if (description) {
    console.log(`  ${colorize(description, 'gray')}`)
  }
}

function printSection(title, configs) {
  printHeader(title)
  configs.forEach(config => {
    printConfig(
      config.name,
      process.env[config.name],
      config.default,
      config.description
    )
  })
}

function getNodeVersion() {
  return process.version
}

function checkAsyncLocalStorage() {
  try {
    const { AsyncLocalStorage } = require('async_hooks')
    return typeof AsyncLocalStorage !== 'undefined'
  } catch {
    return false
  }
}

// Main configuration sections
const CONFIG_SECTIONS = {
  'Core Logging Configuration': [
    {
      name: 'BAILEYS_LOG',
      default: 'true',
      description: 'Enable/disable all Baileys logging'
    },
    {
      name: 'BAILEYS_OPT',
      default: 'false',
      description: 'Legacy optimization flag (deprecated)'
    },
    {
      name: 'USE_STRUCTURED_LOGS',
      default: 'false',
      description: 'Enable structured JSON logging with Pino'
    },
    {
      name: 'BAILEYS_LOG_LEVEL',
      default: 'info',
      description: 'Minimum log level: trace|debug|info|warn|error|fatal'
    },
    {
      name: 'LOG_LEVEL',
      default: 'info',
      description: 'Global log level (fallback for BAILEYS_LOG_LEVEL)'
    }
  ],

  'Output Format': [
    {
      name: 'LOG_FORMAT',
      default: 'json',
      description: 'Log output format: json|pretty'
    }
  ],

  'Legacy Logger Flags (Optional)': [
    {
      name: 'LOGGER_INFO',
      default: 'true',
      description: 'Enable info level logs (legacy)'
    },
    {
      name: 'LOGGER_WARN',
      default: 'true',
      description: 'Enable warning level logs (legacy)'
    },
    {
      name: 'LOGGER_ERROR',
      default: 'true',
      description: 'Enable error level logs (legacy)'
    },
    {
      name: 'LOGGER_DEBUG',
      default: 'false',
      description: 'Enable debug level logs (legacy)'
    }
  ],

  'APM Integration (Optional)': [
    {
      name: 'DATADOG_API_KEY',
      default: undefined,
      description: 'Datadog API key for log shipping'
    },
    {
      name: 'DATADOG_SERVICE',
      default: undefined,
      description: 'Service name for Datadog'
    },
    {
      name: 'DATADOG_ENV',
      default: undefined,
      description: 'Environment name (production, staging, etc)'
    },
    {
      name: 'NEW_RELIC_LICENSE_KEY',
      default: undefined,
      description: 'New Relic license key'
    },
    {
      name: 'NEW_RELIC_APP_NAME',
      default: undefined,
      description: 'Application name for New Relic'
    }
  ]
}

// Print banner
console.log('\n' + colorize('🔍 BAILEYS CONFIGURATION CHECKER', 'bright'))
console.log(colorize('   Version: 1.0.0', 'dim'))

// Print system info
printHeader('System Information')
console.log(`${colorize('●', 'green')} Node.js Version:      ${colorize(getNodeVersion(), 'cyan')}`)
console.log(`${colorize('●', checkAsyncLocalStorage() ? 'green' : 'yellow')} AsyncLocalStorage:    ${colorize(checkAsyncLocalStorage() ? 'Available ✓' : 'Not Available ⚠', checkAsyncLocalStorage() ? 'green' : 'yellow')}`)
console.log(`${colorize('●', 'green')} Working Directory:    ${colorize(process.cwd(), 'cyan')}`)

// Print each configuration section
Object.entries(CONFIG_SECTIONS).forEach(([title, configs]) => {
  printSection(title, configs)
})

// Print recommendations
printHeader('Configuration Analysis')

const useStructuredLogs = process.env.USE_STRUCTURED_LOGS === 'true'
const baileysLog = process.env.BAILEYS_LOG !== 'false'
const logLevel = process.env.BAILEYS_LOG_LEVEL || process.env.LOG_LEVEL || 'info'
const logFormat = process.env.LOG_FORMAT || 'json'
const hasAsyncLocalStorage = checkAsyncLocalStorage()

console.log(colorize('Current Setup:', 'bright') + '\n')

if (!baileysLog) {
  console.log(colorize('⚠', 'yellow') + '  Baileys logging is DISABLED')
  console.log(colorize('   Set BAILEYS_LOG=true to enable', 'gray'))
} else if (!useStructuredLogs) {
  console.log(colorize('ℹ', 'blue') + '  Using legacy console.log logging')
  console.log(colorize('   For better observability, set USE_STRUCTURED_LOGS=true', 'gray'))
} else {
  console.log(colorize('✓', 'green') + '  Structured logging ENABLED')
  console.log(colorize(`   Format: ${logFormat}, Level: ${logLevel}`, 'gray'))
}

if (useStructuredLogs && !hasAsyncLocalStorage) {
  console.log(colorize('\n⚠', 'yellow') + '  AsyncLocalStorage not available')
  console.log(colorize('   Tracing features require Node.js ≥20', 'gray'))
  console.log(colorize(`   Current version: ${getNodeVersion()}`, 'gray'))
}

// Print recommendations
console.log('\n' + colorize('Recommendations:', 'bright') + '\n')

const recommendations = []

if (!baileysLog) {
  recommendations.push({
    level: 'warn',
    message: 'Enable logging: BAILEYS_LOG=true'
  })
}

if (baileysLog && !useStructuredLogs) {
  recommendations.push({
    level: 'info',
    message: 'Enable structured logs: USE_STRUCTURED_LOGS=true'
  })
}

if (useStructuredLogs && logLevel === 'debug' && process.env.NODE_ENV === 'production') {
  recommendations.push({
    level: 'warn',
    message: 'Debug level in production - consider BAILEYS_LOG_LEVEL=info'
  })
}

if (useStructuredLogs && logFormat === 'pretty' && process.env.NODE_ENV === 'production') {
  recommendations.push({
    level: 'warn',
    message: 'Pretty format in production - consider LOG_FORMAT=json'
  })
}

if (!hasAsyncLocalStorage && useStructuredLogs) {
  recommendations.push({
    level: 'info',
    message: 'Upgrade to Node.js ≥20 for tracing support'
  })
}

if (recommendations.length === 0) {
  console.log(colorize('✓', 'green') + '  Configuration looks good!')
} else {
  recommendations.forEach(rec => {
    const icon = rec.level === 'warn' ? colorize('⚠', 'yellow') : colorize('ℹ', 'blue')
    console.log(`${icon}  ${rec.message}`)
  })
}

// Print examples
printHeader('Quick Configuration Examples')

console.log(colorize('Development (Pretty Logs):', 'bright'))
console.log(colorize('  USE_STRUCTURED_LOGS=true', 'green'))
console.log(colorize('  BAILEYS_LOG_LEVEL=debug', 'green'))
console.log(colorize('  LOG_FORMAT=pretty', 'green'))

console.log('\n' + colorize('Production (JSON Logs):', 'bright'))
console.log(colorize('  USE_STRUCTURED_LOGS=true', 'green'))
console.log(colorize('  BAILEYS_LOG_LEVEL=info', 'green'))
console.log(colorize('  LOG_FORMAT=json', 'green'))

console.log('\n' + colorize('Legacy (Console.log):', 'bright'))
console.log(colorize('  BAILEYS_LOG=true', 'green'))
console.log(colorize('  # USE_STRUCTURED_LOGS not set or false', 'gray'))

console.log('\n' + colorize('═'.repeat(70), 'cyan') + '\n')

// Exit code based on critical issues
const hasCriticalIssues = !baileysLog
process.exit(hasCriticalIssues ? 1 : 0)
