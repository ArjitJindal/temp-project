import { deleteRules } from '../utils/rule'

export const up = async () => {
  await deleteRules(['R-75'])
}
export const down = async () => {
  // skip
}
