#!/usr/bin/env node
const fs = require('fs-extra')
const path = require('path')
const mkdirp = require('mkdirp')
const _ = require('lodash')
require('dotenv').config()

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
    const publicDeviceDataDir = path.resolve(
      PROJECT_DIR,
      'lib',
      'openapi',
      'public-device-data'
    )
    const publicSanctionsDir = path.resolve(
      PROJECT_DIR,
      'lib',
      'openapi',
      'public-sanctions'
    )

    const internalDirOutput = path.resolve(OUTPUT_DIR, 'internal')
    const publicDirOutput = path.resolve(OUTPUT_DIR, 'public')
    const publicManagementDirOutput = path.resolve(
      OUTPUT_DIR,
      'public-management'
    )
    const publicDeviceDataDirOutput = path.resolve(
      OUTPUT_DIR,
      'public-device-data'
    )
    const publicSanctionsDirOutput = path.resolve(
      OUTPUT_DIR,
      'public-sanctions'
    )

    await fs.ensureDir(internalDirOutput)
    await fs.ensureDir(publicDirOutput)
    await fs.ensureDir(publicManagementDirOutput)
    await fs.ensureDir(publicDeviceDataDirOutput)
    await fs.ensureDir(publicSanctionsDirOutput)

    const publicSchemaFile = path.resolve(
      publicDir,
      'openapi-public-original.yaml'
    )
    const publicManagementSchemaFile = path.resolve(
      publicManagementDir,
      'openapi-public-management-original.yaml'
    )
    const publicDeviceSchemaFile = path.resolve(
      publicDeviceDataDir,
      'openapi-public-device-data-original.yaml'
    )
    const publicSchemaText = (await fs.readFile(publicSchemaFile)).toString()
    const publicManagementSchemaText = (
      await fs.readFile(publicManagementSchemaFile)
    ).toString()
    const publicManagementSchemaYaml = parse(publicManagementSchemaText)
    const publicSchemaYaml = parse(publicSchemaText)
    const publicDeviceSchemaText = (
      await fs.readFile(publicDeviceSchemaFile)
    ).toString()
    const publicDeviceSchemaYaml = parse(publicDeviceSchemaText)
    const publicSantionsSchemaFile = path.resolve(
      publicSanctionsDir,
      'openapi-public-sanctions-original.yaml'
    )
    const publicSanctionsSchemaText = (
      await fs.readFile(publicSantionsSchemaFile)
    ).toString()

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
        ...publicDeviceSchemaYaml.components.schemas,
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
    {
      await fs.copy(publicDeviceDataDir, publicDeviceDataDirOutput)
    }
    {
      await fs.copy(publicSanctionsDir, publicSanctionsDirOutput)
      const publicSanctionsSchemaYaml = await localizeRefs(
        parse(publicSanctionsSchemaText)
      )
      publicSanctionsSchemaYaml.components.schemas = {
        ...publicSanctionsSchemaYaml.components.schemas,
        ..._.pick(publicSchemaYaml.components.schemas, ['CountryCode']),
      }
      await fs.copy(publicSanctionsDir, publicSanctionsDirOutput)
      await fs.writeFile(
        path.resolve(
          publicSanctionsDirOutput,
          'openapi-public-sanctions-original.yaml'
        ),
        stringify(publicSanctionsSchemaYaml)
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
