import * as fs from 'fs';
import * as path from 'node:path';
import * as cdk from 'aws-cdk-lib';
import { CfnOutput, Duration, RemovalPolicy } from 'aws-cdk-lib';
import type { Construct } from 'constructs';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Effect } from 'aws-cdk-lib/aws-iam';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import { CnameRecord, HostedZone } from 'aws-cdk-lib/aws-route53';
import { BucketProps } from 'aws-cdk-lib/aws-s3/lib/bucket';
import { S3Origin } from 'aws-cdk-lib/aws-cloudfront-origins';
import * as cheerio from 'cheerio';
import { isEmpty, isUndefined } from 'lodash';
import { userAlias } from './configs/config-dev-user';
import type { Config } from './configs/config';

export class CdkPhytoplanktonStack extends cdk.Stack {
  private static readonly EXISTING_CLOUDFRONT_DISTRIBUTION_LOGICAL_ID =
    'SiteDistributionCFDistribution209CF7F5';

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

    // Step 2: Create Origin Access Control (OAC)
    const oac = new cloudfront.CfnOriginAccessControl(this, 'CloudFrontOAC', {
      originAccessControlConfig: {
        name: `${prefix}CloudFrontOAC`,
        description: 'Origin Access Control for S3',
        originAccessControlOriginType: 's3',
        signingBehavior: 'always', // Sign all requests
        signingProtocol: 'sigv4', // Use SigV4 signing protocol
      },
    });

    const certificate = acm.Certificate.fromCertificateArn(
      this,
      'SiteCertificate',
      config.SITE_CERTIFICATE_ARN,
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
    const distribution = new cloudfront.Distribution(this, 'SiteDistribution', {
      priceClass: config.CLOUDFRONT_PRICE_CLASS,

      certificate,
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      domainNames: [config.SITE_DOMAIN],

      errorResponses: [
        {
          httpStatus: 403,
          ttl: Duration.seconds(0),
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
        {
          httpStatus: 404,
          ttl: Duration.seconds(0),
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
      ],
      defaultBehavior: {
        origin: new S3Origin(siteBucket, {
          connectionAttempts: 3,
          connectionTimeout: Duration.seconds(10),
        }),
        compress: true,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        ...extraBehaviours,
      },
    });

    if (!isQaDeployment) {
      // Override the logical ID of the distribution to match the existing one.
      // Migrating from CloudFrontWebDistribution to Distribution may create a
      // new distribution with a different logical ID. This is a workaround to
      // override the logical ID of the distribution to match the existing one.
      // Ref - https://github.com/aws/aws-cdk/issues/12707
      (distribution.node.defaultChild as cloudfront.CfnDistribution).overrideLogicalId(
        CdkPhytoplanktonStack.EXISTING_CLOUDFRONT_DISTRIBUTION_LOGICAL_ID,
      );
    }

    siteBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        effect: Effect.ALLOW,
        principals: [new iam.ServicePrincipal('cloudfront.amazonaws.com')],
        actions: ['s3:GetObject'],
        resources: [siteBucket.arnForObjects('*')],
        conditions: {
          StringEquals: {
            'AWS:SourceArn': `arn:aws:cloudfront::${this.account}:distribution/${distribution.distributionId}`,
          },
        },
      }),
    );

    // Disable OAI (Origin Access Identity)
    const cfnDistribution = distribution.node.defaultChild as cloudfront.CfnDistribution;
    cfnDistribution.addOverride(
      'Properties.DistributionConfig.Origins.0.S3OriginConfig.OriginAccessIdentity',
      '',
    );
    // Enable OAC (Origin Access Control)
    cfnDistribution.addOverride(
      'Properties.DistributionConfig.Origins.0.OriginAccessControlId',
      oac.ref,
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

  private getContentSecurityPolicy(): string {
    const html = fs.readFileSync(path.join(__dirname, '../dist/index.html'));
    // Load the HTML into Cheerio
    const $ = cheerio.load(html);

    // Find the Content-Security-Policy meta tag
    const cspMetaTag = $('meta[http-equiv="Content-Security-Policy"]');

    // Extract the content of the CSP tag
    const csp = cspMetaTag.attr('content');
    if (isUndefined(csp) || isEmpty(csp)) {
      throw new Error('Content-Security-Policy meta tag not found in index.html');
    }

    return csp;
  }
}
