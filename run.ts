#!/usr/bin/env ts-node
/* eslint-disable @typescript-eslint/no-var-requires */

/**
 * This dev-only util allows to directly execute lambda handler without using SAM.
 * Modify the lambda events in ./events/ for testing.
 */
import { APIGatewayProxyResult } from 'aws-lambda'
import commandLineArgs from 'command-line-args'
import mkdirp from 'mkdirp'
import { config } from './lib/configs/config-dev'
import { StackConstants } from './lib/constants'

async function setUpMockS3() {
  await mkdirp(`/tmp/flagright/s3/${StackConstants.S3_TMP_BUCKET_PREFIX}`)
  await mkdirp(`/tmp/flagright/s3/${StackConstants.S3_IMPORT_BUCKET_PREFIX}`)
  await mkdirp(`/tmp/flagright/s3/${StackConstants.S3_DOCUMENT_BUCKET_PREFIX}`)
}

Object.entries(config.application).forEach((entry) => {
  process.env[entry[0]] = `${entry[1]}`
})

process.env['AWS_SDK_LOAD_CONFIG'] = '1'
process.env['ENV'] = 'local'
process.env['EXEC_SOURCE'] = 'cli'
process.env['MONGO_URI'] = 'mongodb://localhost:27017'
process.env['DYNAMODB_URI'] = 'http://localhost:8000'

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
    require('./src/lambdas/public-api-user-management/app').userHandler(
      require('./events/create-user').event
    ),
  'get-user': () =>
    require('./src/lambdas/public-api-user-management/app').userHandler(
      require('./events/get-user').event
    ),
  'create-rule': () =>
    require('./src/lambdas/console-api-rule/app').ruleHandler(
      require('./events/create-rule').event
    ),
  'delete-rule': () =>
    require('./src/lambdas/console-api-rule/app').ruleHandler(
      require('./events/delete-rule').event
    ),
  'update-rule': () =>
    require('./src/lambdas/console-api-rule/app').ruleHandler(
      require('./events/update-rule').event
    ),
  'get-rules': () =>
    require('./src/lambdas/console-api-rule/app').ruleHandler(
      require('./events/get-rules').event
    ),
  'create-rule-instance': () =>
    require('./src/lambdas/console-api-rule/app').ruleInstanceHandler(
      require('./events/create-rule-instance').event
    ),
  'update-rule-instance': () =>
    require('./src/lambdas/console-api-rule/app').ruleInstanceHandler(
      require('./events/update-rule-instance').event
    ),
  'get-rule-instances': () =>
    require('./src/lambdas/console-api-rule/app').ruleInstanceHandler(
      require('./events/get-rule-instances').event
    ),
  'view-transactions': () =>
    require('./src/lambdas/console-api-transaction/app').transactionsViewHandler(
      require('./events/view-transactions').event
    ),
  'view-business-users': () =>
    require('./src/lambdas/console-api-user/app').businessUsersViewHandler(
      require('./events/view-business-users').event
    ),
  'view-consumer-users': () =>
    require('./src/lambdas/console-api-user/app').consumerUsersViewHandler(
      require('./events/view-consumer-users').event
    ),
  'create-transaction-comment': () =>
    require('./src/lambdas/console-api-transaction/app').transactionsViewHandler(
      require('./events/create-transaction-comment').event
    ),
  'verify-transaction': () =>
    require('./src/lambdas/public-api-rules-engine/app').transactionHandler(
      require('./events/verify-transaction').event
    ),
  'verify-transaction-event': () =>
    require('./src/lambdas/public-api-rules-engine/app').transactionEventHandler(
      require('./events/verify-transaction-event').event
    ),
  'get-transaction': () =>
    require('./src/lambdas/public-api-rules-engine/app').transactionHandler(
      require('./events/get-transaction').event
    ),
  'import-list': () =>
    require('./src/lambdas/list-importer/app').listImporterHandler(
      require('./events/import-list').event
    ),
  import: async () => {
    process.env['TMP_BUCKET'] = 'tarpon-tmp'
    process.env['IMPORT_BUCKET'] = 'tarpon-import'
    process.env['DOCUMENT_BUCKET'] = 'tarpon-document'
    await setUpMockS3()
    return require('./src/lambdas/console-api-file-import/app').fileImportHandler(
      require('./events/import').event
    )
  },
  'get-presigned-url': async () => {
    return require('./src/lambdas/console-api-file-import/app').getPresignedUrlHandler(
      require('./events/get-presigned-url').event
    )
  },
  'create-and-upload-test-data': () =>
    require('./src/scripts/index').createAndUploadTestData(
      options.tenant || 'demo-tenant-id',
      options.users || 10,
      options.transactions || 100,
      options.profileName || 'AWSAdministratorAccess-911899431626'
    ),
  'create-account': () => {
    return require('./src/lambdas/console-api-account/app').accountsHandler(
      require('./events/create-account').event
    )
  },
  'get-accounts': () => {
    return require('./src/lambdas/console-api-account/app').accountsHandler(
      require('./events/get-accounts').event
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
  console.info('%o', {
    ...output,
    body,
  })
})()
