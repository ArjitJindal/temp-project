import dayjsLib, { ConfigType, OptionType } from 'dayjs';
import tz from 'dayjs/plugin/timezone';
import localizedFormat from 'dayjs/plugin/localizedFormat';
import utc from 'dayjs/plugin/utc';

dayjsLib.extend(tz);
dayjsLib.extend(localizedFormat);
dayjsLib.extend(utc);

export type Dayjs = dayjsLib.Dayjs;

export const dayjs = (date?: ConfigType, option?: OptionType): Dayjs => {
  const dayjs = dayjsLib(date, option);
  return dayjs;
};

export const DEFAULT_DATE_FORMAT = 'll';
export const DEFAULT_TIME_FORMAT = 'LTS';
export const DEFAULT_DATE_TIME_FORMAT = 'll LTS';
export const YEAR_MONTH_DATE_FORMAT = 'YYYY-MM-DD';
