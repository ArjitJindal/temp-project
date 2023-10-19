import React, { useState } from 'react';
import Donut, { DonutData } from '../charts/Donut';
import {
  COLORS_V2_ANALYTICS_CHARTS_01,
  COLORS_V2_ANALYTICS_CHARTS_02,
  COLORS_V2_ANALYTICS_CHARTS_03,
  COLORS_V2_ANALYTICS_CHARTS_04,
  COLORS_V2_ANALYTICS_CHARTS_05,
  COLORS_V2_ANALYTICS_CHARTS_07,
  COLORS_V2_ANALYTICS_CHARTS_10,
} from '@/components/ui/colors';
import { BusinessUsersListResponse, ConsumerUsersListResponse, UserState } from '@/apis';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
import { WidgetProps } from '@/components/library/Widget/types';
import Widget from '@/components/library/Widget';
import { arrayToCSV } from '@/utils/arrayToCsv';
import WidgetRangePicker, {
  Value as WidgetRangePickerValue,
} from '@/pages/dashboard/analysis/components/widgets/WidgetRangePicker';
import { useUsersQuery } from '@/pages/dashboard/analysis/components/dashboardutils';
import { isSuccess } from '@/utils/asyncResource';
import { capitalizeWords } from '@/utils/humanize';

const COLORS = {
  UNACCEPTABLE: COLORS_V2_ANALYTICS_CHARTS_07,
  TERMINATED: COLORS_V2_ANALYTICS_CHARTS_03,
  ACTIVE: COLORS_V2_ANALYTICS_CHARTS_04,
  DORMANT: COLORS_V2_ANALYTICS_CHARTS_10,
  CREATED: COLORS_V2_ANALYTICS_CHARTS_02,
  SUSPENDED: COLORS_V2_ANALYTICS_CHARTS_05,
  BLOCKED: COLORS_V2_ANALYTICS_CHARTS_01,
};

const USER_STATUS_ORDER = [
  'ACTIVE',
  'BLOCKED',
  'CREATED',
  'DORMANT',
  'SUSPENDED',
  'TERMINATED',
  'UNACCEPTABLE',
];

interface Props extends WidgetProps {
  userType?: 'BUSINESS' | 'CONSUMER';
}

export default function UserStatusDistributionCard(props: Props) {
  const [dateRange, setDateRange] = useState<WidgetRangePickerValue>({
    startTimestamp: Date.now() - 7 * 24 * 60 * 60 * 1000,
    endTimestamp: Date.now(),
  });
  const users = useUsersQuery(props.userType ?? 'CONSUMER', dateRange);

  return (
    <Widget
      onDownload={(): Promise<{ fileName: string; data: string }> => {
        const randomID = (Math.floor(Math.random() * 90000) + 10000).toString();
        return new Promise((resolve, _reject) => {
          const fileData = {
            fileName: `user-status-split-${randomID}.csv`,
            data: isSuccess(users.data) ? arrayToCSV(users.data.value.data) : '',
          };
          resolve(fileData);
        });
      }}
      resizing="FIXED"
      extraControls={[
        <WidgetRangePicker
          value={dateRange}
          onChange={(e) => {
            e && setDateRange(e);
            users.refetch();
          }}
        />,
      ]}
      {...props}
    >
      <AsyncResourceRenderer resource={users.data}>
        {(users: ConsumerUsersListResponse | BusinessUsersListResponse) => {
          const frequencyMap: { [key in UserState]?: number } = {};
          for (const user of users.data) {
            const { userStateDetails } = user;
            if (userStateDetails !== undefined) {
              frequencyMap[userStateDetails.state] =
                (frequencyMap[userStateDetails.state] ?? 0) + 1;
            }
          }

          // Converting the frequency map into an array of objects
          const data: DonutData<UserState> = Object.entries(frequencyMap).map(
            ([action, value]) => ({
              series: action as UserState,
              value: value as number,
            }),
          );

          data.sort((a, b) => {
            return USER_STATUS_ORDER.indexOf(a.series) - USER_STATUS_ORDER.indexOf(b.series);
          });

          return (
            <Donut<UserState>
              data={data}
              colors={COLORS}
              legendPosition="RIGHT"
              formatSeries={(action) => capitalizeWords(action) ?? action}
            />
          );
        }}
      </AsyncResourceRenderer>
    </Widget>
  );
}
