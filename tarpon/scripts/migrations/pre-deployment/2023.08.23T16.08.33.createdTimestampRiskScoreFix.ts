import { renamePulseRiskParameterField } from '../utils/pulse'

export const up = async () => {
  await renamePulseRiskParameterField(
    'createdTimestamp',
    'TRANSACTION',
    'consumerCreatedTimestamp'
  )
}
export const down = async () => {
  // skip
}
