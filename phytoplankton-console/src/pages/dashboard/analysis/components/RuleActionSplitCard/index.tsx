import React, { useState } from 'react';
import Donut, { DonutData } from '../charts/Donut';
import {
  COLORS_V2_ANALYTICS_CHARTS_01,
  COLORS_V2_ANALYTICS_CHARTS_02,
  COLORS_V2_ANALYTICS_CHARTS_07,
  COLORS_V2_ANALYTICS_CHARTS_12,
} from '@/components/ui/colors';
import { RuleAction, RuleInstance } from '@/apis';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
import { WidgetProps } from '@/components/library/Widget/types';
import Widget from '@/components/library/Widget';
import { arrayToCSV } from '@/utils/ruleInstanceArrayToCsv';
import {
  getRuleActionLabel,
  useSettings,
} from '@/components/AppWrapper/Providers/SettingsProvider';
import WidgetRangePicker, {
  Value as WidgetRangePickerValue,
} from '@/pages/dashboard/analysis/components/widgets/WidgetRangePicker';
import { useFilteredRuleInstances } from '@/pages/dashboard/analysis/components/dashboardutils';
import { isSuccess } from '@/utils/asyncResource';

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

  return (
    <Widget
      onDownload={(): Promise<{ fileName: string; data: string }> => {
        const randomID = (Math.floor(Math.random() * 90000) + 10000).toString();
        return new Promise((resolve, _reject) => {
          const fileData = {
            fileName: `rule-action-split-${randomID}.csv`,
            data: isSuccess(filteredDataRes) ? arrayToCSV(filteredDataRes.value) : '',
          };
          resolve(fileData);
        });
      }}
      resizing="FIXED"
      extraControls={[<WidgetRangePicker value={dateRange} onChange={setDateRange} />]}
      {...props}
    >
      <AsyncResourceRenderer resource={filteredDataRes}>
        {(instances: RuleInstance[]) => {
          const frequencyMap: { [key in RuleAction]?: number } = {};
          for (const instance of instances) {
            const { action } = instance;
            if (action !== undefined) {
              frequencyMap[action] = (frequencyMap[action] ?? 0) + 1;
            }
          }

          // Converting the frequency map into an array of objects
          const data: DonutData<RuleAction> = Object.entries(frequencyMap).map(
            ([action, value]) => ({
              series: action as RuleAction,
              value: value as number,
            }),
          );

          data.sort((a, b) => {
            return RULE_ACTION_ORDER.indexOf(a.series) - RULE_ACTION_ORDER.indexOf(b.series);
          });

          return (
            <Donut<RuleAction>
              data={data}
              colors={COLORS}
              legendPosition="RIGHT"
              formatSeries={(action) => getRuleActionLabel(action, settings) ?? action}
            />
          );
        }}
      </AsyncResourceRenderer>
    </Widget>
  );
}
