import {
  Alias,
  CfnFunction,
  Code,
  Function as LambdaFunction,
  FunctionProps,
  ILayerVersion,
  LayerVersion,
  Runtime,
  Tracing,
  Version,
} from 'aws-cdk-lib/aws-lambda'
import { Construct } from 'constructs'
import { IRole, ServicePrincipal } from 'aws-cdk-lib/aws-iam'
import { LAMBDAS } from '@lib/lambdas'
import { StackConstants } from '@lib/constants'
import { Config } from '@flagright/lib/config/config'
import { Duration, Fn } from 'aws-cdk-lib'
import { FlagrightRegion } from '@flagright/lib/constants/deploy'
import { RetentionDays } from 'aws-cdk-lib/aws-logs'
import { InterfaceVpcEndpoint } from 'aws-cdk-lib/aws-ec2'

export type InternalFunctionProps = {
  name: string
  provisionedConcurrency?: number
  layers?: Array<ILayerVersion>
  memorySize?: number
}

/* Cloudwatch Insights Layer (https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/Lambda-Insights-extension-versionsx86-64.html) */
const LAMBDA_LAYER_ARN_BY_REGION: Record<FlagrightRegion, string> = {
  'asia-1':
    'arn:aws:lambda:ap-southeast-1:580247275435:layer:LambdaInsightsExtension:38',
  'asia-2':
    'arn:aws:lambda:ap-south-1:580247275435:layer:LambdaInsightsExtension:36',
  'asia-3':
    'arn:aws:lambda:ap-east-1:519774774795:layer:LambdaInsightsExtension:28',
  'au-1':
    'arn:aws:lambda:ap-southeast-2:580247275435:layer:LambdaInsightsExtension:38',
  'eu-1':
    'arn:aws:lambda:eu-central-1:580247275435:layer:LambdaInsightsExtension:38',
  'eu-2':
    'arn:aws:lambda:eu-west-2:580247275435:layer:LambdaInsightsExtension:38',
  'me-1':
    'arn:aws:lambda:me-central-1:732604637566:layer:LambdaInsightsExtension:11',
  'us-1':
    'arn:aws:lambda:us-west-2:580247275435:layer:LambdaInsightsExtension:38',
}

// IMPORTANT: We should use the returned `alias` for granting further roles.
// We should only use the returned `func` to do the things that alias cannot do
// (e.g add environment variables)

const autoScalingLambdaNames = [
  StackConstants.PUBLIC_API_TRANSACTION_FUNCTION_NAME,
  StackConstants.PUBLIC_API_TRANSACTION_EVENT_FUNCTION_NAME,
]

export function createFunction(
  context: Construct & { config: Config } & {
    functionProps: Partial<FunctionProps>
  },
  role: IRole,
  internalFunctionProps: InternalFunctionProps,
  heavyLibLayer: ILayerVersion,
  props: Partial<FunctionProps> = {}
): { alias: Alias; func: LambdaFunction } {
  return createLambdaFunction(
    'nodejs',
    context,
    role,
    {
      ...internalFunctionProps,
      layers: [...(internalFunctionProps.layers ?? []), heavyLibLayer],
    },
    props,
    (name) => `dist/lambdas/${LAMBDAS[name].codePath}`
  )
}

export function createPythonLambdaFunction(
  context: Construct & { config: Config } & {
    functionProps: Partial<FunctionProps>
  },
  role: IRole,
  internalFunctionProps: InternalFunctionProps,
  props: Partial<FunctionProps> = {}
): { alias: Alias; func: LambdaFunction } {
  return createLambdaFunction(
    'python',
    context,
    role,
    internalFunctionProps,
    props,
    (name) => `torpedo/dist/${LAMBDAS[name].codePath}.zip`
  )
}

