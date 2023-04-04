import { LAMBDAS } from '@cdk/lambdas'
import { logger } from '@/core/logger'

type Api = 'CONSOLE' | 'PUBLIC' | 'PUBLIC_DEVICE_DATA' | 'PUBLIC_MANAGEMENT'
export function determineApi(context: {
  functionName?: string
}): Api | undefined {
  if (!context?.functionName) {
    return
  }

  let functionName = context?.functionName
  if (process.env.QA_SUBDOMAIN) {
    functionName = functionName.replace(process.env.QA_SUBDOMAIN, '')
  }

  const codePath = LAMBDAS[functionName]?.codePath
  if (!codePath) {
    logger.error('Could not determine lambda from ', context?.functionName)
    return
  }
  const prefix = [
    'console',
    'public-api',
    'public-device-data',
    'public-management',
  ].find((prefix) => codePath.startsWith(prefix))
  if (!prefix) {
    return
  }
  switch (prefix) {
    case 'console':
      return 'CONSOLE'
    case 'public-api':
      return 'PUBLIC'
    case 'public-device-data':
      return 'PUBLIC_DEVICE_DATA'
    case 'public-management':
      return 'PUBLIC_MANAGEMENT'
  }
  return
}
