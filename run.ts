#!/usr/bin/env ts-node

/**
 * This dev-only util allows to directly execute lambda handler without using SAM.
 * Modify the lambda events in ./events/ for testing.
 */

import commandLineArgs from 'command-line-args'

process.env['AWS_SDK_LOAD_CONFIG'] = '1'

const optionDefinitions = [{ name: 'action', type: String }]
const options = commandLineArgs(optionDefinitions)
const actions: { [action: string]: Function } = {
  'create-user': () =>
    require('./src/user-management/app').userHandler(
      require('./events/create-user').event
    ),
  'get-user': () =>
    require('./src/user-management/app').userHandler(
      require('./events/get-user').event
    ),
  'create-rule-instance': () =>
    require('./src/rules-engine/app').ruleInstanceHandler(
      require('./events/create-rule-instance').event
    ),
  'update-rule-instance': () =>
    require('./src/rules-engine/app').ruleInstanceHandler(
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
}

;(async () => {
  const output = await actions[options.action]()
  let body = output.body
  try {
    body = JSON.parse(output.body)
  } catch (err) {}
  console.log('%o', {
    ...output,
    body,
  })
})()
