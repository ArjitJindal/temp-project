import Donut from '../charts/Donut';
import {
  COLORS_V2_ANALYTICS_CHARTS_24,
  COLORS_V2_ANALYTICS_CHARTS_25,
  COLORS_V2_ANALYTICS_CHARTS_26,
  COLORS_V2_ANALYTICS_CHARTS_27,
} from '@/components/ui/colors';
import { RuleInstance } from '@/apis';
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
      {...props}
      width="HALF"
      onDownload={(): Promise<{ fileName: string; data: string }> => {
        return new Promise((resolve, _reject) => {
          const fileData = {
            fileName: `rule-priority-split`,
            data: JSON.stringify(ruleInstanceResults),
          };
          resolve(fileData);
        });
      }}
    >
      <AsyncResourceRenderer resource={ruleInstanceResults.data}>
        {(instance: RuleInstance[]) => {
          // Counting the frequency of casePriority values
          const priorityFrequency = instance.reduce((frequencyMap, ruleInstance) => {
            const { casePriority } = ruleInstance;
            if (casePriority in frequencyMap) {
              frequencyMap[casePriority]++;
            } else {
              frequencyMap[casePriority] = 1;
            }
            return frequencyMap;
          }, {});

          // Converting the frequency map into an array of objects
          const priorityData = Object.entries(priorityFrequency).map(([priority, value]) => ({
            colorField: priority,
            angleField: value,
          }));

          const data = priorityData.sort((a, b) => {
            const fa = a.colorField.toLowerCase(),
              fb = b.colorField.toLowerCase();

            if (fa < fb) {
              return -1;
            }
            if (fa > fb) {
              return 1;
            }
            return 0;
          });

          return <Donut data={data} COLORS={gaugeColors} position="right" />;
        }}
      </AsyncResourceRenderer>
    </Widget>
  );
}
