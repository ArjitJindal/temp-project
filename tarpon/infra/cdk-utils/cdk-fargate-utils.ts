import { Config } from '@flagright/lib/config/config'
import { RemovalPolicy } from 'aws-cdk-lib'
import { DockerImageAsset } from 'aws-cdk-lib/aws-ecr-assets'
import {
  ContainerImage,
  FargateTaskDefinition,
  LogDriver,
} from 'aws-cdk-lib/aws-ecs'
import { IRole } from 'aws-cdk-lib/aws-iam'
import { FunctionProps } from 'aws-cdk-lib/aws-lambda'
import { LogGroup } from 'aws-cdk-lib/aws-logs'
import { Construct } from 'constructs'

export const createFargateTaskDefinition = (
  scope: Construct,
  name: string,
  props: { cpu?: number; memoryLimitMiB?: number; role: IRole }
) => {
  const fargateTaskDefinition = new FargateTaskDefinition(scope, name, {
    cpu: props.cpu ?? 256,
    memoryLimitMiB: props.memoryLimitMiB ?? 512,
    executionRole: props.role,
    taskRole: props.role,
  })

  return fargateTaskDefinition
}

export const createDockerImage = (
  scope: Construct,
  name: string,
  props: { path: string }
) => {
  const directory = props.path

  return new DockerImageAsset(scope, name, {
    directory,
    invalidation: { buildArgs: false },
  })
}

export const addFargateContainer = (
  scope: Construct & { config: Config } & {
    functionProps: Partial<FunctionProps>
  },
  name: string,
  taskDefinition: FargateTaskDefinition,
  props: { image: ContainerImage; memoryLimitMiB?: number }
) => {
  const { image } = props

  const fargateContainer = taskDefinition.addContainer(name, {
    image:
      process.env.INFRA_CI === 'true'
        ? ContainerImage.fromRegistry(
            'public.ecr.aws/docker/library/node:18-alpine'
          )
        : image,
    logging: LogDriver.awsLogs({
      streamPrefix: name,
      logGroup: new LogGroup(scope, `${name}-log-group`, {
        logGroupName: `/ecs/${name}`,
        removalPolicy:
          process.env.ENV === 'dev'
            ? RemovalPolicy.DESTROY
            : RemovalPolicy.RETAIN,
        retention: scope.config.resource.CLOUD_WATCH.logRetention,
      }),
    }),
    environment: {
      ...scope.functionProps.environment,
      ...Object.entries(scope.config.application).reduce(
        (acc: Record<string, string>, [key, value]) => ({
          ...acc,
          [key]: `${value}`,
        }),
        {}
      ),
      ENV: scope.config.stage,
      REGION: scope.config.region as string,
      RELEASE_VERSION: process.env.RELEASE_VERSION as string,
      NODE_OPTIONS: `--max_old_space_size=${props.memoryLimitMiB ?? 512}`,
      LOG_LEVEL: 'warn',
      CUSTOM_METRICS: 'false',
    },
  })

  return fargateContainer
}
