import { deleteRules } from '../utils/rule'

export const up = async () => {
  await deleteRules(['R-114', 'R-89'])
}
export const down = async () => {
  // skip
}
