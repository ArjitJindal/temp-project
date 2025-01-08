import { useLocalStorageState } from 'ahooks';
import React, { MutableRefObject, useRef, useState } from 'react';
import s from './index.module.less';
import { exportDataForTreemaps } from '@/pages/dashboard/analysis/utils/export-data-build-util';
import {
  COLORS_V2_ANALYTICS_CHARTS_01,
  COLORS_V2_ANALYTICS_CHARTS_02,
  COLORS_V2_ANALYTICS_CHARTS_03,
  COLORS_V2_ANALYTICS_CHARTS_04,
  COLORS_V2_ANALYTICS_CHARTS_05,
  COLORS_V2_ANALYTICS_CHARTS_06,
  COLORS_V2_ANALYTICS_CHARTS_07,
  COLORS_V2_ANALYTICS_CHARTS_08,
  COLORS_V2_ANALYTICS_CHARTS_10,
  COLORS_V2_ANALYTICS_CHARTS_11,
  COLORS_V2_ANALYTICS_CHARTS_12,
  COLORS_V2_ANALYTICS_CHARTS_13,
  COLORS_V2_ANALYTICS_CHARTS_15,
  COLORS_V2_ANALYTICS_CHARTS_16,
  COLORS_V2_ANALYTICS_CHARTS_19,
  COLORS_V2_ANALYTICS_CHARTS_20,
  COLORS_V2_ANALYTICS_CHARTS_23,
  COLORS_V2_ANALYTICS_CHARTS_25,
  COLORS_V2_ANALYTICS_CHARTS_28,
  COLORS_V2_ANALYTICS_CHARTS_29,
} from '@/components/ui/colors';
import ScopeSelector from '@/pages/dashboard/analysis/components/CaseManagement/CaseClosingReasonCard/ScopeSelector';
import { DashboardStatsClosingReasonDistributionStatsClosingReasonsData } from '@/apis';
import { WidgetProps } from '@/components/library/Widget/types';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import Widget from '@/components/library/Widget';
import { CLOSING_REASON_DISTRIBUTION } from '@/utils/queries/keys';
import TreemapChart, { TreemapData } from '@/components/charts/TreemapChart';
import WidgetRangePicker, {
  Value as WidgetRangePickerValue,
} from '@/pages/dashboard/analysis/components/widgets/WidgetRangePicker';
import { dayjs } from '@/utils/dayjs';
import { map, getOr } from '@/utils/asyncResource';

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
  | 'User Terminated'
  | 'Fraud'
  | 'Anti-money laundering'
  | 'Terrorist financing'
  | 'Internal referral'
  | 'External referral'
  | 'Confirmed fraud'
  | 'Confirmed genuine'
  | 'Suspected fraud'
  | 'True positive';

const TREEMAP_COLORS: { [key in ClosingReasons]: string } = {
  ['False positive']: COLORS_V2_ANALYTICS_CHARTS_23,
  ['Investigation completed']: COLORS_V2_ANALYTICS_CHARTS_28,
  ['Documents collected']: COLORS_V2_ANALYTICS_CHARTS_29,
  ['Suspicious activity reported (SAR)']: COLORS_V2_ANALYTICS_CHARTS_15,
  ['Documents not collected']: COLORS_V2_ANALYTICS_CHARTS_19,
  ['Transaction Refunded']: COLORS_V2_ANALYTICS_CHARTS_10,
  ['Transaction Rejected']: COLORS_V2_ANALYTICS_CHARTS_20,
  ['User Blacklisted']: COLORS_V2_ANALYTICS_CHARTS_16,
  ['User Terminated']: COLORS_V2_ANALYTICS_CHARTS_01,
  ['Escalated']: COLORS_V2_ANALYTICS_CHARTS_13,
  ['Other']: COLORS_V2_ANALYTICS_CHARTS_11,
  ['Fraud']: COLORS_V2_ANALYTICS_CHARTS_12,
  ['Anti-money laundering']: COLORS_V2_ANALYTICS_CHARTS_07,
  ['Terrorist financing']: COLORS_V2_ANALYTICS_CHARTS_04,
  ['Internal referral']: COLORS_V2_ANALYTICS_CHARTS_25,
  ['External referral']: COLORS_V2_ANALYTICS_CHARTS_02,
  ['Confirmed fraud']: COLORS_V2_ANALYTICS_CHARTS_03,
  ['Confirmed genuine']: COLORS_V2_ANALYTICS_CHARTS_05,
  ['Suspected fraud']: COLORS_V2_ANALYTICS_CHARTS_06,
  ['True positive']: COLORS_V2_ANALYTICS_CHARTS_08,
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
  const pdfRef = useRef() as MutableRefObject<HTMLInputElement>;
  const dataResource = map(
    queryResult.data,
    ({ closingReasonsData }): TreemapData<ClosingReasons> => {
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
              fileName: `distribution-by-${selectedSection.toLowerCase()}-closing-reason-${dayjs().format(
                'YYYY_MM_DD',
              )}`,
              data: exportDataForTreemaps(
                `${selectedSection.toLowerCase()}ClosingReason`,
                getOr(dataResource, []),
              ),
              pdfRef: pdfRef,
              tableTitle: `Distribution by ${selectedSection.toLowerCase()} closing reason`,
            };
            resolve(fileData);
          });
        }}
        resizing="AUTO"
        extraControls={[
          <WidgetRangePicker value={dateRange} onChange={setDateRange} key="widget-range-picker" />,
        ]}
        {...props}
      >
        <div className={s.root}>
          <ScopeSelector
            selectedSection={selectedSection}
            setSelectedSection={setSelectedSection}
          />
          <TreemapChart<ClosingReasons> height={350} data={dataResource} colors={TREEMAP_COLORS} />
        </div>
      </Widget>
    </div>
  );
};
export default CaseClosingReasonCard;
