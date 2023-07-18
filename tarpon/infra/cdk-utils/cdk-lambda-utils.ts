import {
  Alias,
  FunctionProps,
  Function as LambdaFunction,
  LayerVersion,
  Runtime,
  Code,
  Tracing,
  CfnFunction,
  Version,
  ILayerVersion,
} from 'aws-cdk-lib/aws-lambda'
import { Construct } from 'constructs'
import { IRole, ServicePrincipal } from 'aws-cdk-lib/aws-iam'
import { Topic } from 'aws-cdk-lib/aws-sns'
import { Queue } from 'aws-cdk-lib/aws-sqs'
import { LAMBDAS } from '@lib/lambdas'
import { StackConstants } from '@lib/constants'
import { Config } from '@lib/configs/config'
import { Duration } from 'aws-cdk-lib'

type InternalFunctionProps = {
  name: string
  provisionedConcurrency?: number
  layers?: Array<ILayerVersion>
  memorySize?: number
  auditLogTopic: Topic
  batchJobQueue: Queue
}

// IMPORTANT: We should use the returned `alias` for granting further roles.
// We should only use the returned `func` to do the things that alias cannot do
// (e.g add environment variables)
export function createFunction(
  context: Construct & { config: Config },
  role: IRole,
  internalFunctionProps: InternalFunctionProps,
  props: Partial<FunctionProps> = {}
): { alias: Alias; func: LambdaFunction } {
  const {
    layers,
    name,
    memorySize,
    provisionedConcurrency,
    auditLogTopic,
    batchJobQueue,
  } = internalFunctionProps
  const layersArray = layers ? [...layers] : []
  if (
    !layersArray.find((layer) =>
      layer.layerVersionArn.includes('LambdaInsightsExtension')
    ) &&
    context.config.stage !== 'local'
  ) {
    /* Cloudwatch Insights Layer (https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/Lambda-Insights-extension-versionsx86-64.html) */
    const cwInsightsLayerArn = `arn:aws:lambda:${context.config.env.region}:580247275435:layer:LambdaInsightsExtension:18`
    const cwInsightsLayer = LayerVersion.fromLayerVersionArn(
      context,
      `cw-insights-layer_${name}`,
      cwInsightsLayerArn
    ) as LayerVersion

    layersArray.push(cwInsightsLayer)
  }
  const { handlerName } = LAMBDAS[name]
  if (!handlerName) {
    throw new Error(`Unknown lambda ${name}!`)
  }

  const func = new LambdaFunction(context, name, {
    ...{
      ...props,
      environment: {
        ...props.environment,
        ENV: context.config.stage,
        REGION: context.config.region as string,
        ...{
          ...Object.entries(context.config.application).reduce(
            (acc: Record<string, string>, [key, value]) => ({
              ...acc,
              [key]: `${value}`,
            }),
            {}
          ),
        },
        AWS_XRAY_CONTEXT_MISSING: 'LOG_ERROR',
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
        AUDITLOG_TOPIC_ARN: auditLogTopic?.topicArn,
        BATCH_JOB_QUEUE_URL: batchJobQueue?.queueUrl,
        // NOTE: RELEASE_VERSION and LAMBDA_CODE_PATH used for Sentry
        RELEASE_VERSION: process.env.RELEASE_VERSION as string,
        LAMBDA_CODE_PATH: LAMBDAS[name].codePath,
        QA_SUBDOMAIN: process.env.QA_SUBDOMAIN as string,
      },
    },
    functionName: name,
    runtime: Runtime.NODEJS_16_X,
    handler: `app.${handlerName}`,
    role: role,
    code: process.env.INFRA_CI
      ? Code.fromInline("console.log('hello')")
      : Code.fromAsset(`dist/${LAMBDAS[name].codePath}`),
    tracing: Tracing.ACTIVE,
    timeout: Duration.seconds(LAMBDAS[name].timeoutSeconds),
    memorySize: memorySize
      ? memorySize
      : context.config.resource.LAMBDA_DEFAULT.MEMORY_SIZE,
    layers: layersArray,
    logRetention: context.config.resource.CLOUD_WATCH.logRetention,
  })
  // This is needed to allow using ${Function.Arn} in openapi.yaml
  ;(func.node.defaultChild as CfnFunction).overrideLogicalId(name)

  let lambdaOptions: {
    aliasName: string
    version: Version
    provisionedConcurrentExecutions?: number
  } = {
    aliasName: StackConstants.LAMBDA_LATEST_ALIAS_NAME,
    version: func.currentVersion,
    provisionedConcurrentExecutions: provisionedConcurrency,
  }
  // Check for autoscaling lambda - currrently only transaction lambda
  if (name === StackConstants.PUBLIC_API_TRANSACTION_FUNCTION_NAME) {
    lambdaOptions = {
      aliasName: StackConstants.LAMBDA_LATEST_ALIAS_NAME,
      version: func.currentVersion,
    }
  }

  // Alias is required for setting provisioned concurrency. We always create
  // an alias for a lambda even it has no provisioned concurrency.
  const alias = new Alias(
    context,
    `${name}:${StackConstants.LAMBDA_LATEST_ALIAS_NAME}`,
    lambdaOptions
  )
  // This is needed because of the usage of SpecRestApi
  alias.grantInvoke(new ServicePrincipal('apigateway.amazonaws.com'))
  return { alias, func }
}