function createLambdaFunction(
  type: 'python' | 'nodejs',
  context: Construct & { config: Config } & {
    functionProps: Partial<FunctionProps>
  },
  role: IRole,
  internalFunctionProps: InternalFunctionProps,
  props: Partial<FunctionProps>,
  getCodePath: (name: string) => string
): { alias: Alias; func: LambdaFunction } {
  const { layers, name, memorySize, provisionedConcurrency } =
    internalFunctionProps
  const layersArray = layers ? [...layers] : []
  if (
    !layersArray.find((layer) =>
      layer.layerVersionArn.includes('LambdaInsightsExtension')
    ) &&
    context.config.stage !== 'local'
  ) {
    const cwInsightsLayer = LayerVersion.fromLayerVersionArn(
      context,
      `cw-insights-layer_${name}`,
      LAMBDA_LAYER_ARN_BY_REGION[context.config.region ?? 'eu-1']
    ) as LayerVersion

    layersArray.push(cwInsightsLayer)
  }
  const { handlerName } = LAMBDAS[name]

  if (!handlerName) {
    throw new Error(`Unknown lambda ${name}!`)
  }

  const func = new LambdaFunction(context, name, {
    ...{
      ...context.functionProps,
      ...props,
      environment: {
        ...context.functionProps.environment,
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
        // NOTE: RELEASE_VERSION and LAMBDA_CODE_PATH used for Sentry
        RELEASE_VERSION: process.env.RELEASE_VERSION as string,
        LAMBDA_CODE_PATH: LAMBDAS[name].codePath,
        QA_SUBDOMAIN: process.env.QA_SUBDOMAIN as string,
        SEED_TRANSACTIONS_COUNT:
          context.config.stage === 'dev' ? '400' : '4000',
        SEED_CRYPTO_TRANSACTIONS_COUNT:
          context.config.stage === 'dev' ? '50' : '500',
      },
    },
    functionName: name,
    runtime: type === 'python' ? Runtime.PYTHON_3_10 : Runtime.NODEJS_20_X,
    handler: `app.${handlerName}`,
    role: role,
    code: process.env.INFRA_CI
      ? Code.fromInline("console.log('hello')")
      : Code.fromAsset(getCodePath(name)),
    tracing: Tracing.ACTIVE,
    timeout: Duration.seconds(LAMBDAS[name].timeoutSeconds),
    memorySize: memorySize
      ? memorySize
      : context.config.resource.LAMBDA_DEFAULT.MEMORY_SIZE,
    layers: layersArray,
    logRetention: context.config.resource.CLOUD_WATCH
      .logRetention as unknown as RetentionDays,
    logRetentionRetryOptions: {
      maxRetries: 10,
    },
  })
  // This is needed to allow using ${Function.Arn} in openapi.yaml
  ;(func.node.defaultChild as CfnFunction).overrideLogicalId(name)

  // Add SQS and SNS VPC endpoint URLs if they exist
  // We do this after function creation to avoid passing tokens through nested stack parameters
  const contextWithVpcEndpoint = context as Construct & {
    config: Config
    functionProps: Partial<FunctionProps>
    sqsInterfaceVpcEndpoint?: InterfaceVpcEndpoint
    snsInterfaceVpcEndpoint?: InterfaceVpcEndpoint
  }

  let lambdaOptions: {
    aliasName: string
    version: Version
    provisionedConcurrentExecutions?: number
  } = {
    aliasName: StackConstants.LAMBDA_LATEST_ALIAS_NAME,
    version: func.currentVersion,
    provisionedConcurrentExecutions: provisionedConcurrency,
  }

  const vpcEndpoints = new Map<string, InterfaceVpcEndpoint>()
  if (contextWithVpcEndpoint.sqsInterfaceVpcEndpoint) {
    vpcEndpoints.set(
      'SQS_VPC_ENDPOINT_URL',
      contextWithVpcEndpoint.sqsInterfaceVpcEndpoint
    )
  }
  if (contextWithVpcEndpoint.snsInterfaceVpcEndpoint) {
    vpcEndpoints.set(
      'SNS_VPC_ENDPOINT_URL',
      contextWithVpcEndpoint.snsInterfaceVpcEndpoint
    )
  }

  vpcEndpoints.forEach((endpoint, envName) => {
    const dnsEntry = Fn.select(0, endpoint.vpcEndpointDnsEntries)
    const dnsName = Fn.select(1, Fn.split(':', dnsEntry))
    func.addEnvironment(envName, `https://${dnsName}`)
  })

  // Check for autoscaling lambda - currrently only transaction lambda
  if (autoScalingLambdaNames.includes(name)) {
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
