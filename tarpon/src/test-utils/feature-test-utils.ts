import { Feature } from '@/@types/openapi-internal/Feature'

export function withFeatureHook(features: Feature[]) {
  beforeAll(() => {
    process.env.TEST_ENABLED_FEATURES = features.join(',')
  })
  afterAll(() => {
    process.env.TEST_ENABLED_FEATURES = ''
  })
}

export function withFeaturesToggled(
  requiredFeatures: Feature[],
  featuresToToggle: Feature[],
  callback: () => void
) {
  describe(`With features ${requiredFeatures.join(', ')}`, () => {
    withFeatureHook(requiredFeatures)
    callback()
  })

  describe(`With features ${requiredFeatures
    .concat(featuresToToggle)
    .join(', ')}`, () => {
    withFeatureHook(requiredFeatures.concat(featuresToToggle))
    callback()
  })
}
