import React, { MutableRefObject, useRef, useState } from 'react';
import Donut, { DonutData } from '../charts/Donut';
import { exportDataForDonuts } from '@/pages/dashboard/analysis/utils/export-data-build-util';
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
import { useFilteredRuleInstances } from '@/pages/dashboard/analysis/components/dashboardutils';
import { dayjs } from '@/utils/dayjs';

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
  const pdfRef = useRef() as MutableRefObject<HTMLInputElement>;
  return (
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
            value: value,
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
          <div ref={pdfRef}>
            <Widget
              onDownload={(): Promise<{
                fileName: string;
                data: string;
                pdfRef: MutableRefObject<HTMLInputElement>;
              }> => {
                return new Promise((resolve, _reject) => {
                  const fileData = {
                    fileName: `distribution-by-rule-priority-${dayjs().format('YYYY_MM_DD')}`,
                    data: exportDataForDonuts('rulePriority', priorityData),
                    pdfRef,
                  };
                  resolve(fileData);
                });
              }}
              resizing="AUTO"
              extraControls={[<WidgetRangePicker value={dateRange} onChange={setDateRange} />]}
              {...props}
            >
              <Donut<Priority> data={priorityData} colors={gaugeColors} legendPosition="RIGHT" />
            </Widget>
          </div>
        );
      }}
    </AsyncResourceRenderer>
  );
}
