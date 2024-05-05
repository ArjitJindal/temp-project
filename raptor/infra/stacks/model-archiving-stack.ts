import * as s3 from 'aws-cdk-lib/aws-s3'
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment'
import { Construct } from 'constructs'

import { BaseStack, StackCommonProps } from '../lib/base-stack'

interface ModelUploadProps {
  modelBucket: s3.IBucket
  modelS3Key: string
  modelLocalPath: string
}

export class ModelArchivingStack extends BaseStack {
  constructor(scope: Construct, props: StackCommonProps, stackConfig: any) {
    super(scope, stackConfig.Name, props, stackConfig)

    const modelBucket = this.createS3Bucket(this.stackConfig.BucketBaseName)
    this.putParameter('modelArchivingBucketName', modelBucket.bucketName)

    const modelList: any[] = stackConfig.ModelList
    for (var model of modelList) {
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
