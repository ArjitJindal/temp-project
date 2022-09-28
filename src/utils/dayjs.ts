import dayjsLib, { ConfigType } from 'dayjs'
import utc from 'dayjs/plugin/utc'
import durationPlugin, {
  Duration,
  DurationUnitType,
} from 'dayjs/plugin/duration'

dayjsLib.extend(utc)
dayjsLib.extend(durationPlugin)

export type Dayjs = dayjsLib.Dayjs

export default function dayjs(config?: ConfigType): dayjsLib.Dayjs {
  const dayjs = dayjsLib(config)
  return dayjs.utc()
}

export function duration(time: number, unit?: DurationUnitType): Duration {
  return dayjsLib.duration(time, unit)
}
