import { Func } from '@react-awesome-query-builder/core'

export type RuleFunction<ReturnType = unknown> = {
  key: string
  uiDefinition: Omit<Func, 'jsonLogic'>
  run: (...args: any[]) => Promise<ReturnType>
}
