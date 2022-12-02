#!/usr/bin/env node
const { execSync: exec } = require('child_process')
require('dotenv').config()

async function main() {
  const OUTPUT_DIR = './dist/openapi'
  let {
    BRANCH_NAME,
    CONFIRM_PUSH_MAIN,
    PUBLIC_PROJECT_TOKEN,
    PUBLIC_MANAGEMENT_PROJECT_TOKEN,
    INTERNAL_PROJECT_TOKEN,
  } = process.env

  if (!BRANCH_NAME) {
    BRANCH_NAME = exec('git symbolic-ref --short -q HEAD 2>/dev/null | tr / -')
      .toString()
      .trim()
  }

  if (!BRANCH_NAME) {
    console.error('ERROR: Please set the BRANCH_NAME environment variables')
    process.exit(1)
  }

  console.log('BRANCH_NAME:', BRANCH_NAME)
  if (BRANCH_NAME === 'main' && CONFIRM_PUSH_MAIN !== 'true') {
    console.error(
      'ERROR: To push to main branch, please, also provide CONFIRM_PUSH_MAIN=true environment variable'
    )
    process.exit(1)
  }

  if (!PUBLIC_PROJECT_TOKEN) {
    console.error(
      'ERROR: Please set the PUBLIC_PROJECT_TOKEN environment variables'
    )
    process.exit(1)
  }
  if (!PUBLIC_MANAGEMENT_PROJECT_TOKEN) {
    console.error(
      'ERROR: Please set the PUBLIC_MANAGEMENT_PROJECT_TOKEN environment variables'
    )
    process.exit(1)
  }
  if (!INTERNAL_PROJECT_TOKEN) {
    console.error(
      'ERROR: Please set the INTERNAL_PROJECT_TOKEN environment variables'
    )
    process.exit(1)
  }

  exec(
    `./node_modules/.bin/stoplight push --ci-token ${PUBLIC_PROJECT_TOKEN} --directory ${OUTPUT_DIR}/public --branch ${BRANCH_NAME}`
  )
  exec(
    `./node_modules/.bin/stoplight push --ci-token ${PUBLIC_MANAGEMENT_PROJECT_TOKEN} --directory ${OUTPUT_DIR}/public-management --branch ${BRANCH_NAME}`
  )
  exec(
    `./node_modules/.bin/stoplight push --ci-token ${INTERNAL_PROJECT_TOKEN} --directory ${OUTPUT_DIR}/internal --branch ${BRANCH_NAME}`
  )
  console.log('Publish completed.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
