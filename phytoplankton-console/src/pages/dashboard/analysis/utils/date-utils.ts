import dayjsLib from '@flagright/lib/utils/dayjs';
import { dayjs, YEAR_MONTH_DATE_FORMAT } from '@/utils/dayjs';

export const formatDate = (str: string): string => {
  if (str.match(/^\d{4}-\d{2}-\d{2}$/)) {
    str = dayjs(str, YEAR_MONTH_DATE_FORMAT).format('DD/MM');
  } else if (str.match(/^\d{4}-\d{2}$/)) {
    str = dayjs(str, 'YYYY-MM').format('MM/YYYY');
  } else if (str.match(/^\d{4}-\d{2}-\d{2}T\d{2}$/)) {
    str = dayjsLib.utc(str, 'YYYY-MM-DDTHH').tz(dayjsLib.tz.guess()).format('HH:mm DD/MM');
  }
  return str;
};

export const dayCalc = (val: string) => {
  if (val === 'YEAR') {
    return dayjs().subtract(1, 'year');
  } else if (val === 'MONTH') {
    return dayjs().subtract(1, 'month');
  } else if (val === 'WEEK') {
    return dayjs().subtract(1, 'week');
  }
  return dayjs().subtract(1, 'day');
};

export const granularityTypeTitles = [
  { type: 'DAY' as const, title: 'Day' },
  { type: 'WEEK' as const, title: 'Week' },
  { type: 'MONTH' as const, title: 'Month' },
  { type: 'YEAR' as const, title: 'Year' },
];
