import { Forbidden } from 'http-errors'
import { hasFeature } from '../utils/context'
import { Feature } from '@/@types/openapi-internal/Feature'

export const featureProtected =
  (features?: Feature[]) =>
  (handler: CallableFunction): CallableFunction =>
  async (...args: any): Promise<any> => {
    // todo: don't we need to have AND logic instead of OR?
    if (features?.find((feature) => !hasFeature(feature))) {
      throw new Forbidden(
        `Not allowed to access because of missing feature flags: ${features?.join(
          ', '
        )}`
      )
    }
    return handler(...args)
  }
