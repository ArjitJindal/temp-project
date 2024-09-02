#!/usr/bin/env ts-node

import { execSync } from 'child_process'
import * as fs from 'fs'

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
    fs.writeFileSync(path, newText)
  }
}

function buildApi(type: 'public' | 'public-management' | 'internal') {
  exec(
    `mkdir -p src/@types/openapi-${type}/ src/@types/openapi-${type}-custom/ 1>/dev/null 2>&1`
  )

  exec(
    `
    ./node_modules/.bin/openapi-generator-cli generate -i lib/openapi/${type}/openapi-${type}-original.yaml -g typescript -o /tmp/flagright/${type}_openapi_types --additional-properties=modelPropertyNaming=original --reserved-words-mappings 3dsDone=3dsDone
    `
  )

  // Custom code generation
  exec(
    `
    ./node_modules/.bin/openapi-generator-cli generate -t lib/openapi/templates -i lib/openapi/${type}/openapi-${type}-original.yaml -g typescript -o /tmp/flagright/${type}_openapi_custom --additional-properties=modelPropertyNaming=original,api=${type}    `
  )

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
  if (type == 'internal') {
    exec(
      `mv /tmp/flagright/${type}_openapi_custom/apis/DefaultApi.ts src/@types/openapi-${type}-custom/`
    )
  }
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
    `src/@types/openapi-${type}/BusinessResponse.ts`,
    `src/@types/openapi-${type}/QuestionVariable.ts`,
    `src/@types/openapi-${type}/SimulationGetResponse.ts`,
    `src/@types/openapi-${type}-custom/DefaultApi.ts`,
    `src/@types/openapi-${type}/InternalConsumerUser.ts`,
    `src/@types/openapi-${type}/Consumer.ts`,
    `src/@types/openapi-${type}/User.ts`,
    `src/@types/openapi-${type}/UserOptional.ts`,
    `src/@types/openapi-${type}/UserWithRulesResult.ts`,
    `src/@types/openapi-${type}/UsersSearchResponse.ts`,
  ])

  exec(`rm -f src/@types/openapi-${type}/ObjectSerializer.ts`)
}

buildApi('public')
buildApi('public-management')
buildApi('internal')

console.info('Done!')
