import { useMemo } from 'react';
import style from '../style.module.less';
import { Value as WidgetRangePickerValue } from '../components/widgets/WidgetRangePicker';
import { useQuery } from '@/utils/queries/hooks';
import { RULE_INSTANCES, USERS } from '@/utils/queries/keys';
import { AsyncResource, map } from '@/utils/asyncResource';
import { useApi } from '@/api';
import { BusinessUsersListResponse, ConsumerUsersListResponse, RuleInstance } from '@/apis';

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
  const ruleInstanceResults = useQuery(RULE_INSTANCES('ALL'), async () => {
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

export function useUsersQuery(
  userType: 'BUSINESS' | 'CONSUMER',
  dateRange?: WidgetRangePickerValue,
): {
  data: AsyncResource<ConsumerUsersListResponse | BusinessUsersListResponse>;
  refetch: () => void;
} {
  const api = useApi();
  let start = dateRange?.startTimestamp;
  let end = dateRange?.endTimestamp;

  const userStatusResults = useQuery(USERS(userType, { start, end }), async () => {
    if (start === undefined) {
      start = 0;
    }
    if (end === undefined) {
      end = Date.now();
    }
    if (userType === 'CONSUMER') {
      return await api.getConsumerUsersList({ afterTimestamp: start, beforeTimestamp: end });
    } else {
      return await api.getBusinessUsersList({ afterTimestamp: start, beforeTimestamp: end });
    }
  });
  const refetchQuery = () => {
    userStatusResults.refetch();
  };

  const filteredResult = useMemo(() => {
    return map(userStatusResults.data, (value) => {
      return value;
    });
  }, [userStatusResults.data]);
  return { data: filteredResult, refetch: refetchQuery };
}
