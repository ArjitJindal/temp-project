import { useMemo } from 'react';
import style from '../style.module.less';
import { Value as WidgetRangePickerValue } from '../components/widgets/WidgetRangePicker';
import { AsyncResource, map } from '@/utils/asyncResource';
import { AllUsersOffsetPaginateListResponse, RuleInstance } from '@/apis';
import { useRuleInstances } from '@/hooks/api/rules';
import { useUsersByTimeRange } from '@/hooks/api/users';

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
  const ruleInstanceResults = useRuleInstances();
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

export function useUsersQuery(
  userType: 'BUSINESS' | 'CONSUMER',
  dateRange?: WidgetRangePickerValue,
): {
  data: AsyncResource<AllUsersOffsetPaginateListResponse>;
  refetch: () => void;
} {
  const result = useUsersByTimeRange(
    userType,
    dateRange
      ? { startTimestamp: dateRange.startTimestamp, endTimestamp: dateRange.endTimestamp }
      : undefined,
  );
  return {
    data: result.data as AsyncResource<AllUsersOffsetPaginateListResponse>,
    refetch: result.refetch,
  };
}
