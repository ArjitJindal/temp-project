#!/usr/bin/env node
const os = require("os");
const fs = require("fs-extra");
const path = require('path')
const { execSync: exec } = require('child_process')
require('dotenv').config()

const { PROJECT_DIR, parse, stringify } = require('./openapi_helpers.js')

async function prepareSchemas(OUTPUT_DIR) {
  try {
    await fs.emptyDir(OUTPUT_DIR)
    const internalDir = path.resolve(OUTPUT_DIR, 'internal')
    const publicDir = path.resolve(OUTPUT_DIR, 'public')
    await fs.ensureDir(internalDir)
    await fs.ensureDir(publicDir)

    const publicSchemaFile = path.resolve(PROJECT_DIR, "lib", "openapi", "openapi-public-original.yaml")
    const publicSchemaText = (await fs.readFile(publicSchemaFile)).toString()
    const publicSchemaYaml = parse(publicSchemaText);

    const internalSchemaFile = path.resolve(PROJECT_DIR, "lib", "openapi", "openapi-internal-original.yaml")
    const internalSchemaText = (await fs.readFile(internalSchemaFile)).toString()
    {
      /*
        todo: this is just a temporal solution, we need a proper way to
        dereference refs to public schema and only copy referenced models
       */

      // Replace all refs to public schema to internal
      const internalSchemaYaml = parse(internalSchemaText.replace(/\.\/openapi-public-original\.yaml#/g, '#'));

      // Merge all models from public schema to internal schema
      // todo: check for override
      internalSchemaYaml.components.schemas = {
        ...internalSchemaYaml.components.schemas,
        ...publicSchemaYaml.components.schemas,
      }
      await fs.writeFile(path.resolve(internalDir, 'openapi-internal-original.yaml'), stringify(internalSchemaYaml));
    }
    {
      await fs.writeFile(path.resolve(publicDir, 'openapi-public-original.yaml'), await stringify(publicSchemaYaml));
    }
  }
  catch(err) {
    console.error(err);
  }
}

async function main() {
  const OUTPUT_DIR = await fs.mkdtemp(path.resolve(os.tmpdir(), 'tarpon-openapi-publish'))
  await prepareSchemas(OUTPUT_DIR)

  let { BRANCH_NAME, PUBLIC_PROJECT_TOKEN, INTERNAL_PROJECT_TOKEN } = process.env

  if (!BRANCH_NAME) {
    BRANCH_NAME = exec("git symbolic-ref --short -q HEAD 2>/dev/null | tr / -").toString().trim()
  }

  if (!BRANCH_NAME) {
    console.error("ERROR: Please set the BRANCH_NAME environment variables");
    process.exit(1)
  }
  if (!PUBLIC_PROJECT_TOKEN) {
    console.error("ERROR: Please set the PUBLIC_PROJECT_TOKEN environment variables");
    process.exit(1)
  }
  if (!INTERNAL_PROJECT_TOKEN) {
    console.error("ERROR: Please set the INTERNAL_PROJECT_TOKEN environment variables");
    process.exit(1)
  }
  console.log("BRANCH_NAME", BRANCH_NAME)

  exec(`./node_modules/.bin/stoplight push --ci-token ${PUBLIC_PROJECT_TOKEN} --directory ${OUTPUT_DIR}/public --branch ${BRANCH_NAME}`)
  exec(`./node_modules/.bin/stoplight push --ci-token ${INTERNAL_PROJECT_TOKEN} --directory ${OUTPUT_DIR}/internal --branch ${BRANCH_NAME}`)

  await fs.remove(OUTPUT_DIR);
}

main().catch((e) => {
  console.error(e)
})
