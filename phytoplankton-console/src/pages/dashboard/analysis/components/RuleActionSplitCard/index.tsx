import React, { MutableRefObject, useRef, useState } from 'react';
import Donut, { DonutData } from '../charts/Donut';
import { exportDataForDonuts } from '@/pages/dashboard/analysis/utils/export-data-build-util';
import {
  COLORS_V2_ANALYTICS_CHARTS_01,
  COLORS_V2_ANALYTICS_CHARTS_02,
  COLORS_V2_ANALYTICS_CHARTS_07,
  COLORS_V2_ANALYTICS_CHARTS_12,
} from '@/components/ui/colors';
import { RuleAction, RuleInstance } from '@/apis';
import { WidgetProps } from '@/components/library/Widget/types';
import Widget from '@/components/library/Widget';
import {
  getRuleActionLabel,
  useSettings,
} from '@/components/AppWrapper/Providers/SettingsProvider';
import WidgetRangePicker, {
  Value as WidgetRangePickerValue,
} from '@/pages/dashboard/analysis/components/widgets/WidgetRangePicker';
import { useFilteredRuleInstances } from '@/pages/dashboard/analysis/components/dashboardutils';
import { dayjs } from '@/utils/dayjs';
import { map, getOr } from '@/utils/asyncResource';

const COLORS = {
  BLOCK: COLORS_V2_ANALYTICS_CHARTS_12,
  SUSPEND: COLORS_V2_ANALYTICS_CHARTS_02,
  FLAG: COLORS_V2_ANALYTICS_CHARTS_01,
  ALLOW: COLORS_V2_ANALYTICS_CHARTS_07,
};

const RULE_ACTION_ORDER = ['ALLOW', 'BLOCK', 'SUSPEND', 'FLAG'];

interface Props extends WidgetProps {}

export default function RuleActionSplitCard(props: Props) {
  const [dateRange, setDateRange] = useState<WidgetRangePickerValue>();
  const filteredDataRes = useFilteredRuleInstances(dateRange);

  const settings = useSettings();
  const pdfRef = useRef() as MutableRefObject<HTMLInputElement>;
  const dataResource = map(filteredDataRes, (instances: RuleInstance[]) => {
    const frequencyMap: { [key in RuleAction]?: number } = {};
    for (const instance of instances) {
      const { action } = instance;
      if (action !== undefined) {
        frequencyMap[action] = (frequencyMap[action] ?? 0) + 1;
      }
    }

    // Converting the frequency map into an array of objects
    const data: DonutData<RuleAction> = Object.entries(frequencyMap).map(([action, value]) => ({
      series: action as RuleAction,
      value: value as number,
    }));

    data.sort((a, b) => {
      return RULE_ACTION_ORDER.indexOf(a.series) - RULE_ACTION_ORDER.indexOf(b.series);
    });
    return data;
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
              fileName: `distribution-by-rule-action-${dayjs().format('YYYY_MM_DD')}`,
              data: exportDataForDonuts('ruleAction', getOr(dataResource, [])),
              pdfRef,
              tableTitle: `Distribution by rule action`,
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
        <Donut<RuleAction>
          data={dataResource}
          colors={COLORS}
          legendPosition="RIGHT"
          formatSeries={(action) => getRuleActionLabel(action, settings) ?? action}
        />
      </Widget>
    </div>
  );
}
