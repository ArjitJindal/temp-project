#!/usr/bin/env node
const fs = require('fs-extra')
const path = require('path')
const mkdirp = require('mkdirp')
const _ = require('lodash')

const {
  PROJECT_DIR,
  parse,
  stringify,
  localizeRefs,
} = require('./openapi_helpers.js')

async function prepareSchemas(OUTPUT_DIR) {
  try {
    const internalDir = path.resolve(PROJECT_DIR, 'lib', 'openapi', 'internal')
    const publicDir = path.resolve(PROJECT_DIR, 'lib', 'openapi', 'public')
    const publicManagementDir = path.resolve(
      PROJECT_DIR,
      'lib',
      'openapi',
      'public-management'
    )
    const internalDirOutput = path.resolve(OUTPUT_DIR, 'internal')
    const publicDirOutput = path.resolve(OUTPUT_DIR, 'public')
    const publicManagementDirOutput = path.resolve(
      OUTPUT_DIR,
      'public-management'
    )

    await fs.ensureDir(internalDirOutput)
    await fs.ensureDir(publicDirOutput)
    await fs.ensureDir(publicManagementDirOutput)

    const publicSchemaFile = path.resolve(
      publicDir,
      'openapi-public-original.yaml'
    )
    const publicManagementSchemaFile = path.resolve(
      publicManagementDir,
      'openapi-public-management-original.yaml'
    )
    const publicSchemaText = (await fs.readFile(publicSchemaFile)).toString()
    const publicManagementSchemaText = (
      await fs.readFile(publicManagementSchemaFile)
    ).toString()
    const publicManagementSchemaYaml = parse(publicManagementSchemaText)
    const publicSchemaYaml = parse(publicSchemaText)
    const internalSchemaFile = path.resolve(
      internalDir,
      'openapi-internal-original.yaml'
    )
    const internalSchemaText = (
      await fs.readFile(internalSchemaFile)
    ).toString()
    {
      /*
        todo: this is just a temporal solution, we need a proper way to
        dereference refs to public schema and only copy referenced models
       */

      // Replace all refs to public schema to internal
      let internalSchemaYaml = parse(internalSchemaText)
      internalSchemaYaml = await localizeRefs(internalSchemaYaml)

      // Merge all models from public schema to internal schema
      // todo: check for override
      internalSchemaYaml.components.schemas = {
        ...internalSchemaYaml.components.schemas,
        ...publicSchemaYaml.components.schemas,
        ..._.pick(publicManagementSchemaYaml.components.schemas, [
          'ActionReason',
        ]),
      }
      await fs.copy(internalDir, internalDirOutput)
      await fs.writeFile(
        path.resolve(internalDirOutput, 'openapi-internal-original.yaml'),
        stringify(internalSchemaYaml)
      )
    }
    {
      await fs.copy(publicDir, publicDirOutput)
      await fs.writeFile(
        path.resolve(publicDirOutput, 'openapi-public-original.yaml'),
        await stringify(publicSchemaYaml)
      )
    }
    {
      await fs.copy(publicManagementDir, publicManagementDirOutput)
      const publicManagementSchemaYaml = await localizeRefs(
        parse(publicManagementSchemaText)
      )
      publicManagementSchemaYaml.components.schemas = {
        ...publicManagementSchemaYaml.components.schemas,
        ...publicSchemaYaml.components.schemas,
      }
      await fs.writeFile(
        path.resolve(
          publicManagementDirOutput,
          'openapi-public-management-original.yaml'
        ),
        stringify(publicManagementSchemaYaml)
      )
    }
  } catch (err) {
    console.error(err)
  }
}

async function main() {
  const OUTPUT_DIR = './dist/openapi'
  mkdirp.sync(OUTPUT_DIR)
  await prepareSchemas(OUTPUT_DIR)
  console.log('Preparation completed.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
