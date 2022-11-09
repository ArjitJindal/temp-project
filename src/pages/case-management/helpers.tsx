import moment from 'moment';
import '../../components/ui/colors';

import { Adapter } from '@/utils/routing';
import { isRuleAction, isTransactionState } from '@/utils/rules';
import { TableSearchParams } from '@/pages/case-management/types';
import { isMode } from '@/pages/transactions/components/UserSearchPopup/types';

export const queryAdapter: Adapter<TableSearchParams> = {
  serializer: (params) => {
    return {
      page: params.page ?? 1,
      timestamp: params.timestamp?.map((x) => moment(x).valueOf()).join(','),
      caseId: params.caseId,
      rulesHitFilter: params.rulesHitFilter?.join(','),
      rulesExecutedFilter: params.rulesExecutedFilter?.join(','),
      originCurrenciesFilter: params.originCurrenciesFilter?.join(','),
      destinationCurrenciesFilter: params.destinationCurrenciesFilter?.join(','),
      userId: params.userId,
      userFilterMode: params.userFilterMode,
      type: params.type,
      status: params.status?.join(','),
      originMethodFilter: params.originMethodFilter,
      destinationMethodFilter: params.destinationMethodFilter,
      transactionState: params.transactionState?.join(','),
      sort: (params.sort ?? [])
        .map(([key, order]) => {
          if (order === 'descend') {
            return `-${key}`;
          }
          if (order === 'ascend') {
            return `${key}`;
          }
          return key;
        })
        .join(','),
      tagKey: params.tagKey ?? undefined,
      tagValue: params.tagValue ?? undefined,
      caseStatus: params.caseStatus,
      transactionId: params.transactionId,
    };
  },
  deserializer: (raw): TableSearchParams => {
    return {
      page: parseInt(raw.page ?? '') || 1,
      timestamp: raw.timestamp
        ? raw.timestamp.split(',').map((x) => moment(parseInt(x)).format())
        : undefined,
      caseId: raw.caseId,
      rulesHitFilter: raw.rulesHitFilter?.split(','),
      rulesExecutedFilter: raw.rulesExecutedFilter?.split(','),
      originCurrenciesFilter: raw.originCurrenciesFilter?.split(','),
      destinationCurrenciesFilter: raw.destinationCurrenciesFilter?.split(','),
      userId: raw.userId,
      userFilterMode: isMode(raw.userFilterMode) ? raw.userFilterMode : undefined,
      type: raw.type,
      status: raw.status ? raw.status.split(',').filter(isRuleAction) : undefined,
      originMethodFilter: raw.originMethodFilter,
      destinationMethodFilter: raw.destinationMethodFilter,
      transactionState:
        raw.transactionState != null
          ? raw.transactionState.split(',').filter(isTransactionState)
          : undefined,
      sort:
        raw.sort?.split(',').map((key) => {
          if (key.startsWith('-')) {
            return [key.substring(1), 'descend'];
          } else if (key.startsWith('+')) {
            return [key.substring(1), 'ascend'];
          }
          return [key, 'ascend'];
        }) ?? [],
      tagKey: raw.tagKey ?? undefined,
      tagValue: raw.tagValue ?? undefined,
      caseStatus: raw.caseStatus === 'CLOSED' ? 'CLOSED' : 'OPEN',
      transactionId: raw.transactionId,
    };
  },
};
