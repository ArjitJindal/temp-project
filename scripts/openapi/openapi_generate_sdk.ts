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

function buildApi(
  type: 'public' | 'public-management' | 'public-device-data' | 'internal'
) {
  exec(`mkdir -p src/@types/openapi-${type}/ 1>/dev/null 2>&1`)
  exec(
    `
    ./node_modules/.bin/openapi-generator-cli generate -i lib/openapi/${type}/openapi-${type}-original.yaml -g typescript -o /tmp/flagright/${type}_openapi_types --additional-properties=modelPropertyNaming=original
    `
  )

  exec(`rm -rf src/@types/openapi-${type}/*`)
  exec(
    `mv /tmp/flagright/${type}_openapi_types/models/* src/@types/openapi-${type}/`
  )
  exec(
    `mv /tmp/flagright/${type}_openapi_types/types/ObjectParamAPI.ts src/@types/openapi-${type}/RequestParameters.ts`
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
  exec(
    `rm -f src/@types/openapi-${type}/ObjectSerializer.ts src/@types/openapi-${type}/all.ts`
  )
}

buildApi('public')
buildApi('public-management')
buildApi('public-device-data')
buildApi('internal')

console.info('Done!')
