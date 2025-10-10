export function filterVariantsTest(
  config: { v8?: boolean },
  jestCallback: () => void
) {
  describe('V2', () => {
    jestCallback()
  })
  if (config.v8) {
    describe(' V8', () => {
      beforeAll(() => {
        process.env.__INTERNAL_ENBALE_RULES_ENGINE_V8__ = 'true'
      })
      afterAll(() => {
        process.env.__INTERNAL_ENBALE_RULES_ENGINE_V8__ = ''
      })
      jestCallback()
    })
  }
}
