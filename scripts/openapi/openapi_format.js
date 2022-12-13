#!/usr/bin/env node
const path = require('path')
const { reformatFile, PROJECT_DIR } = require('./openapi_helpers.js')

async function main() {
  try {
    await reformatFile(
      path.resolve(
        PROJECT_DIR,
        'lib',
        'openapi',
        'internal',
        'openapi-internal-original.yaml'
      )
    )
    await reformatFile(
      path.resolve(
        PROJECT_DIR,
        'lib',
        'openapi',
        'public',
        'openapi-public-original.yaml'
      )
    )
    await reformatFile(
      path.resolve(
        PROJECT_DIR,
        'lib',
        'openapi',
        'public-management',
        'openapi-public-management-original.yaml'
      )
    )
  } catch (err) {
    console.error(err)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
