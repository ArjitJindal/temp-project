import { useLocalStorageState } from 'ahooks';
import React, { useState } from 'react';
import s from './index.module.less';
import { exportDataForTreemaps } from '@/pages/dashboard/analysis/utils/export-data-build-util';
import {
  COLORS_V2_ANALYTICS_CHARTS_01,
  COLORS_V2_ANALYTICS_CHARTS_09,
  COLORS_V2_ANALYTICS_CHARTS_11,
  COLORS_V2_ANALYTICS_CHARTS_13,
  COLORS_V2_ANALYTICS_CHARTS_15,
  COLORS_V2_ANALYTICS_CHARTS_16,
  COLORS_V2_ANALYTICS_CHARTS_17,
  COLORS_V2_ANALYTICS_CHARTS_18,
  COLORS_V2_ANALYTICS_CHARTS_19,
  COLORS_V2_ANALYTICS_CHARTS_20,
  COLORS_V2_ANALYTICS_CHARTS_23,
} from '@/components/ui/colors';
import ScopeSelector from '@/pages/dashboard/analysis/components/CaseManagement/CaseClosingReasonCard/ScopeSelector';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
import {
  DashboardStatsClosingReasonDistributionStats,
  DashboardStatsClosingReasonDistributionStatsClosingReasonsData,
} from '@/apis';
import { WidgetProps } from '@/components/library/Widget/types';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import Widget from '@/components/library/Widget';
import { CLOSING_REASON_DISTRIBUTION } from '@/utils/queries/keys';
import Treemap, { TreemapData } from '@/pages/dashboard/analysis/components/charts/Treemap';
import WidgetRangePicker, {
  Value as WidgetRangePickerValue,
} from '@/pages/dashboard/analysis/components/widgets/WidgetRangePicker';
import { dayjs } from '@/utils/dayjs';

type ClosingReasons =
  | 'Other'
  | 'False positive'
  | 'Documents collected'
  | 'Transaction Rejected'
  | 'Transaction Refunded'
  | 'Suspicious activity reported (SAR)'
  | 'Documents not collected'
  | 'Investigation completed'
  | 'Escalated'
  | 'User Blacklisted'
  | 'User Terminated';

const TREEMAP_COLORS: { [key in ClosingReasons]: string } = {
  ['False positive']: COLORS_V2_ANALYTICS_CHARTS_23,
  ['Investigation completed']: COLORS_V2_ANALYTICS_CHARTS_17,
  ['Documents collected']: COLORS_V2_ANALYTICS_CHARTS_18,
  ['Suspicious activity reported (SAR)']: COLORS_V2_ANALYTICS_CHARTS_15,
  ['Documents not collected']: COLORS_V2_ANALYTICS_CHARTS_19,
  ['Transaction Refunded']: COLORS_V2_ANALYTICS_CHARTS_09,
  ['Transaction Rejected']: COLORS_V2_ANALYTICS_CHARTS_20,
  ['User Blacklisted']: COLORS_V2_ANALYTICS_CHARTS_16,
  ['User Terminated']: COLORS_V2_ANALYTICS_CHARTS_01,
  ['Escalated']: COLORS_V2_ANALYTICS_CHARTS_13,
  ['Other']: COLORS_V2_ANALYTICS_CHARTS_11,
};

interface Props extends WidgetProps {}

const CaseClosingReasonCard = (props: Props) => {
  const [dateRange, setDateRange] = useState<WidgetRangePickerValue>();
  const [selectedSection, setSelectedSection] = useLocalStorageState(
    'dashboard-closing-reason-active-tab',
    'CASE',
  );
  const api = useApi();
  const params = {
    entity: selectedSection as 'CASE' | 'ALERT',
    startTimestamp: dateRange?.startTimestamp,
    endTimestamp: dateRange?.endTimestamp,
  };
  const queryResult = useQuery(CLOSING_REASON_DISTRIBUTION(selectedSection, params), async () => {
    const response = await api.getDashboardStatsClosingReasonDistributionStats(params);
    return response;
  });
  return (
    <AsyncResourceRenderer<DashboardStatsClosingReasonDistributionStats>
      resource={queryResult.data}
    >
      {({ closingReasonsData }) => {
        const data = closingReasonsData
          ?.map((child: DashboardStatsClosingReasonDistributionStatsClosingReasonsData) => {
            if (child.reason) {
              return {
                name: child.reason,
                value: child.value ?? 0,
              };
            }
            return null;
          })
          .filter(
            (child: DashboardStatsClosingReasonDistributionStatsClosingReasonsData | null) =>
              child != null,
          ) as TreemapData<ClosingReasons>;
        return (
          <Widget
            onDownload={(): Promise<{ fileName: string; data: string }> => {
              return new Promise((resolve, _reject) => {
                const fileData = {
                  fileName: `distribution-by-${selectedSection.toLowerCase()}-closing-reason-${dayjs().format(
                    'YYYY_MM_DD',
                  )}.csv`,
                  data: exportDataForTreemaps(
                    `${selectedSection.toLowerCase()}ClosingReason`,
                    data,
                  ),
                };
                resolve(fileData);
              });
            }}
            resizing="AUTO"
            extraControls={[<WidgetRangePicker value={dateRange} onChange={setDateRange} />]}
            {...props}
          >
            <div className={s.root}>
              <ScopeSelector
                selectedSection={selectedSection}
                setSelectedSection={setSelectedSection}
              />
              <Treemap<ClosingReasons> height={280} data={data} colors={TREEMAP_COLORS} />
            </div>
          </Widget>
        );
      }}
    </AsyncResourceRenderer>
  );
};
export default CaseClosingReasonCard;
