import { Config } from '@flagright/lib/config/config'
import * as cdk from 'aws-cdk-lib'
import { IRole } from 'aws-cdk-lib/aws-iam'
import {
  Code,
  FunctionProps,
  LayerVersion,
  Runtime,
  Architecture,
} from 'aws-cdk-lib/aws-lambda'
import { Construct } from 'constructs'
import { Topic } from 'aws-cdk-lib/aws-sns'
import { RemovalPolicy } from 'aws-cdk-lib'
import { StackConstants } from '@lib/constants'
import { createPythonLambdaFunction } from '../cdk-utils/cdk-lambda-utils'

interface ConsoleLambdasProps extends cdk.NestedStackProps {
  config: Config
  lambdaExecutionRole: IRole
  functionProps: Partial<FunctionProps>
  zendutyCloudWatchTopic?: Topic
}

export class CdkTarponPythonStack extends cdk.NestedStack {
  config: Config
  functionProps: Partial<FunctionProps>

  constructor(scope: Construct, id: string, props: ConsoleLambdasProps) {
    super(scope, id, props)
    this.config = props.config
    this.functionProps = props.functionProps
    // store python layer in s3

    const pythonLayer = new LayerVersion(
      this,
      `${props.config.stage}-python-layer`,
      {
        code: Code.fromAsset('torpedo/dist/tigershark.zip'),
        compatibleRuntimes: [Runtime.PYTHON_3_10],
        layerVersionName: StackConstants.PYTHON_LAYER_NAME,
        compatibleArchitectures: [Architecture.ARM_64],
        removalPolicy: RemovalPolicy.DESTROY,
      }
    )

    // read files from python/dist/*

    createPythonLambdaFunction(this, props.lambdaExecutionRole, {
      name: StackConstants.LAMBDA_PROCESS_LAMBDA_FUNCTION_NAME,
      layers: [pythonLayer],
      memorySize: 128,
    })

    createPythonLambdaFunction(this, props.lambdaExecutionRole, {
      name: StackConstants.PROCESSING_LAMBDA_FUNCTION_NAME,
      layers: [pythonLayer],
      memorySize: 128,
    })
  }
}
