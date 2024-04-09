import fs from 'fs'
import path from 'path'
import { simpleGit } from 'simple-git'
import { keyBy } from 'lodash'
import { TRANSACTION_RULES } from '..'
import { RULES_LIBRARY } from '../library'
import { USER_ONGOING_SCREENING_RULES, USER_RULES } from '../../user-rules'
import { RuleService } from '@/services/rules-engine/rule-service'
import { Rule } from '@/@types/openapi-internal/Rule'
import { RISK_LEVELS } from '@/@types/openapi-public-custom/RiskLevel'
import { RiskLevel } from '@/@types/openapi-internal/RiskLevel'

const git = simpleGit()

describe.each(RULES_LIBRARY)('Rule library integrity', (rule) => {
  test(`${rule.id}: ${rule.name}`, () => {
    const ruleImplementation =
      rule.type === 'TRANSACTION'
        ? TRANSACTION_RULES[rule.ruleImplementationName!]
        : rule.type === 'USER'
        ? USER_RULES[rule.ruleImplementationName!]
        : USER_ONGOING_SCREENING_RULES[rule.ruleImplementationName!]

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
})

describe.each(['simple', 'ruleLevels'])('Rule logic validation', (kind) => {
  async function validate(value: unknown) {
    if (kind === 'simple') {
      await RuleService.validateRuleLogic(value)
    } else {
      await RuleService.validateRuleLogic(
        null,
        RISK_LEVELS.reduce((acc, riskLevel) => {
          acc[riskLevel] = value
          return acc
        }, {} as Record<RiskLevel, unknown>)
      )
    }
  }
  test(`[${kind}] Simple values are valid`, async () => {
    await expect(validate(42)).resolves.not.toThrow()
    await expect(validate('')).resolves.not.toThrow()
  })
  test(`[${kind}] Simple valid condition`, async () => {
    await expect(validate({ '==': [1, 1] })).resolves.not.toThrow()
  })
  test(`[${kind}] Logic using var`, async () => {
    await expect(
      validate({ and: [{ '!=': [{ var: 'TRANSACTION:timestamp' }, null] }] })
    ).resolves.not.toThrow()
  })
  test(`[${kind}] Sample of invalid JSON schema`, async () => {
    await expect(
      RuleService.validateRuleLogic({ unknown_operator: [1, 1] })
    ).rejects.toThrow()
  })
  test(`[${kind}] Valid sample from rules`, async () => {
    await expect(
      validate({
        and: [
          {
            '==': [
              {
                var: 'TRANSACTION:destinationPaymentDetails-method',
              },
              'WALLET',
            ],
          },
          {
            '!=': [
              {
                var: 'TRANSACTION:destinationPaymentDetails-name',
              },
              null,
            ],
          },
          {
            'op:contains': [
              {
                var: 'TRANSACTION:destinationPaymentDetails-name',
              },
              [],
            ],
          },
        ],
      })
    ).resolves.not.toThrow()
  })

  test(`[${kind}] Logic using unknown var is not valid`, async () => {
    await expect(
      validate({
        and: [{ '!=': [{ var: 'SOME_NAME_OF_NON_EXISTED_VAR' }, null] }],
      })
    ).rejects.toThrow()
  })
})

describe.each(RULES_LIBRARY)('Rule library logic integrity', (rule) => {
  test(`${rule.id}: ${rule.name}`, async () => {
    const ruleImplementation =
      rule.type === 'TRANSACTION'
        ? TRANSACTION_RULES[rule.ruleImplementationName!]
        : rule.type === 'USER'
        ? USER_RULES[rule.ruleImplementationName!]
        : USER_ONGOING_SCREENING_RULES[rule.ruleImplementationName!]

    expect(ruleImplementation).not.toBeUndefined()
    await expect(
      RuleService.validateRuleLogic(
        rule.defaultLogic,
        rule.defaultRiskLevelLogic,
        rule.defaultLogicAggregationVariables
      )
    ).resolves.not.toThrow()
  })
})

test('Rule ID should be unique', () => {
  expect(new Set(RULES_LIBRARY.map((rule) => rule.id)).size).toBe(
    RULES_LIBRARY.length
  )
})

describe('', () => {
  let originLibrary: { [key: string]: Rule } | null = null
  beforeAll(async () => {
    const REVISION = 'origin/main'
    const LIBRARY_FILE =
      'tarpon/src/services/rules-engine/transaction-rules/library.ts'
    const LIBRARY_FILE_CONTENT = await git.show(`${REVISION}:${LIBRARY_FILE}`)
    fs.writeFileSync(
      path.join(__dirname, '..', '.library.ts'),
      LIBRARY_FILE_CONTENT
    )
    const originLibraryPath = '../.library'
    originLibrary = keyBy((await import(originLibraryPath)).RULES_LIBRARY, 'id')
  })

  describe.each(RULES_LIBRARY)(
    'Rule parameters breaking change check (see: https://www.notion.so/flagright/How-to-handle-rule-parameters-breaking-changes-5f7b6fc2116f43bbb1ffbe8b4a2089aa)',
    (rule) => {
      test(`${rule.id}: ${rule.name}`, async () => {
        if (!originLibrary?.[rule.id]) {
          return
        }
        if (rule.id === 'R-155') {
          // TODO: remove this in another PR later
          return
        }
        const ruleImplementation =
          rule.type === 'TRANSACTION'
            ? TRANSACTION_RULES[rule.ruleImplementationName!]
            : rule.type === 'USER'
            ? USER_RULES[rule.ruleImplementationName!]
            : USER_ONGOING_SCREENING_RULES[rule.ruleImplementationName!]

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
