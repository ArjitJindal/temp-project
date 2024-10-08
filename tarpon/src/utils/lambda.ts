import { DrsScoreTriggeredByEnum } from '@/@types/openapi-internal/DrsScore'

export function parseStrings<T = string>(
  raw: string | undefined | null
): T[] | undefined {
  if (raw == null || raw === '') {
    return undefined
  }
  return raw.split(',').filter((x) => x !== '') as unknown as T[]
}

export function getTriggerSource(): DrsScoreTriggeredByEnum {
  const lambdaName = process.env.AWS_LAMBDA_FUNCTION_NAME
  if (lambdaName?.startsWith('Console')) {
    return 'CONSOLE'
  }

  if (
    lambdaName?.startsWith('Public') &&
    !process.env.SOURCE?.includes('/batch/')
  ) {
    return 'PUBLIC_API'
  }

  return 'BATCH'
}
