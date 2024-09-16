import { Func } from '@react-awesome-query-builder/core'
import { LogicFunctionGroup } from '@/@types/openapi-internal/LogicFunctionGroup'

export type LogicFunction<ReturnType = unknown> = {
  key: string
  uiDefinition: Omit<Func, 'jsonLogic'>
  group: LogicFunctionGroup
  run: (values: any[]) => Promise<ReturnType>
}
