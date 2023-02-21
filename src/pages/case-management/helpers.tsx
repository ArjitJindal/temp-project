import { dayjs } from '@/utils/dayjs';
import '../../components/ui/colors';

import { Adapter } from '@/utils/routing';
import { isRuleAction, isTransactionState } from '@/utils/rules';
import { TableSearchParams } from '@/pages/case-management/types';
import { isMode } from '@/pages/transactions/components/UserSearchPopup/types';
import { defaultQueryAdapter } from '@/components/ui/Table/helpers/queryAdapter';

export const queryAdapter: Adapter<TableSearchParams> = {
  serializer: (params) => {
    return {
      ...defaultQueryAdapter.serializer(params),
      timestamp: params.timestamp?.map((x) => dayjs(x).valueOf()).join(','),
      createdTimestamp: params.createdTimestamp?.map((x) => dayjs(x).valueOf()).join(','),
      transactionTimestamp: params.transactionTimestamp?.map((x) => dayjs(x).valueOf()).join(','),
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
      tagKey: params.tagKey ?? undefined,
      tagValue: params.tagValue ?? undefined,
      caseStatus: params.caseStatus,
      transactionId: params.transactionId,
      amountGreaterThanFilter: params.amountGreaterThanFilter,
      amountLessThanFilter: params.amountLessThanFilter,
      originCountryFilter: params.originCountryFilter,
      destinationCountryFilter: params.destinationCountryFilter,
      filterTypes: params.filterTypes?.join(','),
      businessIndustryFilter: params.businessIndustryFilter?.join(','),
      kycStatuses: params.kycStatuses?.join(','),
      userStates: params.userStates?.join(','),
      riskLevels: params.riskLevels?.join(','),
      showCases: params.showCases,
    };
  },
  deserializer: (raw): TableSearchParams => {
    return {
      ...defaultQueryAdapter.deserializer(raw),
      timestamp: raw.timestamp
        ? raw.timestamp.split(',').map((x) => dayjs(parseInt(x)).format())
        : undefined,
      createdTimestamp: raw.createdTimestamp
        ? raw.createdTimestamp.split(',').map((x) => dayjs(parseInt(x)).format())
        : undefined,
      transactionTimestamp: raw.transactionTimestamp
        ? raw.transactionTimestamp.split(',').map((x) => dayjs(parseInt(x)).format())
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
      tagKey: raw.tagKey ?? undefined,
      tagValue: raw.tagValue ?? undefined,
      caseStatus:
        raw.caseStatus === 'CLOSED' ? 'CLOSED' : raw.caseStatus === 'OPEN' ? 'OPEN' : undefined,
      transactionId: raw.transactionId,
      amountGreaterThanFilter: raw.amountGreaterThanFilter
        ? parseInt(raw.amountGreaterThanFilter)
        : undefined,
      amountLessThanFilter: raw.amountLessThanFilter
        ? parseInt(raw.amountLessThanFilter)
        : undefined,
      originCountryFilter: raw.originCountryFilter,
      destinationCountryFilter: raw.destinationCountryFilter,
      filterTypes: raw.filterTypes?.split(',') as unknown as TableSearchParams['filterTypes'],
      businessIndustryFilter: raw.businessIndustryFilter?.split(','),
      kycStatuses: raw.kycStatuses?.split(',') as unknown as TableSearchParams['kycStatuses'],
      userStates: raw.userStates?.split(',') as unknown as TableSearchParams['userStates'],
      riskLevels: raw.riskLevels?.split(',') as unknown as TableSearchParams['riskLevels'],
      showCases: raw.showCases === 'MY' ? 'MY' : 'ALL',
    };
  },
};
