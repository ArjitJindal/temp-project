import { withContext } from '../utils/context'

export const genericContextProviderLambda =
  () =>
  (handler: CallableFunction): any =>
  async (event: any, context: any, callback: any): Promise<any> => {
    return withContext(
      async () => {
        return handler(event, context, callback)
      },
      {
        logMetadata: {
          functionName: process.env.AWS_LAMBDA_FUNCTION_NAME,
          region: process.env.AWS_REGION,
        },
        metricDimensions: {
          functionName: process.env.AWS_LAMBDA_FUNCTION_NAME,
        },
      }
    )
  }
