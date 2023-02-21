import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { TableSearchParams } from './types';
import { message } from '@/components/library/Message';
import { dayjs } from '@/utils/dayjs';
import { Case, CaseTransaction, CaseUpdateRequest, RuleAction, RuleInstance } from '@/apis';
import { useApi } from '@/api';
import { makeUrl, parseQueryString } from '@/utils/routing';
import { useDeepEqualEffect, usePrevious } from '@/utils/hooks';
import { queryAdapter } from '@/pages/case-management/helpers';
import { PaginatedData, usePaginatedQuery } from '@/utils/queries/hooks';
import { AllParams, DEFAULT_PARAMS_STATE } from '@/components/ui/Table';
import { CASES_LIST } from '@/utils/queries/keys';
import UserCases from '@/pages/case-management/UserCases';
import { useRules } from '@/utils/rules';
import { DEFAULT_PAGE_SIZE } from '@/components/ui/Table/consts';
import { useApiTime } from '@/utils/tracker';
import { useAuth0User } from '@/utils/user-utils';

export type CaseManagementItem = Case & {
  index: number;
  rowKey: string;
  ruleName?: string | null;
  ruleDescription?: string | null;
  ruleAction?: RuleAction | null;
  transaction: CaseTransaction | null;
  transactionFirstRow: boolean;
  transactionsRowsCount: number;
};

export default function CaseTableWrapper() {
  const api = useApi();
  const navigate = useNavigate();
  const auth0user = useAuth0User();

  const pushParamsToNavigation = useCallback(
    (params: TableSearchParams) => {
      navigate(makeUrl('/case-management/cases', {}, queryAdapter.serializer(params)), {
        replace: true,
      });
    },
    [navigate],
  );

  const parsedParams = queryAdapter.deserializer(parseQueryString(location.search));
  const measure = useApiTime();
  const [params, setParams] = useState<AllParams<TableSearchParams>>({
    ...DEFAULT_PARAMS_STATE,
    ...parsedParams,
  });

  const handleChangeParams = (newParams: AllParams<TableSearchParams>) => {
    pushParamsToNavigation(newParams);
  };

  useDeepEqualEffect(() => {
    setParams((prevState: AllParams<TableSearchParams>) => ({
      ...prevState,
      ...parsedParams,
      page: parsedParams.page ?? 1,
      sort: parsedParams.sort ?? [],
      pageSize: parsedParams.pageSize ?? DEFAULT_PAGE_SIZE,
    }));
  }, [parsedParams]);

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
      transactionState,
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
      kycStatuses,
      riskLevels,
      userStates,
      showCases,
    } = params;

    const [sortField, sortOrder] = sort[0] ?? [];

    const response = await measure(
      () =>
        api.getCaseList({
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
          filterOutCaseStatus: caseStatus === 'CLOSED' ? undefined : 'CLOSED',
          filterCaseStatus: caseStatus === 'CLOSED' ? 'CLOSED' : undefined,
          filterTransactionState: transactionState,
          filterStatus: status,
          filterOriginCurrencies: originCurrenciesFilter,
          filterDestinationCurrencies: destinationCurrenciesFilter,
          filterUserId: userFilterMode === 'ALL' ? userId : undefined,
          filterOriginUserId: userFilterMode === 'ORIGIN' ? userId : undefined,
          filterDestinationUserId: userFilterMode === 'DESTINATION' ? userId : undefined,
          transactionType: type,
          sortField: sortField ?? undefined,
          sortOrder: sortOrder ?? undefined,
          filterOriginPaymentMethod: originMethodFilter,
          filterDestinationPaymentMethod: destinationMethodFilter,
          filterTransactionTagKey: tagKey,
          filterTransactionTagValue: tagValue,
          filterTransactionId: transactionId,
          filterOriginCountry: originCountryFilter,
          filterDestinationCountry: destinationCountryFilter,
          filterTransactionAmoutAbove: amountGreaterThanFilter,
          filterTransactionAmoutBelow: amountLessThanFilter,
          filterBusinessIndustries: businessIndustryFilter,
          filterUserKYCStatus: kycStatuses,
          filterRiskLevel: riskLevels,
          filterUserState: userStates,
          filterAssignmentsIds: showCases === 'MY' ? [auth0user.userId] : undefined,
        }),
      'Get Cases List',
    );

    return {
      total: response.total,
      items: response.data,
    };
  });

  const queryClient = useQueryClient();

  const updateCasesMutation = useMutation<
    unknown,
    unknown,
    { caseIds: string[]; updates: CaseUpdateRequest },
    { previousState: CaseUpdateRequest | undefined }
  >(
    async (event) => {
      const { caseIds, updates } = event;
      await api.postCases({
        CasesUpdateRequest: {
          caseIds,
          updates,
        },
      });
    },
    {
      onMutate: async (event) => {
        const { caseIds, updates } = event;
        const cases = CASES_LIST({ ...params });
        const previousState = queryClient.getQueryData<CaseUpdateRequest>(cases);
        queryClient.setQueryData<PaginatedData<Case>>(
          cases,
          (prevState): PaginatedData<Case> | undefined => {
            if (prevState == null) {
              return prevState;
            }
            return {
              ...prevState,
              items:
                prevState?.items.map((caseItem): Case => {
                  if (caseItem.caseId == null || caseIds.indexOf(caseItem.caseId) === -1) {
                    return caseItem;
                  }
                  return {
                    ...caseItem,
                    ...updates,
                  };
                }) ?? [],
            };
          },
        );
        return { previousState };
      },
      onError: (err, event, context) => {
        queryClient.setQueryData(CASES_LIST({ ...params }), context?.previousState);
      },
    },
  );

  const [close, setClose] = useState(() => () => {});
  const prevIsLoading = usePrevious(updateCasesMutation.isLoading);
  useEffect(() => {
    if (prevIsLoading !== updateCasesMutation.isLoading && prevIsLoading === true) {
      if (updateCasesMutation.isLoading) {
        close();
        const hideMessage = message.loading(`Saving...`);
        setClose(() => hideMessage);
      } else {
        close();
        if (updateCasesMutation.isError) {
          console.error(updateCasesMutation.error);
          message.error('Unable to save!');
        } else {
          message.success('Saved');
        }
      }
    }
  }, [
    close,
    prevIsLoading,
    updateCasesMutation.isLoading,
    updateCasesMutation.isError,
    updateCasesMutation.error,
  ]);

  const rules = useRules();

  const getRulesAndInstances = useMemo(() => {
    return Object.values(rules.ruleInstances).map((rulesInstance: RuleInstance) => {
      const ruleName = rulesInstance.ruleNameAlias || rules.rules[rulesInstance.ruleId]?.name;
      return {
        value: rulesInstance.id,
        label: `${ruleName} ${rulesInstance.ruleId} (${rulesInstance.id})`,
      };
    });
  }, [rules.ruleInstances, rules.rules]);

  return (
    <UserCases
      params={params}
      queryResult={queryResults}
      onUpdateCases={(caseIds, updates) => {
        updateCasesMutation.mutate({ caseIds, updates });
      }}
      onChangeParams={handleChangeParams}
      rules={getRulesAndInstances}
    />
  );
}
