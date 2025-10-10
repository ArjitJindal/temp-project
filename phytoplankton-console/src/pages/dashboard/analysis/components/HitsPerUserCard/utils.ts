import { RangeValue } from 'rc-picker/es/interface';
import { Dayjs } from '@/utils/dayjs';
import { makeUrl } from '@/utils/routing';
import { FROZEN_STATUSES } from '@/pages/rules/utils';

export const generateCaseListUrl = (
  userId: string,
  direction: 'ORIGIN' | 'DESTINATION' | 'ALL' = 'ALL',
  dateRange: RangeValue<Dayjs> | undefined,
) => {
  let startTimestamp;
  let endTimestamp;
  const [start, end] = dateRange ?? [];
  if (start != null && end != null) {
    startTimestamp = start.startOf('day').valueOf();
    endTimestamp = end.endOf('day').valueOf();
  }
  return makeUrl(
    '/case-management/cases',
    {},
    {
      userId,
      userFilterMode: direction,
      createdTimestamp: `${startTimestamp},${endTimestamp}`,
    },
  );
};

export const generateAlertsListUrl = (
  keys: { [key: string]: string | undefined },
  direction: 'ORIGIN' | 'DESTINATION' | 'ALL' = 'ALL',
  dateRange: RangeValue<Dayjs> | undefined,
) => {
  let startTimestamp;
  let endTimestamp;
  const [start, end] = dateRange ?? [];
  if (start != null && end != null) {
    startTimestamp = start.startOf('day').valueOf();
    endTimestamp = end.endOf('day').valueOf();
  }
  const frozenStatuses = Object.entries(FROZEN_STATUSES).map(([_key, value]) => value.value);
  return makeUrl(
    '/case-management/cases',
    {},
    {
      showCases: 'ALL_ALERTS',
      ...keys,
      userFilterMode: direction,
      ...(dateRange && startTimestamp != null && endTimestamp != null
        ? { createdTimestamp: `${startTimestamp},${endTimestamp}` }
        : {}),
      alertStatus: ['OPEN', 'ESCALATED', ...frozenStatuses].join(','),
    },
  );
};
