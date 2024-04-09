import { useLocalStorageState } from 'ahooks';
import { RangeValue } from 'rc-picker/es/interface';
import React, { useMemo, useState } from 'react';
import HitsPerUserCard from './HitsPerUserCard';
import { generateCaseListUrl } from './HitsPerUserCard/utils';
import { getCsvData } from '@/pages/dashboard/analysis/utils/export-data-build-util';
import SegmentedControl from '@/components/library/SegmentedControl';
import Widget from '@/components/library/Widget';
import { WidgetProps } from '@/components/library/Widget/types';
import DatePicker from '@/components/ui/DatePicker';
import { dayjs, Dayjs } from '@/utils/dayjs';
import { usePaginatedQuery } from '@/utils/queries/hooks';
import { HITS_PER_USER } from '@/utils/queries/keys';
import { useApi } from '@/api';
import { isSuccess } from '@/utils/asyncResource';
import { getUserLink, getUserName } from '@/utils/api/users';
import { getCurrentDomain } from '@/utils/routing';

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
  const dataToExport = useMemo(() => {
    if (isSuccess(hitsPerUserResult.data)) {
      const data = hitsPerUserResult.data.value.items.map((item) => {
        const caseLink = item.userId
          ? `${getCurrentDomain()}${generateCaseListUrl(item.userId, direction, dateRange)}`
          : null;
        return {
          userId: `${item.userId} (${getCurrentDomain()}${getUserLink(item.user)})`,
          userName: getUserName(item.user) ?? '',
          ruleHit: `${item.rulesHitCount} hits`,
          openCases: `${item.openCasesCount} open cases ${caseLink ? `(${caseLink})` : ''}`,
        };
      });
      return data;
    }
    return [];
  }, [hitsPerUserResult.data, direction, dateRange]);
  return (
    <Widget
      {...props}
      resizing="AUTO"
      extraControls={[<DatePicker.RangePicker value={dateRange} onChange={setDateRange} />]}
      onDownload={(): Promise<{ fileName: string; data: string }> => {
        return new Promise((resolve, _reject) => {
          const fileData = {
            fileName: `top-${userType.toLowerCase()}-users-by-rule-hit-${dayjs().format(
              'YYYY_MM_DD',
            )}.csv`,
            data: getCsvData(dataToExport),
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
