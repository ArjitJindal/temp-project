import {
  aws_s3 as s3,
  aws_ssm as ssm,
  Stack,
  StackProps,
  RemovalPolicy,
} from 'aws-cdk-lib'
import { Construct } from 'constructs'
import { AppConfig, StackConfig } from '../utils/types'

export interface StackCommonProps extends StackProps {
  projectPrefix: string
  appConfig: AppConfig //from our app-config.json file
}

export class BaseStack extends Stack {
  protected projectPrefix: string
  protected commonProps: StackCommonProps
  protected stackConfig: StackConfig

  constructor(
    scope: Construct,
    id: string,
    commonProps: StackCommonProps,
    stackConfig: StackConfig
  ) {
    super(scope, id, commonProps)

    this.projectPrefix = commonProps.projectPrefix
    this.commonProps = commonProps
    this.stackConfig = stackConfig
  }

  protected createS3Bucket(baseName: string): s3.Bucket {
    const suffix = `${
      this.commonProps.env?.region
    }-${this.commonProps.env?.account?.substring(0, 5)}`

    const s3Bucket = new s3.Bucket(this, baseName, {
      bucketName: `${this.projectPrefix}-${baseName}-${suffix}`
        .toLowerCase()
        .replace('_', '-'),
      versioned: false,
      removalPolicy: RemovalPolicy.DESTROY, // for prod, RETAIN is safe, while experimenting, DESTROY is easier
    })

    return s3Bucket
  }

  protected putParameter(paramKey: string, paramValue: string): string {
    const paramKeyWithPrefix = `${this.projectPrefix}-${paramKey}`

    new ssm.StringParameter(this, paramKey, {
      parameterName: paramKeyWithPrefix,
      stringValue: paramValue,
    })

    return paramKey
  }

  protected getParameter(paramKey: string): string {
    const paramKeyWithPrefix = `${this.projectPrefix}-${paramKey}`

    return ssm.StringParameter.valueForStringParameter(this, paramKeyWithPrefix)
  }
}
