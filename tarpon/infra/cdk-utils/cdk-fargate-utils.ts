import { Config, FlagrightCPUArchitecture } from '@flagright/lib/config/config'
import { RemovalPolicy } from 'aws-cdk-lib'
import { DockerImageAsset, Platform } from 'aws-cdk-lib/aws-ecr-assets'
import {
  ContainerImage,
  CpuArchitecture,
  FargateTaskDefinition,
  LogDriver,
  OperatingSystemFamily,
  UlimitName,
} from 'aws-cdk-lib/aws-ecs'
import { IRole } from 'aws-cdk-lib/aws-iam'
import { FunctionProps } from 'aws-cdk-lib/aws-lambda'
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs'
import { Construct } from 'constructs'

export const createFargateTaskDefinition = (
  scope: Construct,
  name: string,
  props: {
    cpu?: number
    memoryLimitMiB?: number
    role: IRole
    architecture: FlagrightCPUArchitecture
  }
) => {
  const fargateTaskDefinition = new FargateTaskDefinition(scope, name, {
    cpu: props.cpu ?? 256,
    memoryLimitMiB: props.memoryLimitMiB ?? 512,
    executionRole: props.role,
    taskRole: props.role,
    runtimePlatform: {
      cpuArchitecture:
        props.architecture === 'arm64'
          ? CpuArchitecture.ARM64
          : CpuArchitecture.X86_64,

      operatingSystemFamily: OperatingSystemFamily.LINUX,
    },
  })

  return fargateTaskDefinition
}

export const createDockerImage = (
  scope: Construct,
  name: string,
  props: { path: string; architecture: FlagrightCPUArchitecture }
) => {
  const directory = props.path
  const isArm64 = props.architecture === 'arm64'

  return new DockerImageAsset(scope, name, {
    directory,
    invalidation: { buildArgs: true },
    buildArgs: {
      platform: isArm64 ? 'linux/arm64' : 'linux/amd64',
    },
    platform: isArm64 ? Platform.LINUX_ARM64 : Platform.LINUX_AMD64,
  })
}

export const addFargateContainer = (
  scope: Construct & { config: Config } & {
    functionProps: Partial<FunctionProps>
  },
  name: string,
  taskDefinition: FargateTaskDefinition,
  props: {
    image: ContainerImage
    memoryLimitMiB?: number
    architecture: FlagrightCPUArchitecture
  }
) => {
  const { image } = props

  const fargateContainer = taskDefinition.addContainer(name, {
    image:
      process.env.INFRA_CI === 'true'
        ? ContainerImage.fromRegistry(
            'public.ecr.aws/docker/library/node:20-alpine'
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
        retention: scope.config.resource.CLOUD_WATCH
          .logRetention as unknown as RetentionDays,
      }),
    }),
    // Ulimit: https://docs.aws.amazon.com/AmazonECS/latest/APIReference/API_Ulimit.html
    ulimits: [
      {
        name: UlimitName.NOFILE,
        hardLimit: 60000,
        softLimit: 60000,
      },
    ],
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
      LOG_LEVEL: 'info',
      CUSTOM_METRICS: 'false',
    },
  })

  return fargateContainer
}
