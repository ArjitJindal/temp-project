import { useMemo } from 'react';
import style from '../style.module.less';
import { Value as WidgetRangePickerValue } from '../components/widgets/WidgetRangePicker';
import { useQuery } from '@/utils/queries/hooks';
import { RULE_INSTANCES } from '@/utils/queries/keys';
import { AsyncResource, map } from '@/utils/asyncResource';
import { useApi } from '@/api';
import { RuleInstance } from '@/apis';

export function header(input: string): React.ReactNode {
  return (
    <div>
      <span className={style.header}>{input}</span>
    </div>
  );
}

export function smallHeader(input: string): React.ReactNode {
  return (
    <div>
      <span className={style.smallheader}>{input}</span>
    </div>
  );
}

export function useFilteredRuleInstances(
  dateRange: WidgetRangePickerValue | undefined,
): AsyncResource<RuleInstance[]> {
  const api = useApi();
  const ruleInstanceResults = useQuery(RULE_INSTANCES(), async () => {
    return await api.getRuleInstances({});
  });
  const filteredResult = useMemo(() => {
    return map(ruleInstanceResults.data, (value) => {
      return value.filter((x) => {
        if (
          dateRange == null ||
          (dateRange?.startTimestamp == null && dateRange?.endTimestamp == null)
        ) {
          return true;
        }
        if (x.createdAt == null) {
          return false;
        }
        if (dateRange.startTimestamp != null && x.createdAt < dateRange?.startTimestamp) {
          return false;
        }
        if (dateRange.endTimestamp != null && x.createdAt > dateRange?.endTimestamp) {
          return false;
        }
        return true;
      });
    });
  }, [ruleInstanceResults.data, dateRange]);
  return filteredResult;
}
