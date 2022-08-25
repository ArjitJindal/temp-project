import fs from 'fs'
import path from 'path'
import { simpleGit } from 'simple-git'
import _ from 'lodash'
import { TRANSACTION_RULES } from '..'
import { TRANSACTION_RULES_LIBRARY } from '../library'
import { RuleService } from '@/lambdas/phytoplankton-internal-api-handlers/services/rule-service'
import { Rule } from '@/@types/openapi-internal/Rule'

const git = simpleGit()

describe.each(TRANSACTION_RULES_LIBRARY)(
  'Rule library integrity',
  (getRule) => {
    const rule = getRule()
    test(`${rule.id}: ${rule.name}`, () => {
      const ruleImplementation = TRANSACTION_RULES[rule.ruleImplementationName]
      expect(ruleImplementation).not.toBeUndefined()
      const schema = ruleImplementation.getSchema()
      expect(() =>
        RuleService.validateRuleParametersSchema(
          schema,
          rule.defaultParameters,
          rule.defaultRiskLevelParameters
        )
      ).not.toThrow()
    })
  }
)

test('Rule ID should be unique', () => {
  expect(
    new Set(TRANSACTION_RULES_LIBRARY.map((getRule) => getRule().id)).size
  ).toBe(TRANSACTION_RULES_LIBRARY.length)
})

describe('', () => {
  let originLibrary: { [key: string]: Rule } | null = null
  beforeAll(async () => {
    const REVISION = 'origin/main'
    const LIBRARY_FILE =
      'src/services/rules-engine/transaction-rules/library.ts'
    const LIBRARY_FILE_CONTENT = await git.show(`${REVISION}:${LIBRARY_FILE}`)
    fs.writeFileSync(
      path.join(__dirname, '..', '.library.ts'),
      LIBRARY_FILE_CONTENT
    )
    const originLibraryPath = '../.library'
    originLibrary = _.keyBy(
      (await import(originLibraryPath)).TRANSACTION_RULES_LIBRARY.map(
        (getRule: any) => getRule()
      ),
      'id'
    )
  })

  describe.each(TRANSACTION_RULES_LIBRARY)(
    'Rule parameters breaking change check (see: https://www.notion.so/flagright/How-to-handle-rule-parameters-breaking-changes-5f7b6fc2116f43bbb1ffbe8b4a2089aa)',
    (getRule) => {
      const rule = getRule()
      // TODO: will be unskipped after merging
      test.skip(`${rule.id}: ${rule.name}`, async () => {
        const ruleImplementation =
          TRANSACTION_RULES[rule.ruleImplementationName]
        const schema = ruleImplementation.getSchema()
        expect(() =>
          RuleService.validateRuleParametersSchema(
            schema,
            originLibrary?.[rule.id].defaultParameters,
            originLibrary?.[rule.id].defaultRiskLevelParameters
          )
        ).not.toThrow()
      })
    }
  )
})
