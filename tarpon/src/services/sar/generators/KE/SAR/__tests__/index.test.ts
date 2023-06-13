import { Schema } from '@/services/sar/generators/KE/SAR/schema'
describe('SAR Generationr', () => {
  describe('Generate JSON Schema', () => {
    test('Dummy test to log JSON schema to console for use on JSON schema form playground https://rjsf-team.github.io/react-jsonschema-form/', async () => {
      console.log(JSON.stringify(Schema))
    })
  })
})
