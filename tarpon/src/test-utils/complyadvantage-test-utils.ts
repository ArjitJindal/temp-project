import {
  MOCK_SEARCH_EMPTY_DATA,
  MOCK_SEARCH_1794517025_DATA,
} from './resources/mock-ca-search-response'
import * as apiFetchModule from '@/utils/api-fetch'

export function mockComplyAdvantageSearch(hit = true) {
  process.env.COMPLYADVANTAGE_API_KEY = 'fake'
  const mockFetch = jest.spyOn(apiFetchModule, 'apiFetch')

  mockFetch.mockImplementation(
    async (
      ...args: Parameters<(typeof apiFetchModule)['apiFetch']>
    ): ReturnType<(typeof apiFetchModule)['apiFetch']> => {
      const [urlStr, params] = args
      if (typeof urlStr !== 'string') {
        throw new Error(`Only url as request info is supported in the mock`)
      }
      const url = new URL(urlStr)
      if (url.host !== 'api.complyadvantage.com') {
        throw new Error(`Host is not mocked: ${url.host}`)
      }
      if (url.pathname.match(new RegExp('^/searches$'))) {
        if (params?.method === 'POST') {
          return {
            statusCode: 200,
            result: hit
              ? MOCK_SEARCH_1794517025_DATA.details
              : MOCK_SEARCH_EMPTY_DATA.details,
          }
        }
        throw new Error(
          `Method "${params?.method}" is not supported for url "${urlStr}" in mock`
        )
      } else if (url.pathname.match(new RegExp('^/searches/.+/details$'))) {
        if (params?.method === 'GET') {
          return {
            statusCode: 200,
            result: hit
              ? MOCK_SEARCH_1794517025_DATA.details
              : MOCK_SEARCH_EMPTY_DATA.details,
          }
        }
      } else if (url.pathname.match(new RegExp('^/searches/.+/monitors$'))) {
        if (params?.method === 'PATCH') {
          // ignore
          return {
            statusCode: 200,
            result: null,
          }
        }
        // console.log('url', url.pathname)
        // throw new Error(`Method here`)
      } else if (
        url.pathname.match(new RegExp('^/searches/.+/entities/comply$'))
      ) {
        if (params?.method === 'GET') {
          const page = parseInt(url.searchParams.get('page') ?? '1')

          if (page === 1) {
            return {
              statusCode: 200,
              result: MOCK_SEARCH_1794517025_DATA.entities[0],
            }
          } else if (page === 2) {
            return {
              statusCode: 200,
              result: MOCK_SEARCH_1794517025_DATA.entities[1],
            }
          } else if (page === 3) {
            return {
              statusCode: 200,
              result: MOCK_SEARCH_1794517025_DATA.entities[2],
            }
          } else if (page === 4) {
            return {
              statusCode: 200,
              result: MOCK_SEARCH_1794517025_DATA.entities[3],
            }
          } else if (page === 5) {
            return {
              statusCode: 200,
              result: MOCK_SEARCH_1794517025_DATA.entities[4],
            }
          }
          return {
            statusCode: 200,
            result: {
              code: 200,
              status: 'success',
            },
          }
        }
        // console.log('url', url.pathname)
        throw new Error(`Not implemented`)
      }
      throw new Error(
        `This url is not handled in mock: ${urlStr} (${
          params?.method ?? 'GET'
        })`
      )
    }
  )
  return mockFetch
}
