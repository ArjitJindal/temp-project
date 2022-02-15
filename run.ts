#!/usr/bin/env ts-node
/* eslint-disable @typescript-eslint/no-var-requires */

/**
 * This dev-only util allows to directly execute lambda handler without using SAM.
 * Modify the lambda events in ./events/ for testing.
 */

import { APIGatewayProxyResult } from 'aws-lambda'
import commandLineArgs from 'command-line-args'
import mkdirp from 'mkdirp'
import { TarponStackConstants } from './lib/constants'

process.env['AWS_SDK_LOAD_CONFIG'] = '1'

const optionDefinitions = [
  { name: 'action', type: String },
  { name: 'tenant', type: String },
  { name: 'users', type: Number },
  { name: 'transactions', type: Number },
  { name: 'profileName', type: String },
]

const options = commandLineArgs(optionDefinitions)
const actions: { [action: string]: () => Promise<APIGatewayProxyResult> } = {
  'create-user': () =>
    require('./src/user-management/app').userHandler(
      require('./events/create-user').event
    ),
  'get-user': () =>
    require('./src/user-management/app').userHandler(
      require('./events/get-user').event
    ),
  'create-rule-instance': () =>
    require('./src/phytoplankton-internal-api-handlers/app').ruleInstanceHandler(
      require('./events/create-rule-instance').event
    ),
  'update-rule-instance': () =>
    require('./src/phytoplankton-internal-api-handlers/app').ruleInstanceHandler(
      require('./events/update-rule-instance').event
    ),
  'view-transactions': () =>
    require('./src/phytoplankton-internal-api-handlers/app').transactionsViewHandler(
      require('./events/update-rule-instance').event
    ),
  'verify-transaction': () =>
    require('./src/rules-engine/app').transactionHandler(
      require('./events/verify-transaction').event
    ),
  'get-transaction': () =>
    require('./src/rules-engine/app').transactionHandler(
      require('./events/get-transaction').event
    ),
  'import-list': () =>
    require('./src/list-importer/app').listImporterHandler(
      require('./events/import-list').event
    ),
  'create-and-upload-test-data': () =>
    require('./src/scripts/index').createTransactionData(
      options.tenant || 'demo-tenant-id',
      options.users || 1,
      options.transactions || 1,
      options.profileName || 'AWSAdministratorAccess-911899431626'
    ),
  'import-transaction': async () => {
    await mkdirp(
      `/tmp/flagright/s3/${TarponStackConstants.S3_IMPORT_TMP_BUCKET}`
    )
    await mkdirp(`/tmp/.flagright/s3/${TarponStackConstants.S3_IMPORT_BUCKET}`)

    return require('./src/file-import/app').fileImportHandler(
      require('./events/import-transaction').event
    )
  },
}

;(async () => {
  const output = await actions[options.action]()
  let body = output.body
  try {
    body = JSON.parse(output.body)
  } catch (err) {
    // ignore
  }
  console.log('%o', {
    ...output,
    body,
  })
})()
