import { Feature } from '@/@types/openapi-internal/Feature'

export function withFeatureHook(features: Feature[]) {
  beforeAll(() => {
    process.env.TEST_ENABLED_FEATURES = features.join(',')
  })
  afterAll(() => {
    process.env.TEST_ENABLED_FEATURES = ''
  })
}
