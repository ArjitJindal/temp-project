import React, { useMemo } from 'react';
import { TableSearchParams } from './types';
import CaseTable from './CaseTable';
import { dayjs } from '@/utils/dayjs';
import { Case, RuleInstance } from '@/apis';
import { useApi } from '@/api';
import { usePaginatedQuery } from '@/utils/queries/hooks';
import { AllParams } from '@/components/library/Table/types';
import { CASES_LIST } from '@/utils/queries/keys';
import { useRules } from '@/utils/rules';
import { useAuth0User } from '@/utils/user-utils';
import { getStatuses } from '@/utils/case-utils';

export default function CaseTableWrapper(props: {
  params: TableSearchParams;
  onChangeParams: (newState: AllParams<TableSearchParams>) => void;
}) {
  const { params, onChangeParams } = props;
  const api = useApi();
  const auth0user = useAuth0User();
  const queryResults = usePaginatedQuery<Case>(CASES_LIST(params), async (paginationParams) => {
    const {
      sort,
      page,
      pageSize,
      createdTimestamp,
      caseId,
      rulesHitFilter,
      rulesExecutedFilter,
      originCurrenciesFilter,
      destinationCurrenciesFilter,
      userId,
      userFilterMode,
      type,
      status,
      originMethodFilter,
      destinationMethodFilter,
      tagKey,
      tagValue,
      caseStatus,
      transactionId,
      transactionTimestamp,
      amountGreaterThanFilter,
      amountLessThanFilter,
      originCountryFilter,
      destinationCountryFilter,
      businessIndustryFilter,
      riskLevels,
      userStates,
      showCases,
      assignedTo,
      updatedAt,
      caseTypesFilter,
      ruleQueueIds,
      alertPriority,
    } = params;

    const [sortField, sortOrder] = sort[0] ?? [];

    const response = await api.getCaseList({
      page,
      pageSize,
      ...paginationParams,
      afterTimestamp: createdTimestamp ? dayjs(createdTimestamp[0]).valueOf() : 0,
      beforeTimestamp: createdTimestamp
        ? dayjs(createdTimestamp[1]).valueOf()
        : Number.MAX_SAFE_INTEGER,
      ...(transactionTimestamp &&
        transactionTimestamp.length && {
          afterTransactionTimestamp: transactionTimestamp
            ? dayjs(transactionTimestamp[0]).valueOf()
            : 0,
          beforeTransactionTimestamp: transactionTimestamp
            ? dayjs(transactionTimestamp[1]).valueOf()
            : Number.MAX_SAFE_INTEGER,
        }),
      filterId: caseId,
      filterRulesHit: rulesHitFilter,
      filterRulesExecuted: rulesExecutedFilter,
      filterCaseStatus: getStatuses(caseStatus),
      filterStatus: status,
      filterOriginCurrencies: originCurrenciesFilter,
      filterDestinationCurrencies: destinationCurrenciesFilter,
      filterUserId: userFilterMode === 'ALL' ? userId : undefined,
      filterOriginUserId: userFilterMode === 'ORIGIN' ? userId : undefined,
      filterDestinationUserId: userFilterMode === 'DESTINATION' ? userId : undefined,
      transactionType: type,
      sortField: sortField ?? undefined,
      sortOrder: sortOrder ?? undefined,
      filterOriginPaymentMethods: originMethodFilter,
      filterDestinationPaymentMethods: destinationMethodFilter,
      filterTransactionTagKey: tagKey,
      filterTransactionTagValue: tagValue,
      filterTransactionId: transactionId,
      filterOriginCountry: originCountryFilter,
      filterDestinationCountry: destinationCountryFilter,
      filterTransactionAmoutAbove: amountGreaterThanFilter,
      filterTransactionAmoutBelow: amountLessThanFilter,
      filterBusinessIndustries: businessIndustryFilter,
      filterRiskLevel: riskLevels,
      filterCaseTypes: caseTypesFilter,
      filterUserState: userStates,
      filterRuleQueueIds: ruleQueueIds,
      filterAssignmentsIds:
        showCases === 'MY' ? [auth0user.userId] : assignedTo?.length ? assignedTo : undefined,
      ...(updatedAt && {
        filterCasesByLastUpdatedStartTimestamp: updatedAt ? dayjs(updatedAt[0]).valueOf() : 0,
        filterCasesByLastUpdatedEndTimestamp: updatedAt
          ? dayjs(updatedAt[1]).valueOf()
          : Number.MAX_SAFE_INTEGER,
      }),
      filterAlertPriority: alertPriority,
    });

    return {
      total: response.total,
      items: response.data,
    };
  });

  const rules = useRules();

  const getRulesAndInstances = useMemo(() => {
    return Object.values(rules.ruleInstances).map((rulesInstance: RuleInstance) => {
      const ruleName = rulesInstance.ruleNameAlias || rules.rules[rulesInstance.ruleId]?.name;
      return {
        value: rulesInstance.id ?? '',
        label: `${ruleName} ${rulesInstance.ruleId} (${rulesInstance.id})`,
      };
    });
  }, [rules.ruleInstances, rules.rules]);

  return (
    <CaseTable
      params={params}
      onChangeParams={onChangeParams}
      queryResult={queryResults}
      rules={getRulesAndInstances}
      showAssignedToFilter={params.showCases === 'MY' ? false : true}
    />
  );
}
