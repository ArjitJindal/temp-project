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

    const spaRewriteFunction = new cloudfront.Function(this, 'SpaRewriteFunction', {
      code: cloudfront.FunctionCode.fromInline(
        "function handler(event) { var request = event.request; var uri = request.uri; if (uri === '/' || uri === '/index.html') { return request; } if (uri.indexOf('.') === -1) { request.uri = '/index.html'; } return request; }",
      ),
    });

    // Determine CORP value based on stage (cross-origin for dev/test to allow Cypress)
    const corpValue =
      config.stage === 'dev' || config.stage === 'dev:user' ? 'cross-origin' : 'same-origin';

    const responseHeadersFunction = new cloudfront.Function(this, 'ResponseHeadersFunction', {
      code: cloudfront.FunctionCode.fromInline(`
        function handler(event) {
          var response = event.response;
          var headers = response.headers;
          var request = event.request;
          var uri = event.request.uri;

          // Set Content-Type based on file extension
          if (uri === '/' || uri.endsWith('.html') || uri === '/index.html') {
            headers['content-type'] = { value: 'text/html; charset=UTF-8' };
          } else if (uri.endsWith('.js')) {
            headers['content-type'] = { value: 'application/javascript; charset=UTF-8' };
          } else if (uri.endsWith('.css')) {
            headers['content-type'] = { value: 'text/css; charset=UTF-8' };
          } else if (uri.endsWith('.json')) {
            headers['content-type'] = { value: 'application/json; charset=UTF-8' };
          } else if (uri.endsWith('.xml')) {
            headers['content-type'] = { value: 'application/xml; charset=UTF-8' };
          } else if (uri.endsWith('.txt')) {
            headers['content-type'] = { value: 'text/plain; charset=UTF-8' };
          }

          // Regex to check if host for request is flagright
          var hostHeader = request.headers.host ? request.headers.host.value : '';
          var isFlagright = /flagright\\.(local|com|dev)/i.test(hostHeader);

          if (!isFlagright) {
            headers['cross-origin-embedder-policy'] = { value: 'credentialless' };
          }
          // Ensure CORP header is set (in case ResponseHeadersPolicy doesn't apply it)
          // Use lowercase header name as CloudFront normalizes headers
          headers['cross-origin-resource-policy'] = { value: '${corpValue}' };

          return response;
        }
      `),
    });

    const extraBehaviours =
      process.env.ENV === 'dev:user'
        ? {
            defaultTtl: Duration.minutes(0),
            minTtl: Duration.minutes(0),
            maxTtl: Duration.minutes(0),
          }
        : {};

    // cloudfront security header policy
    let securityHeadersPolicy: cloudfront.IResponseHeadersPolicy;

    if (isQaDeployment) {
      // 20 security headers policy are allowed on a account level
      securityHeadersPolicy = securityHeadersPolicy =
        cloudfront.ResponseHeadersPolicy.fromResponseHeadersPolicyId(
          this,
          'ImportedSecurityHeadersPolicy',
          'f6ede8bf-a0d9-4ab2-b4d7-d65338708075', // dev policy id
        );
    } else {
      securityHeadersPolicy = new cloudfront.ResponseHeadersPolicy(this, 'SecurityHeadersPolicy', {
        securityHeadersBehavior: {
          strictTransportSecurity: {
            accessControlMaxAge: Duration.seconds(31536000),
            includeSubdomains: true,
            override: true,
          },
          contentTypeOptions: {
            override: true,
          },
          frameOptions: {
            frameOption: cloudfront.HeadersFrameOption.DENY,
            override: true,
          },
          referrerPolicy: {
            referrerPolicy: cloudfront.HeadersReferrerPolicy.NO_REFERRER,
            override: true,
          },
        },
        customHeadersBehavior: {
          customHeaders: [
            {
              header: 'Cross-Origin-Opener-Policy',
              value: 'same-origin',
              override: true,
            },
            {
              // Use cross-origin for dev/test environments to allow Cypress tests, same-origin for production
              header: 'Cross-Origin-Resource-Policy',
              value: corpValue,
              override: true,
            },
            {
              header: 'Permissions-Policy',
              value: 'geolocation=(), camera=(), microphone=()',
              override: true,
            },
          ],
        },
      });
    }

    // CloudFront distribution
    const distribution = new cloudfront.Distribution(this, 'SiteDistribution', {
      priceClass: config.CLOUDFRONT_PRICE_CLASS,

      certificate,
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      domainNames: [config.SITE_DOMAIN],
      defaultRootObject: 'index.html',

      errorResponses: [
        {
          httpStatus: 403,
          ttl: Duration.seconds(60),
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
        {
          httpStatus: 404,
          ttl: Duration.seconds(60),
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
      ],
      defaultBehavior: {
        origin: new S3Origin(siteBucket, {
          connectionAttempts: 3,
          connectionTimeout: Duration.seconds(10),
          originShieldRegion: config.env.region,
          originShieldEnabled: true,
        }),
        compress: true,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        functionAssociations: [
          {
            eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
            function: spaRewriteFunction,
          },
          {
            eventType: cloudfront.FunctionEventType.VIEWER_RESPONSE,
            function: responseHeadersFunction,
          },
        ],
        responseHeadersPolicy: securityHeadersPolicy,
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
