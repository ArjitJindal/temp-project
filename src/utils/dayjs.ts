import dayjsLib, { ConfigType } from 'dayjs'
import utc from 'dayjs/plugin/utc'

dayjsLib.extend(utc)

export type Dayjs = dayjsLib.Dayjs

export default function dayjs(config?: ConfigType): dayjsLib.Dayjs {
  const dayjs = dayjsLib(config)
  return dayjs.utc()
}
