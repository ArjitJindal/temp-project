import { App } from 'aws-cdk-lib'
import 'source-map-support/register'

//types and utils
import { loadConfig } from '../lib/utils/config-loaders'
import { AppConfig } from '../lib/utils/types'
import { StackCommonProps } from '../lib/base/base-stack'

//stacks
import { ModelArchivingStack } from './stack/model-serving/model-archiving-stack'
import { ModelServingStack } from './stack/model-serving/model-serving-stack'
import { APIHostingStack } from './stack/api-hosting/api-hosting-stack'
import { MonitorDashboardStack } from './stack/monitor-dashboard/monitor-dashboard-stack'
import { CicdPipelineStack } from './stack/cicd-pipeline/cicd-pipeline-stack'
import { APITestingStack } from './stack/api-testing/api-testing-stack'
import { TesterDashboardStack } from './stack/monitor-dashboard/tester-dashboard-stack'

const appConfig: AppConfig = loadConfig('config/app-config.json')
const stackCommonProps: StackCommonProps = {
  projectPrefix: `${appConfig.Project.Name}${appConfig.Project.Stage}`,
  appConfig: appConfig,
  env: {
    account: appConfig.Project.Account,
    region: appConfig.Project.Region,
  },
}

const cdkApp = new App()

new ModelArchivingStack(
  cdkApp,
  stackCommonProps,
  appConfig.Stack.ModelArchiving
)

new ModelServingStack(cdkApp, stackCommonProps, appConfig.Stack.ModelServing)

new APIHostingStack(cdkApp, stackCommonProps, appConfig.Stack.APIHosting)

new MonitorDashboardStack(
  cdkApp,
  stackCommonProps,
  appConfig.Stack.MonitorDashboard
)

new CicdPipelineStack(cdkApp, stackCommonProps, appConfig.Stack.CICDPipeline)

new APITestingStack(cdkApp, stackCommonProps, appConfig.Stack.APITesting)

new TesterDashboardStack(
  cdkApp,
  stackCommonProps,
  appConfig.Stack.TesterDashboard
)
