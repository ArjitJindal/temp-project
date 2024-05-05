import * as cdk from 'aws-cdk-lib'
import 'source-map-support/register'

import { loadConfig } from './utils/config-loaders'
import { StackCommonProps } from './lib/base-stack'

import { ModelServingStack } from './stacks/model-serving-stack'
import { ModelArchivingStack } from './stacks/model-archiving-stack'

const cdkApp = new cdk.App()

let appConfig: any = loadConfig('config.json')
const stackCommonProps: StackCommonProps = {
  projectPrefix: `${appConfig.Project.Name}${appConfig.Project.Stage}`,
  appConfig: appConfig,
  env: {
    account: appConfig.Project.Account,
    region: appConfig.Project.Region,
  },
}
new ModelArchivingStack(
  cdkApp,
  stackCommonProps,
  appConfig.Stack.ModelArchiving
)

new ModelServingStack(cdkApp, stackCommonProps, appConfig.Stack.ModelServing)
