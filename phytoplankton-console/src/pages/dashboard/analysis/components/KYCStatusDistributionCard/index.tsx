/* eslint-disable @typescript-eslint/no-var-requires */
import Column, { ColumnData } from '../charts/Column';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { USERS_KYC_STATUS_STATS } from '@/utils/queries/keys';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
import NoData from '@/pages/case-management-item/CaseDetails/InsightsCard/components/NoData';
import {
  COLORS_V2_ANALYTICS_CHARTS_07,
  COLORS_V2_ANALYTICS_CHARTS_03,
  COLORS_V2_ANALYTICS_CHARTS_04,
  COLORS_V2_ANALYTICS_CHARTS_02,
  COLORS_V2_ANALYTICS_CHARTS_05,
} from '@/components/ui/colors';
import { KYCStatus } from '@/apis';
import { KYC_STATUSES as definedOrder } from '@/utils/api/users';
import Widget from '@/components/library/Widget';
import { WidgetProps } from '@/components/library/Widget/types';

const KYC_STATUS_COLORS = {
  SUCCESSFUL: COLORS_V2_ANALYTICS_CHARTS_07,
  FAILED: COLORS_V2_ANALYTICS_CHARTS_03,
  NOT_STARTED: COLORS_V2_ANALYTICS_CHARTS_04,
  IN_PROGRESS: COLORS_V2_ANALYTICS_CHARTS_02,
  MANUAL_REVIEW: COLORS_V2_ANALYTICS_CHARTS_05,
};

interface Props extends WidgetProps {
  userType?: 'BUSINESS' | 'CONSUMER';
}

export default function KYCStatusDistributionCard(props: Props) {
  const { userType = 'CONSUMER' } = props;
  const api = useApi();
  const queryResult = useQuery(USERS_KYC_STATUS_STATS(userType), async () => {
    const response = await api.getDashboardStatsKycStatusDistribution({ userType });
    const lookUp: Record<string, { kycStatus: KYCStatus; count: number; percentage: number }> = {};
    response.data.forEach((item) => {
      const percentage = item?.percentage === undefined ? '0' : item?.percentage;
      const obj = {
        kycStatus: item?.kycStatus,
        count: item?.count,
        percentage: parseFloat(percentage),
      };
      lookUp[item?.kycStatus] = obj;
    });
    return {
      total: response.total,
      items: definedOrder.map((val) => lookUp[val]),
    };
  });
  return (
    <Widget resizing="FIXED" {...props}>
      <AsyncResourceRenderer resource={queryResult.data}>
        {(response) => {
          if (response.total === 0) {
            return <NoData />;
          }
          const data: ColumnData<string, number, string> = response.items.map((item) => {
            return {
              xValue: item?.kycStatus,
              yValue: item?.percentage ?? 0,
              series: item?.kycStatus,
            };
          });
          let COLORS = {};
          response.items.map((item) => {
            COLORS = {
              ...COLORS,
              [item?.kycStatus]: KYC_STATUS_COLORS[item?.kycStatus] as string,
            };
          });
          return (
            <Column
              data={data}
              colors={COLORS}
              height={400}
              hideLegend={true}
              rotateLabel={false}
            />
          );
        }}
      </AsyncResourceRenderer>
    </Widget>
  );
}
