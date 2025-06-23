import { readFileSync } from 'fs'
import { ECSClient, RunTaskCommand } from '@aws-sdk/client-ecs'
import { Command } from 'commander'
import { CONFIG_MAP } from '@flagright/lib/constants/config'
/*
run `npm run deploy:load-test` to get cloudformation outputs to run this script
*/

// Load CDK outputs
const outputs = JSON.parse(
  readFileSync('load-testing/cdk-outputs/testing.json', 'utf-8')
)
const program = new Command()
const stackName = Object.keys(outputs)[0]
const outputsForStack = outputs[stackName]

program
  .requiredOption('--region <region>', 'region')
  .requiredOption('--stage <stage>', 'Deployment stage')
  .option('--userIds <userIds>', 'Comma-separated user IDs', 'CU-1,CU-2')
  .requiredOption('--apiKey <apiKey>', 'API key')
  .requiredOption('--concurrency <concurrency>', 'Concurrency')
  .requiredOption('--duration <duration>', 'Duration of the test in seconds')
  .option('--debug', 'Enable debug logging')

program.parse(process.argv)

const options = program.opts()

const {
  region: flagrightRegion,
  stage,
  userIds,
  apiKey,
  concurrency,
  duration,
} = options
const prefix = `${stage}LoadTest`
const taskDefinitionArn = outputsForStack[`${prefix}TaskArn`]
const subnetId = outputsForStack[`${prefix}SubnetId`]
const securityGroupId = outputsForStack[`${prefix}SecurityGroupId`]
const clusterArn = outputsForStack[`${prefix}EcsClusterArn`]
const containerName = outputsForStack[`${prefix}FargateContainerName`]
const bucketName = outputsForStack[`${prefix}BucketName`]
const region = CONFIG_MAP[stage][flagrightRegion].env.region

if (options.debug) {
  console.log('Debug Config:', JSON.stringify(options, null, 2))
}
const apiBase = getApiBasePath(stage, flagrightRegion)
async function runTask() {
  const ecs = new ECSClient({ region })
  const command = new RunTaskCommand({
    cluster: clusterArn,
    taskDefinition: taskDefinitionArn,
    networkConfiguration: {
      awsvpcConfiguration: {
        subnets: [subnetId],
        securityGroups: [securityGroupId],
        assignPublicIp: 'DISABLED',
      },
    },
    overrides: {
      containerOverrides: [
        {
          name: containerName,
          environment: [
            { name: 'API_URL', value: apiBase },
            { name: 'X_API_KEY', value: apiKey },
            { name: 'USER_IDS', value: userIds },
            { name: 'CONCURRENCY', value: concurrency },
            { name: 'DURATION', value: duration },
            { name: 'BUCKET_NAME', value: bucketName },
          ],
        },
      ],
    },
  })

  try {
    const result = await ecs.send(command)
    console.log(
      'Task started',
      options.debug ? `\n config:${JSON.stringify(result.tasks, null, 2)}` : ''
    )
  } catch (error) {
    console.error('Failed to run task:', error)
  }
}

runTask().catch((error) => {
  console.log(error)
})

function getApiBasePath(stage?: string, region?: string): string {
  if (stage === 'prod' && region) {
    return `${region}.api.flagright.com`
  } else if (stage === 'sandbox') {
    return region === 'asia-1'
      ? `sandbox-asia-1.api.flagright.com`
      : 'sandbox.api.flagright.com'
  } else {
    return 'api.flagright.dev'
  }
}
