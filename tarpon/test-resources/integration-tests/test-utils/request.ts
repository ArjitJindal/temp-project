import axios, { AxiosError, AxiosResponse } from 'axios'
import { getApiBasePath, getIncorrectApiBasePath } from './apiBasePath'
import { getApiKey } from './apiKey'
import { HttpError } from '@/@types/http'

type Response<R> = {
  status: number
  data?: R
  code?: string
  message?: string
}

export const makeTestRequest = async <R = any, D = any>(
  url: 'transactions',
  data: D,
  options?: {
    incorrectApiKey?: boolean
    incorrectDomain?: boolean
  }
): Promise<Response<R>> => {
  const baseApi = options?.incorrectDomain
    ? getIncorrectApiBasePath()
    : getApiBasePath()

  const apiKey = await getApiKey()
  try {
    const response = await axios.post<R, AxiosResponse<R>, D>(
      `${baseApi}/${url}`,
      data,
      {
        headers: {
          'x-api-key': options?.incorrectApiKey ? `${apiKey}1` : apiKey,
          'Content-Type': 'application/json',
        },
      }
    )
    return {
      status: response.status,
      data: response.data,
      message: response.statusText,
    }
  } catch (e) {
    const error = e as AxiosError<HttpError>

    return {
      status: error.response?.status || 500,
      message: error.response?.data.message || error.message,
      code: error.response?.data.error,
    }
  }
}
