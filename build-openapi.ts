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

function buildApi(type: 'public' | 'internal') {
  exec(
    `openapi-generator generate -i lib/openapi/openapi-${type}-original.yaml -g typescript -o /tmp/flagright/${type}_openapi_types --additional-properties=modelPropertyNaming=original`
  )
  exec(`rm -rf src/@types/openapi-${type}/*`)
  exec(
    `mv /tmp/flagright/${type}_openapi_types/models/* src/@types/openapi-${type}/`
  )
  exec(
    `mv /tmp/flagright/${type}_openapi_types/types/ObjectParamAPI.ts src/@types/openapi-${type}/RequestParameters.ts`
  )
  exec(
    `sed -i '' "s/import { HttpFile } from '..\\/http\\/http'//g" src/@types/openapi-${type}/*`
  )
  replaceRequestParameters(`src/@types/openapi-${type}/RequestParameters.ts`)
  exec(
    `rm -f src/@types/openapi-${type}/ObjectSerializer.ts src/@types/openapi-${type}/all.ts`
  )
  exec(`ts-node lib/openapi/openapi-${type}-augmentor.ts`)
}

buildApi('public')
buildApi('internal')
exec(
  'node_modules/.bin/prettier --write src/@types/openapi-public/ src/@types/openapi-internal/ lib/openapi/*'
)

console.log('Done!')
