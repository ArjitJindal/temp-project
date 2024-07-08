import { MINUTE_GROUP_SIZE } from '../constants'

export const canAggregateMinute = (
  startGranularity,
  startUnits,
  endGranularity,
  endUnits
) => {
  startUnits = startGranularity === 'hour' ? startUnits * 60 : startUnits
  endUnits = endGranularity === 'hour' ? endUnits * 60 : endUnits
  return (
    startGranularity === 'all_time' ||
    (endGranularity === 'now'
      ? startUnits >= MINUTE_GROUP_SIZE
      : startUnits - endUnits >= MINUTE_GROUP_SIZE)
  )
}
