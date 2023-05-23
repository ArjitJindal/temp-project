interface Project {
  Name: string
  Stage: string
  Account: string
  Region: string
  Profile: string
}

export interface ModelPathDetails {
  ModelLocalPath: string
  ModelS3Key: string
}

export interface ModelDetails extends ModelPathDetails {
  ModelName: string
  ModelS3Key: string
  ModelDockerImage: string
  'ModelDockerImage-Desc'?: string
  VariantName: string
  VariantWeight: number
  InstanceCount: number
  InstanceType: string
  ModelServerWorkers: string
  'ModelServerWorkers-Desc'?: string
  AutoScalingEnable: boolean
  AutoScalingMinCapacity: number
  AutoScalingMaxCapacity: number
  AutoScalingTargetInvocation: number
}

export interface ModelArchivingStackConfig {
  Name: string
  BucketBaseName: string
  ModelList: ModelPathDetails[]
}

export interface ModelServingStackConfig {
  Name: string
  ModelList: ModelDetails[]
  EndpointConfigName: string
  BucketBaseName: string
  DataLoggingEnable: boolean
  DataLoggingS3Key: string
  DataLoggingPercentage: number
  EndpointName: string
  Deploy: boolean
}

export interface APIHostingStackConfig {
  Name: string
  APIGatewayName: string
  ResourceName: string
  ResourceMethod: string
  LambdaFunctionName: string
}

export interface MonitorDashboardConfig {
  Name: string
  DashboardName: string
  SubscriptionEmails: string[]
  'SubscriptionEmails-Example': string[]
  ApiGatewayOverallCallThreshold: number
  ApiGatewayError4xxCallThreshold: number
  ApiGatewayError5xxCallThreshold: number
}

export interface CICDPipelineStackConfig {
  Name: string
  RepositoryName: string
  BranchName: string
}

export interface APITestingStackConfig {
  Name: string
  SNSTopicName: string
  LambdaFunctionName: string
  TestClientCount: number
  TestDurationInSec: number
  TestIntervalInSec: number
}

export interface TesterDashboardConfig {
  Name: string
  DashboardName: string
}

export interface AppConfig {
  Project: Project
  Stack: {
    ModelArchiving: ModelArchivingStackConfig
    ModelServing: ModelServingStackConfig
    APIHosting: APIHostingStackConfig
    MonitorDashboard: MonitorDashboardConfig
    CICDPipeline: CICDPipelineStackConfig
    APITesting: APITestingStackConfig
    TesterDashboard: TesterDashboardConfig
  }
  InfraConfigFile: string
}

export type StackTypes =
  | 'ModelArchiving'
  | 'ModelServing'
  | 'APIHosting'
  | 'MonitorDashboard'
  | 'CICDPipeline'
  | 'APITesting'
  | 'TesterDashboard'

export type StackConfig =
  | ModelArchivingStackConfig
  | ModelServingStackConfig
  | APIHostingStackConfig
  | MonitorDashboardConfig
  | CICDPipelineStackConfig
  | APITestingStackConfig
  | TesterDashboardConfig
