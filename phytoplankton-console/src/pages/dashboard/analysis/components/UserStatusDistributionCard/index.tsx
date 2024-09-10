import React, { MutableRefObject, useRef, useState } from 'react';
import { capitalizeWords } from '@flagright/lib/utils/humanize';
import Donut, { DonutData } from '../charts/Donut';
import { exportDataForDonuts } from '@/pages/dashboard/analysis/utils/export-data-build-util';
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
import { WidgetProps } from '@/components/library/Widget/types';
import Widget from '@/components/library/Widget';
import WidgetRangePicker, {
  Value as WidgetRangePickerValue,
} from '@/pages/dashboard/analysis/components/widgets/WidgetRangePicker';
import { useUsersQuery } from '@/pages/dashboard/analysis/components/dashboardutils';
import { dayjs } from '@/utils/dayjs';
import { map, getOr } from '@/utils/asyncResource';

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
  const { userType = 'CONSUMER' } = props;
  const [dateRange, setDateRange] = useState<WidgetRangePickerValue | undefined>({
    startTimestamp: dayjs().subtract(1, 'year').valueOf(),
    endTimestamp: dayjs().valueOf(),
  });
  const usersResult = useUsersQuery(userType, dateRange);
  const pdfRef = useRef() as MutableRefObject<HTMLInputElement>;
  const dataResource = map(
    usersResult.data,
    (users: ConsumerUsersListResponse | BusinessUsersListResponse): DonutData<UserState> => {
      const frequencyMap: { [key in UserState]?: number } = {};
      for (const user of users.items) {
        const { userStateDetails } = user;
        if (userStateDetails !== undefined) {
          frequencyMap[userStateDetails.state] = (frequencyMap[userStateDetails.state] ?? 0) + 1;
        }
      }

      // Converting the frequency map into an array of objects
      const data: DonutData<UserState> = Object.entries(frequencyMap).map(([action, value]) => ({
        series: action as UserState,
        value: value as number,
      }));

      data.sort((a, b) => {
        return USER_STATUS_ORDER.indexOf(a.series) - USER_STATUS_ORDER.indexOf(b.series);
      });
      return data;
    },
  );

  return (
    <div ref={pdfRef}>
      <Widget
        onDownload={(): Promise<{
          fileName: string;
          data: string;
          pdfRef: MutableRefObject<HTMLInputElement>;
        }> => {
          return new Promise((resolve, _reject) => {
            const fileData = {
              fileName: `${userType.toLowerCase()}-user-status-distribution-${dayjs().format(
                'YYYY_MM_DD',
              )}`,
              data: exportDataForDonuts('userStatus', getOr(dataResource, [])),
              pdfRef,
              tableTitle: `${
                userType.charAt(0).toUpperCase() + userType.slice(1).toLowerCase()
              } user status distribution`,
            };
            resolve(fileData);
          });
        }}
        resizing="AUTO"
        extraControls={[
          <WidgetRangePicker
            value={dateRange}
            onChange={(e) => {
              setDateRange(e);
              usersResult.refetch();
            }}
          />,
        ]}
        {...props}
      >
        <Donut<UserState>
          data={dataResource}
          colors={COLORS}
          legendPosition="RIGHT"
          formatSeries={(action) => capitalizeWords(action) ?? action}
        />
      </Widget>
    </div>
  );
}
