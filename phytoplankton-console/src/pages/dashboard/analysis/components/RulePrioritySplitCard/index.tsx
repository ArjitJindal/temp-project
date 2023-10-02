import Donut, { DonutData } from '../charts/Donut';
import {
  COLORS_V2_ANALYTICS_CHARTS_24,
  COLORS_V2_ANALYTICS_CHARTS_25,
  COLORS_V2_ANALYTICS_CHARTS_26,
  COLORS_V2_ANALYTICS_CHARTS_27,
} from '@/components/ui/colors';
import { Priority, RuleInstance } from '@/apis';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { RULE_INSTANCES } from '@/utils/queries/keys';
import { WidgetProps } from '@/components/library/Widget/types';
import Widget from '@/components/library/Widget';

const gaugeColors = {
  ['P1']: COLORS_V2_ANALYTICS_CHARTS_24,
  ['P2']: COLORS_V2_ANALYTICS_CHARTS_25,
  ['P3']: COLORS_V2_ANALYTICS_CHARTS_26,
  ['P4']: COLORS_V2_ANALYTICS_CHARTS_27,
};

interface Props extends WidgetProps {}

export default function RulePrioritySplitCard(props: Props) {
  const api = useApi();
  const ruleInstanceResults = useQuery(RULE_INSTANCES(), async () => {
    return await api.getRuleInstances({});
  });

  return (
    <Widget
      onDownload={(): Promise<{ fileName: string; data: string }> => {
        return new Promise((resolve, _reject) => {
          const fileData = {
            fileName: `rule-priority-split`,
            data: JSON.stringify(ruleInstanceResults),
          };
          resolve(fileData);
        });
      }}
      resizing="FIXED"
      {...props}
    >
      <AsyncResourceRenderer resource={ruleInstanceResults.data}>
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
