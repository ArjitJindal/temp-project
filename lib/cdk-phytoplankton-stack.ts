import * as cdk from 'aws-cdk-lib';
import type { Construct } from 'constructs';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import { CfnOutput, RemovalPolicy } from 'aws-cdk-lib';
import { CnameRecord, HostedZone } from 'aws-cdk-lib/aws-route53';
import { userAlias } from './configs/config-dev-user';
import type { Config } from './configs/config';

export class CdkPhytoplanktonStack extends cdk.Stack {
  constructor(scope: Construct, id: string, config: Config) {
    super(scope, id, { env: config.env });

    const cloudfrontOAI = new cloudfront.OriginAccessIdentity(this, 'cloudfront-OAI', {
      comment: `OAI for ${config.SITE_DOMAIN}`,
    });

    // Content bucket
    const siteBucket = new s3.Bucket(this, 'SiteBucket', {
      bucketName: config.SITE_DOMAIN,
      websiteIndexDocument: 'index.html',
      websiteErrorDocument: 'index.html',
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: config.stage === 'dev' ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN,
      autoDeleteObjects: config.stage === 'dev',
    });

    // Grant access to cloudfront
    siteBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        actions: ['s3:GetObject'],
        resources: [siteBucket.arnForObjects('*')],
        principals: [
          new iam.CanonicalUserPrincipal(
            cloudfrontOAI.cloudFrontOriginAccessIdentityS3CanonicalUserId,
          ),
        ],
      }),
    );

    const viewerCertificate = cloudfront.ViewerCertificate.fromAcmCertificate(
      acm.Certificate.fromCertificateArn(this, 'SiteCertificate', config.SITE_CERTIFICATE_ARN),
      { aliases: [config.SITE_DOMAIN] },
    );

    // CloudFront distribution
    const distribution = new cloudfront.CloudFrontWebDistribution(this, 'SiteDistribution', {
      priceClass: config.CLOUDFRONT_PRICE_CLASS,
      viewerCertificate,
      errorConfigurations: [
        {
          errorCode: 403,
          errorCachingMinTtl: 0,
          responseCode: 200,
          responsePagePath: '/index.html',
        },
        {
          errorCode: 404,
          errorCachingMinTtl: 0,
          responseCode: 200,
          responsePagePath: '/index.html',
        },
      ],
      originConfigs: [
        {
          s3OriginSource: {
            s3BucketSource: siteBucket,
            originAccessIdentity: cloudfrontOAI,
          },
          behaviors: [
            {
              isDefaultBehavior: true,
              compress: true,
              allowedMethods: cloudfront.CloudFrontAllowedMethods.GET_HEAD_OPTIONS,
            },
          ],
        },
      ],
    });

    // Deploy site contents to S3 bucket
    new s3deploy.BucketDeployment(this, 'DeployWithInvalidation', {
      sources: [s3deploy.Source.asset('./dist')],
      destinationBucket: siteBucket,
      distribution,
      distributionPaths: ['/*'],
    });

    new CfnOutput(this, 'Bucket', { value: siteBucket.bucketName });
    new CfnOutput(this, 'DistributionId', { value: distribution.distributionId });
    new CfnOutput(this, 'DistributionDomainName', { value: distribution.distributionDomainName });

    if (config.stage === 'dev') {
      const prefix = process.env.ENV === 'dev:user' ? `${userAlias()}.` : '';

      const hostedZone = HostedZone.fromLookup(this, `zone`, {
        domainName: config.SITE_DOMAIN.replace(prefix, '').replace('console.', ''),
        privateZone: false,
      });
      new CnameRecord(this, `cname`, {
        zone: hostedZone,
        recordName: `${prefix}console`,
        domainName: distribution.distributionDomainName,
      });
    }

    console.log(
      `❗❗For initial deployment, please follow https://www.notion.so/flagright/DNS-configuration-864d7518d87c448d862baa74b99c3d33#de01aa3894a842bb910ab8904a1d21be to configure DNS.
It involves the following steps
1. Create a new certificate for ${config.SITE_DOMAIN} in us-east-1 region
2. Set up CNAME in Route53 for the certificate
3. Set ${config.SITE_DOMAIN} as the alternate domain name of the CloudFront distribution
4. Set up CNAME in Route53 for the subdomain (with DistributionDomainName as the value)
`,
    );
  }
}
