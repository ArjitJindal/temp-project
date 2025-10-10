import { App } from 'aws-cdk-lib'
import { CdkOrcaPipelineStack } from './cdk-orca-pipeline-stack'
import { config as deployConfig } from '../tarpon/lib/configs/config-deployment'
import { config as deployTestConfig } from '../tarpon/lib/configs/config-deployment-test'

const app = new App()
if (['deploy', 'deploy-test'].includes(process.env.ENV || '')) {
  const config = process.env.ENV === 'deploy' ? deployConfig : deployTestConfig
  new CdkOrcaPipelineStack(app, `orca-pipeline`, { env: config.env }, config)
}
