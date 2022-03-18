import { compose } from './compose'
import { httpErrorHandler } from './http-error-handler'
import { jsonSerializer } from './json-serializer'
import { localDev } from './local-dev'

export const lambdaApi = () => {
  const middlewares = [
    httpErrorHandler(),
    jsonSerializer(),
    localDev(),
  ] as const
  return compose(...middlewares)
}
