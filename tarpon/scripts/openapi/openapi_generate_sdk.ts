#!/usr/bin/env ts-node

import { execSync } from 'child_process'
import * as fs from 'fs'
import { join } from 'path'
import { load as yamlLoad } from 'js-yaml'
import type { OpenAPIV3 } from 'express-openapi-validator/dist/framework/types'
import { v4 as uuid } from 'uuid'

function exec(command: string) {
  execSync(command, { env: process.env })
}

function replaceRequestParameters(path: string) {
  const newText = fs
    .readFileSync(path)
    .toString()
    .replace(/.*..\/http\/http.*/, '')
    .replace(/.*..\/models\/all.*/, '')
    .replace(/.*..\/configuration.*/, '')
    .replace(/.*..\/apis\/DefaultApi.*/, '')
    .replace(/.*.\/ObservableAPI.*/g, '')
    .replace(/..\/models/g, '.')
    .replace(/export class ObjectDefaultApi {(\n.*)*/, '')
  fs.writeFileSync(path, newText)
}

function removeBadImports(paths: string[]) {
  for (const path of paths) {
    if (!fs.existsSync(path)) {
      continue
    }
    const newText = fs
      .readFileSync(path)
      .toString()
      .replace(/import \{ \S+ \| \S+ .*/g, '')
      .replace(/^.*&amp.*\n?/gm, '')
    fs.writeFileSync(path, newText)
  }
}

export function mergeInternalSpecs(): OpenAPIV3.Document {
  const internalSpec = yamlLoad(
    fs.readFileSync(
      join(
        __dirname,
        '../../lib/openapi/internal/openapi-internal-original.yaml'
      ),
      'utf8'
    )
  ) as OpenAPIV3.Document

  const workflowRoutes = yamlLoad(
    fs.readFileSync(
      join(__dirname, '../../lib/openapi/internal/workflow-routes.yaml'),
      'utf8'
    )
  ) as OpenAPIV3.Document

  const workflowModels = yamlLoad(
    fs.readFileSync(
      join(__dirname, '../../lib/openapi/internal/workflow-models.yaml'),
      'utf8'
    )
  ) as OpenAPIV3.Document

  return {
    ...internalSpec,
    paths: {
      ...internalSpec.paths,
      ...workflowRoutes.paths,
    },
    components: {
      ...internalSpec.components,
      schemas: {
        ...internalSpec.components?.schemas,
        ...workflowRoutes.components?.schemas,
        ...workflowModels.components?.schemas,
      },
    },
  }
}

function buildApi(type: 'public' | 'public-management' | 'internal') {
  exec(
    `mkdir -p src/@types/openapi-${type}/ src/@types/openapi-${type}-custom/ 1>/dev/null 2>&1`
  )

  exec(`mkdir -p ../lib/@types/openapi-${type}/ 1>/dev/null 2>&1`)

  if (type === 'internal') {
    const mergedSpec = mergeInternalSpecs()

    // Write to a temporary merged spec file
    const tempMergedSpecPath = join(
      __dirname,
      `../../lib/openapi/internal/temp-merged-spec-${uuid()}.yaml`
    )
    fs.writeFileSync(tempMergedSpecPath, JSON.stringify(mergedSpec))

    try {
      // Use the temporary file for generation
      exec(
        `
      ./node_modules/.bin/openapi-generator-cli generate -i ${tempMergedSpecPath} -g typescript -o /tmp/flagright/${type}_openapi_types --additional-properties=modelPropertyNaming=original --reserved-words-mappings 3dsDone=3dsDone
      `
      )

      // Custom code generation
      exec(
        `
      ./node_modules/.bin/openapi-generator-cli generate -t lib/openapi/templates -i ${tempMergedSpecPath} -g typescript -o /tmp/flagright/${type}_openapi_custom --additional-properties=modelPropertyNaming=original,api=${type}
      `
      )
    } finally {
      fs.rmSync(tempMergedSpecPath, { force: true })
    }
  } else {
    exec(
      `
      ./node_modules/.bin/openapi-generator-cli generate -i lib/openapi/${type}/openapi-${type}-original.yaml -g typescript -o /tmp/flagright/${type}_openapi_types --additional-properties=modelPropertyNaming=original --reserved-words-mappings 3dsDone=3dsDone
      `
    )

    // Custom code generation
    exec(
      `
      ./node_modules/.bin/openapi-generator-cli generate -t lib/openapi/templates -i lib/openapi/${type}/openapi-${type}-original.yaml -g typescript -o /tmp/flagright/${type}_openapi_custom --additional-properties=modelPropertyNaming=original,api=${type}
      `
    )
  }

  exec(
    `rm -rf src/@types/openapi-${type}/* src/@types/openapi-${type}-custom/*`
  )
  exec(
    `mv /tmp/flagright/${type}_openapi_types/models/* src/@types/openapi-${type}/`
  )
  exec(
    `mv /tmp/flagright/${type}_openapi_types/types/ObjectParamAPI.ts src/@types/openapi-${type}/RequestParameters.ts`
  )

  // Move custom generated code
  exec(
    `mv /tmp/flagright/${type}_openapi_custom/apis/DefaultApi.ts src/@types/openapi-${type}-custom/`
  )
  exec(
    `mv /tmp/flagright/${type}_openapi_custom/models/* src/@types/openapi-${type}-custom/`
  )

  exec(
    `
    if [ "$(uname)" = "Darwin" ]; then
        sed -i '' "s/import { HttpFile } from '..\\/http\\/http'//g" src/@types/openapi-${type}/*
    elif [ "$(expr substr $(uname -s) 1 5)" = "Linux" ]; then
        sed -i "s/import { HttpFile } from '..\\/http\\/http'//g" src/@types/openapi-${type}/*
    fi`
  )
  replaceRequestParameters(`src/@types/openapi-${type}/RequestParameters.ts`)
  removeBadImports([
    `src/@types/openapi-${type}/Business.ts`,
    `src/@types/openapi-${type}/BusinessOptional.ts`,
    `src/@types/openapi-${type}/BusinessWithRulesResult.ts`,
    `src/@types/openapi-${type}/InternalUser.ts`,
    `src/@types/openapi-${type}/InternalBusinessUser.ts`,
    `src/@types/openapi-${type}/QuestionVariable.ts`,
    `src/@types/openapi-${type}/SimulationGetResponse.ts`,
    `src/@types/openapi-${type}-custom/DefaultApi.ts`,
    `src/@types/openapi-${type}/InternalConsumerUser.ts`,
    `src/@types/openapi-${type}/Consumer.ts`,
    `src/@types/openapi-${type}/User.ts`,
    `src/@types/openapi-${type}/UserOptional.ts`,
    `src/@types/openapi-${type}/UserWithRulesResult.ts`,
    `src/@types/openapi-${type}/UsersSearchResponse.ts`,
    `src/@types/openapi-${type}/SimulationRiskLevelsAndRiskFactorsResultResponse.ts`,
    `src/@types/openapi-${type}/PermissionsNodeBase.ts`,
    `src/@types/openapi-${type}/DynamicPermissionsNode.ts`,
    `src/@types/openapi-${type}/StaticPermissionsNode.ts`,
    `src/@types/openapi-${type}/PermissionsResponse.ts`,
    `src/@types/openapi-${type}/WorkflowResponse.ts`,
    `src/@types/openapi-${type}/BatchBusinessUserWithRulesResult.ts`,
    `src/@types/openapi-${type}/BatchConsumerUserWithRulesResult.ts`,
  ])

  exec(`rm -f src/@types/openapi-${type}/ObjectSerializer.ts`)
}

if (require.main === module) {
  console.info('Syncing Nango models...')
  exec(`rm -rf src/@types/nango/models.d.ts`)
  exec(`yarn sync:nango:models`)

  console.info('Generating public SDK...')
  buildApi('public')

  console.info('Generating public-management SDK...')
  buildApi('public-management')

  console.info('Generating internal SDK...')
  buildApi('internal')

  console.info('Done!')
}
