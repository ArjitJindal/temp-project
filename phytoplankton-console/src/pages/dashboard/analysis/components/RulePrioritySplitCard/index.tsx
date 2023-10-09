import React, { useState } from 'react';
import Donut, { DonutData } from '../charts/Donut';
import {
  COLORS_V2_ANALYTICS_CHARTS_24,
  COLORS_V2_ANALYTICS_CHARTS_25,
  COLORS_V2_ANALYTICS_CHARTS_26,
  COLORS_V2_ANALYTICS_CHARTS_27,
} from '@/components/ui/colors';
import { Priority, RuleInstance } from '@/apis';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
import { WidgetProps } from '@/components/library/Widget/types';
import Widget from '@/components/library/Widget';
import WidgetRangePicker, {
  Value as WidgetRangePickerValue,
} from '@/pages/dashboard/analysis/components/widgets/WidgetRangePicker';
import { getOr } from '@/utils/asyncResource';
import { useFilteredRuleInstances } from '@/pages/dashboard/analysis/components/dashboardutils';

const gaugeColors = {
  ['P1']: COLORS_V2_ANALYTICS_CHARTS_24,
  ['P2']: COLORS_V2_ANALYTICS_CHARTS_25,
  ['P3']: COLORS_V2_ANALYTICS_CHARTS_26,
  ['P4']: COLORS_V2_ANALYTICS_CHARTS_27,
};

interface Props extends WidgetProps {}

export default function RulePrioritySplitCard(props: Props) {
  const [dateRange, setDateRange] = useState<WidgetRangePickerValue>();
  const filteredResult = useFilteredRuleInstances(dateRange);

  return (
    <Widget
      onDownload={(): Promise<{ fileName: string; data: string }> => {
        return new Promise((resolve, _reject) => {
          const fileData = {
            fileName: `rule-priority-split`,
            data: JSON.stringify(getOr(filteredResult, [])),
          };
          resolve(fileData);
        });
      }}
      resizing="FIXED"
      extraControls={[<WidgetRangePicker value={dateRange} onChange={setDateRange} />]}
      {...props}
    >
      <AsyncResourceRenderer resource={filteredResult}>
        {(instance: RuleInstance[]) => {
          // Counting the frequency of casePriority values
          const priorityFrequency: {
            [key in Priority]?: number;
          } = instance.reduce((frequencyMap, ruleInstance) => {
            const { casePriority } = ruleInstance;
            return {
              ...frequencyMap,
              [casePriority]: (frequencyMap[casePriority] ?? 0) + 1,
            };
          }, {});

          // Converting the frequency map into an array of objects
          const priorityData: DonutData<Priority> = Object.entries(priorityFrequency).map(
            ([priority, value]) => ({
              series: priority as Priority,
              value: value as number,
            }),
          );

          priorityData.sort((a, b) => {
            const fa = a.series.toLowerCase(),
              fb = b.series.toLowerCase();

            if (fa < fb) {
              return -1;
            }
            if (fa > fb) {
              return 1;
            }
            return 0;
          });

          return (
            <Donut<Priority> data={priorityData} colors={gaugeColors} legendPosition="RIGHT" />
          );
        }}
      </AsyncResourceRenderer>
    </Widget>
  );
}
