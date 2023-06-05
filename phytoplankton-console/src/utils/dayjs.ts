import dayjsLib, { ConfigType, OptionType } from 'dayjs';
import tz from 'dayjs/plugin/timezone';
import localizedFormat from 'dayjs/plugin/localizedFormat';
import utc from 'dayjs/plugin/utc';
import durationPlugin from 'dayjs/plugin/duration';
import relativeTime from 'dayjs/plugin/relativeTime';
import { RiskParameterValueDayRange } from '@/apis';
import { neverReturn } from '@/utils/lang';

dayjsLib.extend(relativeTime);
dayjsLib.extend(tz);
dayjsLib.extend(localizedFormat);
dayjsLib.extend(utc);
dayjsLib.extend(durationPlugin);

export type Dayjs = dayjsLib.Dayjs;

export const dayjs = (date?: ConfigType, option?: OptionType): Dayjs => {
  const dayjs = dayjsLib(date, option);
  return dayjs;
};

export const duration: durationPlugin.CreateDurationType = dayjsLib.duration;

export const DEFAULT_DATE_FORMAT = 'll';
export const DEFAULT_TIME_FORMAT = 'LTS';
export const DEFAULT_DATE_TIME_FORMAT = 'll LTS';
export const YEAR_MONTH_DATE_FORMAT = 'YYYY-MM-DD';

export const convertToDays = (
  value: number,
  granularity: RiskParameterValueDayRange['startGranularity'],
) => {
  switch (granularity) {
    case 'DAYS':
      return value;
    case 'MONTHS':
      return value * 30;
    case 'YEARS':
      return value * 365;
  }
  return neverReturn(granularity, value);
};

export default {
  dayjs,
  duration,
};
