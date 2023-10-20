import { useLocalStorageState } from 'ahooks';
import { RangeValue } from 'rc-picker/es/interface';
import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import HitsPerUserCard from './HitsPerUserCard';
import SegmentedControl from '@/components/library/SegmentedControl';
import Widget from '@/components/library/Widget';
import { WidgetProps } from '@/components/library/Widget/types';
import DatePicker from '@/components/ui/DatePicker';
import { dayjs, Dayjs } from '@/utils/dayjs';
import { usePaginatedQuery } from '@/utils/queries/hooks';
import { HITS_PER_USER } from '@/utils/queries/keys';
import { useApi } from '@/api';
import { arrayToCSV } from '@/utils/arrayToCsv';

interface Props extends WidgetProps {
  userType?: 'BUSINESS' | 'CONSUMER';
}

type ScopeSelectorValue = 'ALL' | 'ORIGIN' | 'DESTINATION';

const TopUsersHitCard = (props: Props) => {
  const { userType = 'BUSINESS' } = props;

  const [dateRange, setDateRange] = useState<RangeValue<Dayjs>>([
    dayjs().subtract(1, 'week'),
    dayjs(),
  ]);
  const [selectedSection, setSelectedSection] = useLocalStorageState<ScopeSelectorValue>(
    `dashboard-${userType}-user-active-tab`,
    'ALL',
  );

  const api = useApi();
  const direction = selectedSection !== 'ALL' ? selectedSection : undefined;

  const hitsPerUserResult = usePaginatedQuery(
    HITS_PER_USER(dateRange, direction),
    async (paginationParams) => {
      let startTimestamp = dayjs().subtract(1, 'day').valueOf();
      let endTimestamp = Date.now();

      const [start, end] = dateRange ?? [];
      if (start != null && end != null) {
        startTimestamp = start.startOf('day').valueOf();
        endTimestamp = end.endOf('day').valueOf();
      }

      const result = await api.getDashboardStatsHitsPerUser({
        ...paginationParams,
        startTimestamp,
        endTimestamp,
        direction,
        userType,
      });

      return {
        total: result.data.length,
        items: result.data,
      };
    },
  );

  return (
    <Widget
      {...props}
      extraControls={[<DatePicker.RangePicker value={dateRange} onChange={setDateRange} />]}
      onDownload={(): Promise<{ fileName: string; data: string }> => {
        const randomID = uuidv4();

        return new Promise((resolve, _reject) => {
          const fileData = {
            fileName: `top-users-hit-${randomID}.csv`,
            data:
              hitsPerUserResult.data.kind === 'SUCCESS'
                ? arrayToCSV(hitsPerUserResult.data.value.items)
                : '',
          };
          resolve(fileData);
        });
      }}
    >
      <SegmentedControl<ScopeSelectorValue>
        size="MEDIUM"
        active={selectedSection as ScopeSelectorValue}
        onChange={(newValue) => {
          setSelectedSection(newValue);
        }}
        items={[
          { value: 'ALL', label: `All users` },
          { value: 'ORIGIN', label: `Senders` },
          { value: 'DESTINATION', label: `Receivers` },
        ]}
        style={{ marginBottom: '1rem' }}
      />
      <HitsPerUserCard
        direction={selectedSection !== 'ALL' ? selectedSection : undefined}
        userType={userType}
        dateRange={dateRange}
        hitsPerUserResult={hitsPerUserResult}
      />
    </Widget>
  );
};

export default TopUsersHitCard;
