import { Context } from 'aws-lambda'
import { logger } from '../logger'
import { getContext } from '../utils/context-storage'

type Handler = <TEvent = any, TResult = any>(
  event: TEvent,
  context: Context
) => Promise<TResult>

interface CustomReportMetrics {
  tenantId?: string
  userId?: string
  transactionId?: string
  eventId?: string
  businessMetric?: string
  customData?: Record<string, any>
}

export const performanceLoggerMiddleware =
  (
    customMetrics?: Partial<CustomReportMetrics>,
    enablePerformanceLogging?: boolean
  ) =>
  (handler: CallableFunction): Handler =>
  async (event: any, context: Context): Promise<any> => {
    if (!enablePerformanceLogging) {
      return handler(event, context)
    }

    const startTime = Date.now()
    const startMemory = process.memoryUsage()

    try {
      // Execute the handler
      const result = await handler(event, context)

      // Calculate metrics
      const endTime = Date.now()
      const endMemory = process.memoryUsage()
      const duration = endTime - startTime
      const memoryUsed = Math.max(endMemory.heapUsed - startMemory.heapUsed, 0)

      // Get context data
      const contextData = getContext()
      const tenantId = contextData?.tenantId
      const logMetadata = contextData?.logMetadata

      // Extract additional metrics from result or event if available
      const extractedMetrics = extractMetricsFromEventOrResult(event, result)

      // Create custom REPORT-like log
      const customReport = {
        type: 'CUSTOM_REPORT',
        requestId: logMetadata?.requestId || context?.awsRequestId,
        functionName: context?.functionName,
        duration: `${duration} ms`,
        memoryUsed: `${Math.round(memoryUsed / 1024 / 1024)} MB`,
        tenantId,
        ...extractedMetrics,
        ...customMetrics,
        timestamp: new Date().toISOString(),
      }

      logger.info('Custom Performance Report', customReport)

      return result
    } catch (error) {
      const endTime = Date.now()
      const duration = endTime - startTime
      const contextData = getContext()

      logger.error('Custom Error Report', {
        type: 'CUSTOM_ERROR_REPORT',
        requestId: contextData?.logMetadata?.requestId || context?.awsRequestId,
        functionName: context?.functionName,
        duration: `${duration} ms`,
        error: error instanceof Error ? error.message : String(error),
        tenantId: contextData?.tenantId,
        ...customMetrics,
        timestamp: new Date().toISOString(),
      })

      throw error
    }
  }

function extractMetricsFromEventOrResult(
  event: any,
  result: any
): Record<string, any> {
  const metrics: Record<string, any> = {}

  if (event?.requestContext?.authorizer?.principalId) {
    metrics.tenantId = event.requestContext.authorizer.principalId
  }

  if (event?.body) {
    try {
      const body =
        typeof event.body === 'string' ? JSON.parse(event.body) : event.body
      if (body?.Transaction?.transactionId) {
        metrics.transactionId = body.Transaction.transactionId
      }
      if (body?.TransactionEvent?.transactionId) {
        metrics.transactionId = body.TransactionEvent.transactionId
        metrics.eventId = body.TransactionEvent.eventId
      }
      if (body?.ConsumerUserEvent?.userId) {
        metrics.userId = body.ConsumerUserEvent.userId
        metrics.eventId = body.ConsumerUserEvent.eventId
      }
      if (body?.BusinessUserEvent?.userId) {
        metrics.businessUserId = body.BusinessUserEvent.userId
        metrics.eventId = body.BusinessUserEvent.eventId
      }
    } catch (error) {
      logger.warn('Error extracting metrics from event or result', error)
    }
  }

  if (result?.transactionId) {
    metrics.transactionId = result.transactionId
  }
  if (result?.hitRules?.length) {
    metrics.hitRulesCount = result.hitRules.length
  }
  if (result?.executedRules?.length) {
    metrics.executedRulesCount = result.executedRules.length
  }
  if (result?.status) {
    metrics.resultStatus = result.status
  }

  return metrics
}

export const createPerformanceLogger = (
  customMetrics?: Partial<CustomReportMetrics>
) => performanceLoggerMiddleware(customMetrics)
