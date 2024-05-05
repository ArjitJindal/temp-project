import * as cdk from 'aws-cdk-lib'
import { Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam'
import * as sagemaker from 'aws-cdk-lib/aws-sagemaker'
import { CfnEndpointConfig, CfnEndpointProps } from 'aws-cdk-lib/aws-sagemaker'
import { BaseStack, StackCommonProps } from '../lib/base-stack'
import { Construct } from 'constructs'

interface ModelProps {
  modelName: string
  role: Role
  modelBucketName: string
  modelS3Key: string
  modelDockerImage: string
  modelServerWorkers: string
}

export class ModelServingStack extends BaseStack {
  constructor(scope: Construct, props: StackCommonProps, stackConfig: any) {
    super(scope, stackConfig.Name, props, stackConfig)

    const role: Role = this.createIamRole(`ModelEndpointRole`)

    const modelBucketName: string = this.getParameter(
      'modelArchivingBucketName'
    )
    let modelConfigList: CfnEndpointConfig.ProductionVariantProperty[] = []
    const modelList: any[] = stackConfig.ModelList
    for (let model of modelList) {
      const modelName = this.createModel({
        modelName: model.ModelName,
        modelDockerImage: model.ModelDockerImage,
        modelS3Key: model.ModelS3Key,
        modelBucketName: modelBucketName,
        role: role,
        modelServerWorkers: model.ModelServerWorkers,
      })

      modelConfigList.push({
        modelName: modelName,
        variantName: model.VariantName,
        instanceType: model.InstanceType,
      })
    }

    const loggingBucketName = this.createS3Bucket(
      stackConfig.BucketBaseName
    ).bucketName

    const endpointConfig = new sagemaker.CfnEndpointConfig(
      this,
      `${stackConfig.EndpointConfigName}-Config`,
      {
        endpointConfigName: `${this.projectPrefix}-${stackConfig.EndpointConfigName}-Config`,
        productionVariants: modelConfigList.map((modelConfig) => {
          return {
            modelName: modelConfig.modelName,
            variantName: modelConfig.variantName,
            serverlessConfig: modelConfig.serverlessConfig,
          }
        }),
        dataCaptureConfig: {
          captureOptions: [{ captureMode: 'Input' }, { captureMode: 'Output' }],
          enableCapture: stackConfig.DataLoggingEnable,
          destinationS3Uri: `s3://${loggingBucketName}/${stackConfig.DataLoggingS3Key}`,
          initialSamplingPercentage: stackConfig.DataLoggingPercentage,
        },
      }
    )

    const endpointConfigName = endpointConfig.attrEndpointConfigName

    let endpointName = ' '
    if (stackConfig.Deploy) {
      endpointName = this.deployEndpoint({
        endpointName: stackConfig.EndpointName,
        endpointConfigName: endpointConfigName,
      })
    }

    this.putParameter('sageMakerEndpointName', endpointName)
  }

  private createModel(props: ModelProps): string {
    const model = new sagemaker.CfnModel(this, `${props.modelName}-Model`, {
      modelName: `${this.projectPrefix}-${props.modelName}-Model`,
      executionRoleArn: props.role.roleArn,
      containers: [
        {
          image: props.modelDockerImage,
          modelDataUrl: `s3://${props.modelBucketName}/${props.modelS3Key}/model.tar.gz`,
          environment: {
            SAGEMAKER_MODEL_SERVER_WORKERS: props.modelServerWorkers,
          },
        },
      ],
    })

    return model.attrModelName
  }

  private deployEndpoint(props: CfnEndpointProps): string {
    const endpointName = `${this.projectPrefix}-${props.endpointName}-Endpoint`
    const endpoint = new sagemaker.CfnEndpoint(
      this,
      `${props.endpointName}-Endpoint`,
      {
        endpointName: endpointName,
        endpointConfigName: props.endpointConfigName,
      }
    )

    return endpointName
  }

  private createIamRole(roleBaseName: string): Role {
    const role = new Role(this, `${this.projectPrefix}${roleBaseName}`, {
      roleName: `${this.projectPrefix}${roleBaseName}`,
      assumedBy: new ServicePrincipal('sagemaker.amazonaws.com'),
      managedPolicies: [
        {
          managedPolicyArn: 'arn:aws:iam::aws:policy/AmazonSageMakerFullAccess',
        },
      ],
    })

    role.addManagedPolicy({
      managedPolicyArn: 'arn:aws:iam::aws:policy/AmazonS3FullAccess',
    })

    return role
  }
}
