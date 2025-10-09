import { handleRequestLoggerTask } from '@/lambdas/request-logger/app'
import { ApiRequestLog } from '@/@types/request-logger'

export const handleLocalRequestLogger = async (logs: ApiRequestLog[]) => {
  await handleRequestLoggerTask(logs)
}
