/* eslint-disable @typescript-eslint/no-var-requires */
import { MutableRefObject, useRef } from 'react';
import Column, { ColumnData } from '../charts/Column';
import { exportDataForBarGraphs } from '../../utils/export-data-build-util';
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
import { dayjs } from '@/utils/dayjs';

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
      const percentage =
        item?.percentage === undefined ? '0' : parseFloat(item?.percentage).toFixed(2);
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
  const pdfRef = useRef() as MutableRefObject<HTMLInputElement>;
  return (
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
          <div ref={pdfRef}>
            <Widget
              resizing="AUTO"
              {...props}
              onDownload={(): Promise<{
                fileName: string;
                data: string;
                pdfRef: MutableRefObject<HTMLInputElement>;
              }> => {
                return new Promise((resolve, _reject) => {
                  const fileData = {
                    fileName: `${userType.toLowerCase()}-users-distribution-by-kyc-status-${dayjs().format(
                      'YYYY_MM_DD',
                    )}`,
                    data: exportDataForBarGraphs(data, 'KYC status', 'Percentage'),
                    pdfRef,
                  };
                  resolve(fileData);
                });
              }}
            >
              <Column
                data={data}
                colors={COLORS}
                height={400}
                hideLegend={true}
                rotateLabel={false}
              />
            </Widget>
          </div>
        );
      }}
    </AsyncResourceRenderer>
  );
}
