import { deleteRules } from '../utils/rule'
import { envIs } from '@/utils/env'

export const up = async () => {
  if (envIs('dev')) {
    await deleteRules(['R-11'])
  }
}
export const down = async () => {
  // skip
}
