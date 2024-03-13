/* eslint-disable @typescript-eslint/no-var-requires */
import { useState } from 'react';
import DistributionChartWidget from '../widgets/DistributionChartWidget';
import {
  COLORS_V2_ANALYTICS_CHARTS_07,
  COLORS_V2_ANALYTICS_CHARTS_03,
  COLORS_V2_ANALYTICS_CHARTS_04,
  COLORS_V2_ANALYTICS_CHARTS_02,
  COLORS_V2_ANALYTICS_CHARTS_05,
} from '@/components/ui/colors';
import { WidgetProps } from '@/components/library/Widget/types';
import { useQuery } from '@/utils/queries/hooks';
import { USERS_STATS } from '@/utils/queries/keys';
import { useApi } from '@/api';
import { DashboardStatsUsersStats, KYCStatus } from '@/apis';
import { dayjs } from '@/utils/dayjs';
import { KYC_STATUSS } from '@/apis/models-custom/KYCStatus';

const KYC_STATUS_COLORS: Record<KYCStatus, string> = {
  SUCCESSFUL: COLORS_V2_ANALYTICS_CHARTS_07,
  FAILED: COLORS_V2_ANALYTICS_CHARTS_03,
  NOT_STARTED: COLORS_V2_ANALYTICS_CHARTS_04,
  IN_PROGRESS: COLORS_V2_ANALYTICS_CHARTS_02,
  MANUAL_REVIEW: COLORS_V2_ANALYTICS_CHARTS_05,
  CANCELLED: COLORS_V2_ANALYTICS_CHARTS_04,
  NEW: COLORS_V2_ANALYTICS_CHARTS_04,
  EXPIRED: COLORS_V2_ANALYTICS_CHARTS_03,
  EDD_IN_PROGRESS: COLORS_V2_ANALYTICS_CHARTS_02,
};

interface Props extends WidgetProps {
  userType?: 'BUSINESS' | 'CONSUMER';
}

export default function KYCStatusDistributionCard(props: Props) {
  const { userType, ...restProps } = props;
  const [timeRange, setTimeRange] = useState({
    startTimestamp: dayjs().subtract(1, 'year').valueOf(),
    endTimestamp: dayjs().valueOf(),
  });
  const params = {
    userType: userType ?? 'CONSUMER',
    startTimestamp: timeRange.startTimestamp,
    endTimestamp: timeRange.endTimestamp,
  };
  const api = useApi();
  const queryResult = useQuery(USERS_STATS(params), async () => {
    return await api.getDashboardStatsUsersByTime(params);
  });
  return (
    <DistributionChartWidget<DashboardStatsUsersStats, KYCStatus>
      groups={[
        { name: 'kycStatus', attributeName: 'KYC status', attributeDataPrefix: 'kycStatus' },
      ]}
      groupBy="VALUE"
      valueColors={KYC_STATUS_COLORS}
      values={KYC_STATUSS}
      queryResult={queryResult}
      timeRange={timeRange}
      onTimeRangeChange={setTimeRange}
      {...restProps}
    />
  );
}
