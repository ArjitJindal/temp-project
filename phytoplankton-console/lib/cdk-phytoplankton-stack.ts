import * as cdk from 'aws-cdk-lib';
import type { Construct } from 'constructs';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import { CfnOutput, Duration, RemovalPolicy } from 'aws-cdk-lib';
import { CnameRecord, HostedZone } from 'aws-cdk-lib/aws-route53';
import { BucketProps } from 'aws-cdk-lib/aws-s3/lib/bucket';
import { userAlias } from './configs/config-dev-user';
import type { Config } from './configs/config';

const DEPLOYED_REGIONS = ['ap-southeast-1', 'ap-south-1', 'eu-central-1', 'eu-west-2', 'us-west-2'];
function contentSecurityPolicy(domain: string, stage: string) {
  const buckets = DEPLOYED_REGIONS.flatMap((region) =>
    ['tmp', 'document', 'import'].map(
      (tarponBucket) =>
        `https://tarpon-${tarponBucket}-${stage}-${region}.s3.${region}.amazonaws.com`,
    ),
  ).join(' ');
  return `default-src 'self';
script-src 'self' https://cdn.heapanalytics.com https://heapanalytics.com 'sha256-12Sr3zsuj4S5dhD99YsMaB85Xqg6R/TGFur0VAPzLsM=';
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://heapanalytics.com 'sha256-DOu86drLfwUr1Wcsx/wxfqAogK7tFvJGjVmF/300H/M=' 'sha256-iYwYhiMcsGmXCUzLEpEzZNz5dINrlkqf1sLbLhEcqGM=';
object-src 'none';
base-uri 'self';
connect-src 'self' ${buckets} https://api-js.mixpanel.com https://*.${domain} https://ipinfo.io https://*.ingest.sentry.io https://heapanalytics.com;
font-src 'self' https://fonts.gstatic.com https://heapanalytics.com;
frame-src 'self' https://*.${domain};
img-src 'self' data: https://s.gravatar.com https://*.wp.com https://cdnjs.cloudflare.com https://platform.slack-edge.com https://heapanalytics.com;
manifest-src 'self';
media-src 'self';
worker-src blob:;`.replace(/(\r\n|\n|\r)/gm, ' ');
}

export class CdkPhytoplanktonStack extends cdk.Stack {
  constructor(scope: Construct, id: string, config: Config) {
    super(scope, id, { env: config.env });
    const isQaDeployment = process.env.ENV === 'dev:user';

    const prefix = isQaDeployment ? `${userAlias()}.` : '';
    const domainName = config.SITE_DOMAIN.replace(prefix, '').replace('console.', '');

    const cloudfrontOAI = new cloudfront.OriginAccessIdentity(this, 'cloudfront-OAI', {
      comment: `OAI for ${config.SITE_DOMAIN}`,
    });

    let s3BucketConfig: BucketProps = {
      bucketName: config.SITE_DOMAIN,
      websiteIndexDocument: 'index.html',
      websiteErrorDocument: 'index.html',
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: config.stage === 'dev' ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN,
      autoDeleteObjects: config.stage === 'dev',
    };
    if (!isQaDeployment) {
      const serverAccessLogBucket = new s3.Bucket(this, 'ServerAccessLogBucketConsole', {
        bucketName:
          'console-' + config.SITE_DOMAIN.replace('.', '-') + '-access-log-' + config.stage,
        removalPolicy: config.stage === 'dev' ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN,
        autoDeleteObjects: config.stage === 'dev',
        objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_PREFERRED,
      });
      s3BucketConfig = {
        ...s3BucketConfig,
        serverAccessLogsBucket: serverAccessLogBucket,
        serverAccessLogsPrefix: 'console/',
      };
    }

    // Content bucket
    const siteBucket = new s3.Bucket(this, 'SiteBucket', s3BucketConfig);

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

    if (process.env.ENV !== 'dev:user') {
      const responseHeaderCfn = new cdk.CfnResource(this, 'ResponseHeadersPolicyCfn', {
        type: 'AWS::CloudFront::ResponseHeadersPolicy',
        properties: {
          ResponseHeadersPolicyConfig: {
            Name: `ContentSecurity${userAlias()}`,
            SecurityHeadersConfig: {
              ContentSecurityPolicy: {
                ContentSecurityPolicy: contentSecurityPolicy(domainName, config.stage),
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
    } else {
      cfnDistribution.addPropertyOverride(
        'DistributionConfig.DefaultCacheBehavior.ResponseHeadersPolicyId',
        'a9f5965f-4ffc-430c-9575-aa0dde714199', // ID for the dev response header policy
      );
    }

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
