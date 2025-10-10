import {
  KenyaReportSchema,
  KenyaTransactionSchema,
} from '@/services/sar/generators/KE/SAR/schema'
import { Report } from '@/@types/openapi-internal/Report'
import { KenyaSARReportGenerator } from '@/services/sar/generators/KE/SAR'

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

describe('Schema to XML', () => {
  test('Test that field order is maintained', async () => {
    const generator = new KenyaSARReportGenerator()
    const xml = await generator.generate(
      {
        indicators: [],
        report: {
          reentity_id: 'reentity_id',
          submission_code: 'E',
        },
        transactions: [],
      },
      { id: 'reportId' } as Report
    )
    expect(xml).toEqual({ type: 'STRING', value: expected })
  })
})

const expected = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><report><reentity_id>reentity_id</reentity_id><submission_code>E</submission_code><report_code>SAR</report_code><entity_reference>reportId</entity_reference></report>`
