import { deleteRules } from '../utils/rule'

export const up = async () => {
  await deleteRules(['R-54'])
}
export const down = async () => {
  // skip
}
