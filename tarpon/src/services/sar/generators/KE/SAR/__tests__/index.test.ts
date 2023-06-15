import {
  KenyaReportSchema,
  KenyaTransactionSchema,
} from '@/services/sar/generators/KE/SAR/schema'
describe.skip('SAR Generation', () => {
  describe('Dummy tests to log JSON schema to console for use on JSON schema form playground https://rjsf-team.github.io/react-jsonschema-form/', () => {
    test('Report Schema', async () => {
      console.log(JSON.stringify(KenyaReportSchema))
    })
    test('Transaction Schema', async () => {
      console.log(JSON.stringify(KenyaTransactionSchema))
    })
  })
})
