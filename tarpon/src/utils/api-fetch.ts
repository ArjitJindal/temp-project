import { backOff } from 'exponential-backoff'
import fetch, { RequestInfo, RequestInit } from 'node-fetch'
import { logger } from '@/core/logger'
import { addNewSubsegment } from '@/core/xray'

const callApi = async (url: RequestInfo, init: RequestInit) => {
  try {
    const response = await fetch(url, init)
    return response
  } catch (error: any) {
    logger.error(`Error while calling ${url}: ${error?.message}`)
    throw error
  }
}

export const apiFetch = async <T>(
  url: RequestInfo,
  init: RequestInit
): Promise<{ result: T; statusCode: number }> => {
  const subsegment = await addNewSubsegment('apiFetch', url.toString())
  subsegment?.addMetadata('url', { url: url.toString(), init })
  try {
    let response = await callApi(url, init)

    if (response.status === 429) {
      await new Promise((resolve) => setTimeout(resolve, 1000))
      response = await backOff(() => callApi(url, init), {
        startingDelay: 1000,
        maxDelay: 100 * 1000,
        jitter: 'full',
      })
    }

    if (response.status >= 500) {
      throw new Error(
        `Error while calling ${url}: ${response.status} ${response.statusText}`
      )
    }

    if (!response.headers.get('content-type')?.includes('application/json')) {
      const text = await response.text()
      throw new Error(
        `Error while calling ${url}: ${response.status} ${response.statusText} ${text}`
      )
    }

    const result = await response.json()
    return { result, statusCode: response.status }
  } catch (error: any) {
    logger.error(`Error while calling ${url}: ${error?.message}`)
    subsegment?.addError(error)
    throw error
  } finally {
    subsegment?.close()
  }
}
