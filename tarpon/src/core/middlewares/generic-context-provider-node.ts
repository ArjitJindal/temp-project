import AWSXRay from 'aws-xray-sdk-core'
import { withContext } from '../utils/context'

export const genericContextProviderNode =
  () =>
  (handler: CallableFunction): any =>
  async (event: any, context: any): Promise<any> => {
    return withContext(
      async () => {
        AWSXRay.setContextMissingStrategy('IGNORE_ERROR')
        return handler(event, context)
      },
      { logMetadata: { region: process.env.AWS_REGION } }
    )
  }
