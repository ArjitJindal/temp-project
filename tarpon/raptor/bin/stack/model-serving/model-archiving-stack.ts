import { Construct } from 'constructs'
import { aws_s3 as s3, aws_s3_deployment as s3deploy } from 'aws-cdk-lib'

import { BaseStack, StackCommonProps } from '../../../lib/base/base-stack'
import {
  ModelArchivingStackConfig,
  ModelPathDetails,
} from '../../../lib/utils/types'

interface ModelUploadProps {
  modelBucket: s3.IBucket
  modelS3Key: string
  modelLocalPath: string
}

export class ModelArchivingStack extends BaseStack {
  constructor(
    scope: Construct,
    props: StackCommonProps,
    stackConfig: ModelArchivingStackConfig
  ) {
    super(scope, stackConfig.Name, props, stackConfig)

    const modelBucket = this.createS3Bucket(stackConfig.BucketBaseName)
    this.putParameter('modelArchivingBucketName', modelBucket.bucketName)

    const modelList: ModelPathDetails[] = stackConfig.ModelList
    for (const model of modelList) {
      this.uploadModelToBucket({
        modelBucket: modelBucket,
        modelS3Key: model.ModelS3Key,
        modelLocalPath: model.ModelLocalPath,
      })
    }
  }

  private uploadModelToBucket(props: ModelUploadProps) {
    if (
      props.modelLocalPath != undefined &&
      props.modelLocalPath.trim().length > 0
    ) {
      new s3deploy.BucketDeployment(this, `${props.modelS3Key}-UploadModel`, {
        destinationBucket: props.modelBucket,
        destinationKeyPrefix: props.modelS3Key,
        sources: [s3deploy.Source.asset(props.modelLocalPath)],
        memoryLimit: 1024,
      })
    }
  }
}
