#!/usr/bin/env node
const os = require("os");
const fs = require("fs-extra");
const path = require('path')
const yaml = require('yaml')
const { execSync: exec } = require('child_process')
require('dotenv').config()

const { PROJECT_DIR, parse, stringify, localizeRefs } = require('./openapi_helpers.js')

async function prepareSchemas(OUTPUT_DIR) {
  try {
    const internalDir = path.resolve(PROJECT_DIR, "lib", "openapi", "internal")
    const publicDir = path.resolve(PROJECT_DIR, "lib", "openapi", "public")

    const internalDirOutput = path.resolve(OUTPUT_DIR, 'internal')
    const publicDirOutput = path.resolve(OUTPUT_DIR, 'public')

    await fs.ensureDir(internalDirOutput)
    await fs.ensureDir(publicDirOutput)

    const publicSchemaFile = path.resolve(publicDir, "openapi-public-original.yaml")
    const publicSchemaText = (await fs.readFile(publicSchemaFile)).toString()
    const publicSchemaYaml = parse(publicSchemaText);

    const internalSchemaFile = path.resolve(internalDir, "openapi-internal-original.yaml")
    const internalSchemaText = (await fs.readFile(internalSchemaFile)).toString()
    {
      /*
        todo: this is just a temporal solution, we need a proper way to
        dereference refs to public schema and only copy referenced models
       */

      // Replace all refs to public schema to internal
      let internalSchemaYaml = parse(internalSchemaText);
      internalSchemaYaml = await localizeRefs(internalSchemaYaml);

      // Merge all models from public schema to internal schema
      // todo: check for override
      internalSchemaYaml.components.schemas = {
        ...internalSchemaYaml.components.schemas,
        ...publicSchemaYaml.components.schemas,
      }
      await fs.copy(internalDir, internalDirOutput);
      await fs.writeFile(path.resolve(internalDirOutput, 'openapi-internal-original.yaml'), stringify(internalSchemaYaml));
    }
    {
      await fs.copy(publicDir, publicDirOutput);
      await fs.writeFile(path.resolve(publicDirOutput, 'openapi-public-original.yaml'), await stringify(publicSchemaYaml));
    }
  }
  catch(err) {
    logger.error(err);
  }
}

async function main() {
  const OUTPUT_DIR = await fs.mkdtemp(path.resolve(os.tmpdir(), 'tarpon-openapi-publish'))
  await fs.emptyDir(OUTPUT_DIR)

  await prepareSchemas(OUTPUT_DIR)

  let { BRANCH_NAME, PUBLIC_PROJECT_TOKEN, INTERNAL_PROJECT_TOKEN } = process.env

  if (!BRANCH_NAME) {
    BRANCH_NAME = exec("git symbolic-ref --short -q HEAD 2>/dev/null | tr / -").toString().trim()
  }

  if (!BRANCH_NAME) {
    logger.error("ERROR: Please set the BRANCH_NAME environment variables");
    process.exit(1)
  }
  if (!PUBLIC_PROJECT_TOKEN) {
    logger.error("ERROR: Please set the PUBLIC_PROJECT_TOKEN environment variables");
    process.exit(1)
  }
  if (!INTERNAL_PROJECT_TOKEN) {
    logger.error("ERROR: Please set the INTERNAL_PROJECT_TOKEN environment variables");
    process.exit(1)
  }
  logger.info("BRANCH_NAME", BRANCH_NAME)

  exec(`./node_modules/.bin/stoplight push --ci-token ${PUBLIC_PROJECT_TOKEN} --directory ${OUTPUT_DIR}/public --branch ${BRANCH_NAME}`)
  exec(`./node_modules/.bin/stoplight push --ci-token ${INTERNAL_PROJECT_TOKEN} --directory ${OUTPUT_DIR}/internal --branch ${BRANCH_NAME}`)

  await fs.remove(OUTPUT_DIR);
}

main().catch((e) => {
  logger.error(e)
})
