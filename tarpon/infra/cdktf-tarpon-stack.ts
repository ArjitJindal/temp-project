import { TerraformStack } from 'cdktf'
import { Construct } from 'constructs'
import * as cdktf from 'cdktf'
import * as aws from '@cdktf/providers/aws'
import { Config } from '@flagright/lib/config/config'
import { getAuth0TenantConfigs } from '@lib/configs/auth0/tenant-config'
import { createAuth0TenantResources } from './auth0/cdktf-auth0-resources'

export class CdktfTarponStack extends TerraformStack {
  constructor(scope: Construct, id: string, config: Config) {
    super(scope, id)

    const awsRegion = config.env.region as string
    const stateBucket = `flagright-terraform-state-${config.stage}`

    // AWS
    new cdktf.S3Backend(this, {
      bucket: stateBucket,
      key: config.stage,
      region: awsRegion,
    })
    new aws.provider.AwsProvider(this, awsRegion, {
      region: awsRegion,
      defaultTags: [
        {
          tags: { deployment: 'tarpon' },
        },
      ],
    })
    const state = new aws.s3Bucket.S3Bucket(this, 'tfstate', {
      bucket: stateBucket,
    })
    new aws.s3BucketAcl.S3BucketAcl(this, 'tfstate-acl', {
      bucket: state.bucket,
      acl: 'private',
    })

    // Auth0 Resources
    const auth0TenantConfigs = getAuth0TenantConfigs(config.stage)
    auth0TenantConfigs.forEach((auth0TenantConfig) =>
      createAuth0TenantResources(this, config, auth0TenantConfig)
    )
  }
}
