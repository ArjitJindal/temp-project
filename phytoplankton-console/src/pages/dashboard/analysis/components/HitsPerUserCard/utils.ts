import { RangeValue } from 'rc-picker/es/interface';
import { Dayjs } from '@/utils/dayjs';
import { makeUrl } from '@/utils/routing';

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
