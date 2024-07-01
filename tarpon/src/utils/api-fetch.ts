import fetchRetry, { RequestInitWithRetry } from 'fetch-retry'
import createHttpError from 'http-errors'
import fetch from 'isomorphic-fetch'
import { addNewSubsegment } from '@/core/xray'

const fetchWithRetry = fetchRetry(fetch, {
  retryOn: [429, 500, 502, 503, 504],
  retryDelay: (attempt) => {
    return Math.pow(2, attempt) * 1000
  },
  retries: 6,
})

export interface ApiFetchResult<T> {
  statusCode: number
  result: T
}

export const apiFetch = async <T>(
  url: RequestInfo,
  options?: RequestInitWithRetry
): Promise<ApiFetchResult<T>> => {
  const subsegment = await addNewSubsegment('ApiFetch', url.toString())
  subsegment?.addMetadata('url', url.toString())
  subsegment?.addMetadata('options', options)
  const response = await fetchWithRetry(url, options)

  if (!response.ok) {
    const responseData = response.headers
      .get('content-type')
      ?.includes('application/json')
      ? await response.json()
      : await response.text()

    subsegment?.addError(responseData)
    subsegment?.close()
    throw createHttpError(response.status, {
      response: responseData,
      message: `Error ${response.statusText} for ${url}`,
      name: 'ApiError',
      stack: new Error().stack,
    })
  }

  subsegment?.close()

  return {
    statusCode: response.status,
    result: await response.json(),
  }
}
