import { Construct } from 'constructs'
import {
  aws_apigateway as apigateway,
  aws_lambda as lambda,
  aws_iam as iam,
  Duration,
  RemovalPolicy,
} from 'aws-cdk-lib'

import { BaseStack, StackCommonProps } from '../../../lib/base/base-stack'
import { APIHostingStackConfig } from '../../../lib/utils/types'

interface PredictLambdaProps {
  name: string
  endpointName: string
}

export class APIHostingStack extends BaseStack {
  constructor(
    scope: Construct,
    props: StackCommonProps,
    stackConfig: APIHostingStackConfig
  ) {
    super(scope, stackConfig.Name, props, stackConfig)

    const gatewayName = stackConfig.APIGatewayName
    const restApi = this.createAPIGateway(gatewayName)
    this.putParameter('apiGatewayName', `${this.projectPrefix}-${gatewayName}`)
    this.putParameter('apiGatewayId', restApi.restApiId)
    this.putParameter('apiEndpoint', this.getApiEndpoint(restApi))

    this.addServiceResource(
      restApi,
      stackConfig.ResourceName,
      stackConfig.ResourceMethod,
      stackConfig.LambdaFunctionName
    )
  }

  private createAPIGateway(gatewayName: string): apigateway.RestApi {
    const gateway = new apigateway.RestApi(this, gatewayName, {
      restApiName: `${this.projectPrefix}-${gatewayName}`,
      endpointTypes: [apigateway.EndpointType.REGIONAL],
      description:
        "This is a API-Gateway for Flagright ML's transaction risk model.",
      retainDeployments: true,
      deploy: true,
      deployOptions: {
        stageName: this.commonProps.appConfig.Project.Stage,
        loggingLevel: apigateway.MethodLoggingLevel.ERROR,
      },
    })

    const apiKey = gateway.addApiKey('ApiKey', {
      apiKeyName: `${this.projectPrefix}-${gatewayName}-Key`,
    })

    const plan = gateway.addUsagePlan('APIUsagePlan', {
      name: `${this.projectPrefix}-${gatewayName}-Plan`,
    })
    plan.addApiKey(apiKey)

    plan.addApiStage({
      stage: gateway.deploymentStage,
    })

    return gateway
  }

  private getApiEndpoint(restApi: apigateway.RestApi): string {
    const region = this.commonProps.env?.region
    return `${restApi.restApiId}.execute-api.${region}.amazonaws.com`
  }

  private addServiceResource(
    gateway: apigateway.RestApi,
    resourceName: string,
    resourceMethod: string,
    functionName: string
  ) {
    const resource = gateway.root.addResource(resourceName)

    const lambdaFunction = this.createPredictLambdaFunction({
      name: functionName,
      endpointName: this.getParameter('sageMakerEndpointName'),
    })
    this.putParameter('predictLambdaFunctionArn', lambdaFunction.functionArn)
    const lambdaInferAlias = lambdaFunction.addAlias(
      this.commonProps.appConfig.Project.Stage
    )

    const name = 'PredictLambdaIntegration'
    const role = new iam.Role(this, `${name}-Role`, {
      roleName: `${this.projectPrefix}-${name}-Role`,
      assumedBy: new iam.ServicePrincipal('apigateway.amazonaws.com'),
    })
    role.addManagedPolicy({
      managedPolicyArn: 'arn:aws:iam::aws:policy/AWSLambda_FullAccess',
    })

    const lambdaIntegration = new apigateway.LambdaIntegration(
      lambdaInferAlias,
      {
        credentialsRole: role,
        proxy: false,
        passthroughBehavior: apigateway.PassthroughBehavior.WHEN_NO_MATCH,
        integrationResponses: [
          {
            statusCode: '200',
            responseTemplates: {
              'application/json': '$input.json("$")',
            },
          },
        ],
      }
    )

    resource.addMethod(resourceMethod, lambdaIntegration, {
      methodResponses: [{ statusCode: '200' }],
    })
  }

  private createPredictLambdaFunction(props: PredictLambdaProps) {
    const baseName = `${props.name}-Lambda`
    const fullName = `${this.projectPrefix}-${baseName}`

    const lambdaPath = 'codes/lambda/api-hosting-predictor/src'

    const role = new iam.Role(this, `${baseName}-Role`, {
      roleName: `${fullName}-Role`,
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    })
    role.addManagedPolicy({
      managedPolicyArn:
        'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
    })
    role.addManagedPolicy({
      managedPolicyArn: 'arn:aws:iam::aws:policy/AmazonSageMakerFullAccess',
    })
    role.addManagedPolicy({
      managedPolicyArn: 'arn:aws:iam::aws:policy/AmazonKinesisFullAccess',
    })

    const lambdaFunction = new lambda.Function(this, baseName, {
      functionName: fullName,
      code: lambda.Code.fromAsset(lambdaPath),
      handler: 'handler.handle',
      runtime: lambda.Runtime.PYTHON_3_7,
      timeout: Duration.seconds(60 * 5),
      memorySize: 1024,
      role: role,
      environment: {
        SAGEMAKER_ENDPOINT: props.endpointName,
      },
      currentVersionOptions: {
        removalPolicy: RemovalPolicy.DESTROY, //may want to change this to RETAIN later
        retryAttempts: 1,
      },
    })

    return lambdaFunction
  }
}
