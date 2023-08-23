import { removePulseRiskParameterField } from '../utils/pulse'

export const up = async () => {
  await removePulseRiskParameterField('createdTimestamp', 'TRANSACTION')
}
export const down = async () => {
  // skip
}
