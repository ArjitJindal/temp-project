import dayjs from 'dayjs'

export function getTimeLabels(
  formatType: string,
  startTimestamp: number,
  endTimestamp: number,
  granularity: string
) {
  const timeLabels: string[] = []
  for (
    let moment = dayjs(startTimestamp).format(formatType);
    moment <= dayjs(endTimestamp).format(formatType);
    moment = dayjs(moment).add(1, granularity).format(formatType)
  ) {
    timeLabels.push(moment)
  }

  return timeLabels
}
