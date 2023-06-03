import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayEventRequestContextWithAuthorizer,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'

export type TestApiEvent = Partial<
  APIGatewayProxyWithLambdaAuthorizerEvent<
    APIGatewayEventLambdaAuthorizerContext<any>
  >
>

export type TestApiRequestContext =
  APIGatewayEventRequestContextWithAuthorizer<any>
