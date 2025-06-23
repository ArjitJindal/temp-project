import * as cdk from 'aws-cdk-lib'
import { getTarponConfig } from '@flagright/lib/constants/config'
import { stageAndRegion } from '@flagright/lib/utils'
import { pick } from 'lodash'
import { CdkLoadTestingStack } from '../cdk-load-testing-stack'


const app = new cdk.App()
const [stage,region]=stageAndRegion()
new CdkLoadTestingStack(app, 'load-testing',pick(getTarponConfig(stage,region),['stage','region','env']))
