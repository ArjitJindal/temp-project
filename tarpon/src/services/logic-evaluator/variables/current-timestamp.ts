import { CommonUserLogicVariable } from './types'
export const CURRENT_TIMESTAMP: CommonUserLogicVariable = {
  key: 'currentTimestamp',
  entity: 'USER',
  uiDefinition: {
    label: 'Current timestamp (timestamp when the rule is run)',
    preferWidgets: ['time'],
    type: 'datetime',
  },
  valueType: 'number',
  load: async () => {
    return Date.now()
  },
}
