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

async function setUpMockS3() {
  await mkdirp(`/tmp/flagright/s3/${TarponStackConstants.S3_TMP_BUCKET_PREFIX}`)
  await mkdirp(
    `/tmp/flagright/s3/${TarponStackConstants.S3_IMPORT_BUCKET_PREFIX}`
  )
  await mkdirp(
    `/tmp/flagright/s3/${TarponStackConstants.S3_DOCUMENT_BUCKET_PREFIX}`
  )
}

process.env['AWS_SDK_LOAD_CONFIG'] = '1'
process.env['ENV'] = 'local'
process.env['MONGO_URI'] = 'mongodb://localhost:27017'

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
    require('./src/lambdas/user-management/app').userHandler(
      require('./events/create-user').event
    ),
  'get-user': () =>
    require('./src/lambdas/user-management/app').userHandler(
      require('./events/get-user').event
    ),
  'create-rule-instance': () =>
    require('./src/lambdas/phytoplankton-internal-api-handlers/app').ruleInstanceHandler(
      require('./events/create-rule-instance').event
    ),
  'update-rule-instance': () =>
    require('./src/lambdas/phytoplankton-internal-api-handlers/app').ruleInstanceHandler(
      require('./events/update-rule-instance').event
    ),
  'view-transactions': () =>
    require('./src/lambdas/phytoplankton-internal-api-handlers/app').transactionsViewHandler(
      require('./events/view-transactions').event
    ),
  'view-transactions-per-user': () =>
    require('./src/lambdas/phytoplankton-internal-api-handlers/app').transactionsPerUserViewHandler(
      require('./events/view-transactions-per-user').event
    ),
  'view-business-users': () =>
    require('./src/lambdas/phytoplankton-internal-api-handlers/app').businessUsersViewHandler(
      require('./events/view-business-users').event
    ),
  'view-consumer-users': () =>
    require('./src/lambdas/phytoplankton-internal-api-handlers/app').consumerUsersViewHandler(
      require('./events/view-consumer-users').event
    ),
  'create-transaction-comment': () =>
    require('./src/lambdas/phytoplankton-internal-api-handlers/app').transactionsViewHandler(
      require('./events/create-transaction-comment').event
    ),
  'verify-transaction': () =>
    require('./src/lambdas/rules-engine/app').transactionHandler(
      require('./events/verify-transaction').event
    ),
  'get-transaction': () =>
    require('./src/lambdas/rules-engine/app').transactionHandler(
      require('./events/get-transaction').event
    ),
  'import-list': () =>
    require('./src/lambdas/list-importer/app').listImporterHandler(
      require('./events/import-list').event
    ),
  'import-transaction': async () => {
    process.env['MOCK_S3'] = 'true'
    process.env['TMP_BUCKET'] = 'tarpon-tmp'
    process.env['IMPORT_BUCKET'] = 'tarpon-import'
    process.env['DOCUMENT_BUCKET'] = 'tarpon-document'
    await setUpMockS3()
    return require('./src/lambdas/file-import/app').fileImportHandler(
      require('./events/import-transaction').event
    )
  },
  'get-presigned-url': async () => {
    return require('./src/lambdas/file-import/app').getPresignedUrlHandler(
      require('./events/get-presigned-url').event
    )
  },
  'create-and-upload-test-data': () =>
    require('./src/scripts/index').createAndUploadTestData(
      options.tenant || 'demo-tenant-id',
      options.users || 1,
      options.transactions || 1,
      options.profileName || 'AWSAdministratorAccess-911899431626'
    ),
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
