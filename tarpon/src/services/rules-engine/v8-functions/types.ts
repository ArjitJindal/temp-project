import { Func } from '@react-awesome-query-builder/core'
import { RuleFunctionGroup } from '@/@types/openapi-internal/RuleFunctionGroup'

export type RuleFunction<ReturnType = unknown> = {
  key: string
  uiDefinition: Omit<Func, 'jsonLogic'>
  group: RuleFunctionGroup
  run: (values: any[]) => Promise<ReturnType>
}
