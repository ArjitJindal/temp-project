import * as cdk from 'aws-cdk-lib';
import type { Construct } from 'constructs';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import { CfnOutput, Duration, RemovalPolicy } from 'aws-cdk-lib';
import { CnameRecord, HostedZone } from 'aws-cdk-lib/aws-route53';
import { userAlias } from './configs/config-dev-user';
import type { Config } from './configs/config';

function contentSecurityPolicy(domain: string) {
  return `default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
object-src 'none';
base-uri 'self';
connect-src 'self' https://api-js.mixpanel.com https://*.${domain} https://ipinfo.io https://*.ingest.sentry.io;
font-src 'self' https://fonts.gstatic.com;
frame-src 'self' https://*.${domain};
img-src 'self' https://s.gravatar.com https://*.wp.com https://cdnjs.cloudflare.com https://platform.slack-edge.com;
manifest-src 'self';
media-src 'self';
worker-src blob:;`.replace(/(\r\n|\n|\r)/gm, ' ');
}

export class CdkPhytoplanktonStack extends cdk.Stack {
  constructor(scope: Construct, id: string, config: Config) {
    super(scope, id, { env: config.env });
    const prefix = process.env.ENV === 'dev:user' ? `${userAlias()}.` : '';
    const domainName = config.SITE_DOMAIN.replace(prefix, '').replace('console.', '');

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
      {
        aliases: [config.SITE_DOMAIN],
        securityPolicy: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      },
    );

    const extraBehaviours =
      process.env.ENV === 'dev:user'
        ? {
            defaultTtl: Duration.minutes(0),
            minTtl: Duration.minutes(0),
            maxTtl: Duration.minutes(0),
          }
        : {};

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
              ...extraBehaviours,
            },
          ],
        },
      ],
    });

    // Hack taken from https://stackoverflow.com/questions/72306740/how-to-enable-managed-response-header-policy-of-securityheaders-with-cloudfrontw
    const cfnDistribution = distribution.node.defaultChild as cloudfront.CfnDistribution;
    const responseHeaderCfn = new cdk.CfnResource(this, 'ResponseHeadersPolicyCfn', {
      type: 'AWS::CloudFront::ResponseHeadersPolicy',
      properties: {
        ResponseHeadersPolicyConfig: {
          Name: `ContentSecurity${userAlias()}`,
          SecurityHeadersConfig: {
            ContentSecurityPolicy: {
              ContentSecurityPolicy: contentSecurityPolicy(domainName),
              Override: true,
            },
          },
        },
      },
    });
    cfnDistribution.addDependsOn(responseHeaderCfn);
    cfnDistribution.addPropertyOverride(
      'DistributionConfig.DefaultCacheBehavior.ResponseHeadersPolicyId',
      responseHeaderCfn.ref,
    );

    // Deploy site contents to S3 bucket
    new s3deploy.BucketDeployment(this, 'DeployWithInvalidation', {
      sources: [s3deploy.Source.asset('./dist')],
      destinationBucket: siteBucket,
      distribution,
      distributionPaths: ['/*'],
      memoryLimit: 1500,
    });

    new CfnOutput(this, 'Bucket', { value: siteBucket.bucketName });
    new CfnOutput(this, 'DistributionId', { value: distribution.distributionId });
    new CfnOutput(this, 'DistributionDomainName', { value: distribution.distributionDomainName });

    if (config.stage === 'dev') {
      const hostedZone = HostedZone.fromLookup(this, `zone`, {
        domainName,
        privateZone: false,
      });
      new CnameRecord(this, `cname`, {
        zone: hostedZone,
        recordName: `${prefix}console`,
        domainName: distribution.distributionDomainName,
      });
    }
  }
}
