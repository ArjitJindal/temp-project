import { Forbidden } from 'http-errors'
import { hasFeature } from '../utils/context'
import { Feature } from '@/@types/openapi-internal/Feature'

export const featureProtected =
  (features?: Feature[]) =>
  (handler: CallableFunction): CallableFunction =>
  async (...args: any): Promise<any> => {
    if (features?.find((feature) => !hasFeature(feature))) {
      throw new Forbidden(
        `Not allowed to access because of missing feature flag`
      )
    }
    return handler(...args)
  }
