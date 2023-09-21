import Donut from '../charts/Donut';
import {
  COLORS_V2_ANALYTICS_CHARTS_01,
  COLORS_V2_ANALYTICS_CHARTS_02,
  COLORS_V2_ANALYTICS_CHARTS_12,
} from '@/components/ui/colors';
import { RuleInstance } from '@/apis';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { RULE_INSTANCES } from '@/utils/queries/keys';
import { WidgetProps } from '@/components/library/Widget/types';
import Widget from '@/components/library/Widget';
import { capitalizeWords } from '@/utils/tags';
import { arrayToCSV } from '@/utils/ruleInstanceArrayToCsv';

const gaugeColors = {
  Block: COLORS_V2_ANALYTICS_CHARTS_12,
  Suspend: COLORS_V2_ANALYTICS_CHARTS_02,
  Flag: COLORS_V2_ANALYTICS_CHARTS_01,
};

interface Props extends WidgetProps {}

export default function RuleActionSplitCard(props: Props) {
  const api = useApi();
  const ruleInstanceResults = useQuery(RULE_INSTANCES(), async () => {
    return await api.getRuleInstances({});
  });

  return (
    <Widget
      {...props}
      width="HALF"
      onDownload={(): Promise<{ fileName: string; data: string }> => {
        const randomID = (Math.floor(Math.random() * 90000) + 10000).toString();
        return new Promise((resolve, _reject) => {
          const fileData = {
            fileName: `rule-action-split-${randomID}.csv`,
            data:
              ruleInstanceResults.data.kind === 'SUCCESS'
                ? arrayToCSV(ruleInstanceResults.data.value)
                : '',
          };
          resolve(fileData);
        });
      }}
    >
      <AsyncResourceRenderer resource={ruleInstanceResults.data}>
        {(instance: RuleInstance[]) => {
          // Counting the frequency of casePriority values
          const actionFrequency = instance.reduce((frequencyMap, ruleInstance) => {
            const { action } = ruleInstance;
            if (action !== undefined) {
              const capitalAction = capitalizeWords(action);
              if (capitalAction in frequencyMap) {
                frequencyMap[capitalAction]++;
              } else {
                frequencyMap[capitalAction] = 1;
              }
            }
            return frequencyMap;
          }, {});

          // Converting the frequency map into an array of objects
          const actionData = Object.entries(actionFrequency).map(([action, value]) => ({
            colorField: action,
            angleField: value,
          }));

          const data = actionData.sort((a, b) => {
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
