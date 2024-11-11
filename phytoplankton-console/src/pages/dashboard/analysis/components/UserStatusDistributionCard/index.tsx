import React, { MutableRefObject, useRef, useState } from 'react';
import { capitalizeWords } from '@flagright/lib/utils/humanize';
import Donut from '../charts/Donut';
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
import { DashboardStatsUsersStats, UserState } from '@/apis';
import { WidgetProps } from '@/components/library/Widget/types';
import Widget from '@/components/library/Widget';
import WidgetRangePicker, {
  Value as WidgetRangePickerValue,
} from '@/pages/dashboard/analysis/components/widgets/WidgetRangePicker';
import { useUsersQuery } from '@/pages/dashboard/analysis/components/dashboardutils';
import { dayjs } from '@/utils/dayjs';
import { map, getOr } from '@/utils/asyncResource';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { USERS_STATS } from '@/utils/queries/keys';

const COLORS = {
  UNACCEPTABLE: COLORS_V2_ANALYTICS_CHARTS_07,
  TERMINATED: COLORS_V2_ANALYTICS_CHARTS_03,
  ACTIVE: COLORS_V2_ANALYTICS_CHARTS_04,
  DORMANT: COLORS_V2_ANALYTICS_CHARTS_10,
  CREATED: COLORS_V2_ANALYTICS_CHARTS_02,
  SUSPENDED: COLORS_V2_ANALYTICS_CHARTS_05,
  BLOCKED: COLORS_V2_ANALYTICS_CHARTS_01,
};

interface Props extends WidgetProps {
  userType?: 'BUSINESS' | 'CONSUMER';
}

export default function UserStatusDistributionCard(props: Props) {
  const { userType = 'CONSUMER', id } = props;
  const [dateRange, setDateRange] = useState<WidgetRangePickerValue | undefined>({
    startTimestamp: dayjs().subtract(1, 'year').valueOf(),
    endTimestamp: dayjs().valueOf(),
  });
  const params = {
    userType,
    startTimestamp: dateRange?.startTimestamp,
    endTimestamp: dateRange?.endTimestamp,
    id: id,
  };
  const usersResult = useUsersQuery(userType, dateRange);
  const pdfRef = useRef() as MutableRefObject<HTMLInputElement>;
  const api = useApi();
  const queryResult = useQuery(USERS_STATS(params), async () => {
    return await api.getDashboardStatsUsersByTime(params);
  });

  const dataResource = map(queryResult.data, (data: DashboardStatsUsersStats[]) => {
    const statusMap = data.reduce((acc, curr) => {
      Object.entries(curr).forEach(([key, value]) => {
        if (key.startsWith('userState')) {
          const status = key.split('_')[1] as UserState;
          acc[status] = (acc[status] ?? 0) + (value ?? 0);
        }
      });
      return acc;
    }, {});
    return Object.entries(statusMap).map(([status, value]) => ({
      series: status as UserState,
      value: value as number,
    }));
  });

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
