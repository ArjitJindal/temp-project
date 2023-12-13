import { AsyncLogicEngine } from 'json-logic-engine'
import memoizeOne from 'memoize-one'
import DataLoader from 'dataloader'
import { isEqual, uniq } from 'lodash'
import { RULE_FUNCTIONS } from '../v8-functions'
import { RULE_OPERATORS } from '../v8-operators'
import { getRuleVariableByKey } from '../v8-variables'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { getAllValuesByKey } from '@/utils/object'

type RuleData = {
  transaction: Transaction
}

const jsonLogicEngine = new AsyncLogicEngine()
RULE_FUNCTIONS.filter((v) => v.implementation).forEach((v) =>
  jsonLogicEngine.addMethod(v.key, v.implementation!)
)
RULE_OPERATORS.forEach((v) =>
  jsonLogicEngine.addMethod(v.key, v.implementation)
)

const getDataLoader = memoizeOne((data: RuleData) => {
  return new DataLoader(async (variableKeys: readonly string[]) => {
    return Promise.all(
      variableKeys.map(async (variableKey) => {
        const variable = getRuleVariableByKey(variableKey)
        if (variable?.entity === 'TRANSACTION') {
          return variable.load(data.transaction)
        }
        // TODO: hanlde other entities
        return null
      })
    )
  })
}, isEqual)

export async function evaluate(
  jsonLogic: object,
  data: RuleData
): Promise<{
  hit: boolean
  varData: {
    [key: string]: unknown
  }
}> {
  const dataloader = getDataLoader(data)
  const variableKeys = uniq(getAllValuesByKey<string>('var', jsonLogic))
  const entries = await Promise.all(
    variableKeys.map(async (key) => [key, await dataloader.load(key)])
  )
  const varData = Object.fromEntries(entries)
  const hit = await jsonLogicEngine.run(jsonLogic, varData)
  return {
    hit,
    varData,
  }
}
