import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { message } from 'antd';
import moment from 'moment';
import { useNavigate } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { TableSearchParams } from './types';
import {
  Case,
  CaseTransaction,
  CaseType,
  CaseUpdateRequest,
  RuleAction,
  RuleInstance,
} from '@/apis';
import { useApi } from '@/api';
import { useAnalytics } from '@/utils/segment/context';
import { measure } from '@/utils/time-utils';
import { makeUrl, parseQueryString } from '@/utils/routing';
import { useDeepEqualEffect, usePrevious } from '@/utils/hooks';
import { queryAdapter } from '@/pages/case-management/helpers';
import { PaginatedData, usePaginatedQuery } from '@/utils/queries/hooks';
import { AllParams, DEFAULT_PARAMS_STATE } from '@/components/ui/Table';
import { DEFAULT_PAGE_SIZE } from '@/components/ui/Table/consts';
import { CASES_LIST } from '@/utils/queries/keys';
import UserCases from '@/pages/case-management/UserCases';
import { neverReturn } from '@/utils/lang';
import TransactionCases from '@/pages/case-management/TransactionCases';
import { useRules } from '@/utils/rules';

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

export default function CaseTableWrapper(props: { caseType: CaseType }) {
  const { caseType } = props;
  const api = useApi();
  const analytics = useAnalytics();
  const navigate = useNavigate();

  const pushParamsToNavigation = useCallback(
    (params: TableSearchParams) => {
      navigate(
        makeUrl(
          '/case-management/:list',
          {
            list: caseType === 'USER' ? 'user' : 'transaction',
          },
          queryAdapter.serializer(params),
        ),
        {
          replace: true,
        },
      );
    },
    [caseType, navigate],
  );

  const parsedParams = queryAdapter.deserializer(parseQueryString(location.search));

  const [params, setParams] = useState<AllParams<TableSearchParams>>({
    ...DEFAULT_PARAMS_STATE,
    ...parsedParams,
  });

  const handleChangeParams = (params: AllParams<TableSearchParams>) => {
    pushParamsToNavigation({
      ...params,
      page: params.page,
      sort: params.sort,
    });
  };

  useDeepEqualEffect(() => {
    setParams((prevState: AllParams<TableSearchParams>) => ({
      ...prevState,
      ...parsedParams,
      page: parsedParams.page ?? 1,
      sort: parsedParams.sort ?? [],
    }));
  }, [parsedParams]);

  const queryResults = usePaginatedQuery<Case>(
    CASES_LIST(caseType, { ...params }),
    async ({ page: _page }) => {
      const {
        sort,
        page,
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
      } = params;

      const [sortField, sortOrder] = sort[0] ?? [];
      const [response, time] = await measure(() =>
        api.getCaseList({
          limit: DEFAULT_PAGE_SIZE!,
          skip: ((_page ?? page)! - 1) * DEFAULT_PAGE_SIZE!,
          afterTimestamp: createdTimestamp ? moment(createdTimestamp[0]).valueOf() : 0,
          beforeTimestamp: createdTimestamp
            ? moment(createdTimestamp[1]).valueOf()
            : Number.MAX_SAFE_INTEGER,
          ...(transactionTimestamp &&
            transactionTimestamp.length && {
              afterTransactionTimestamp: transactionTimestamp
                ? moment(transactionTimestamp[0]).valueOf()
                : 0,
              beforeTransactionTimestamp: transactionTimestamp
                ? moment(transactionTimestamp[1]).valueOf()
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
          includeTransactions: caseType === 'TRANSACTION',
          includeTransactionUsers: caseType === 'TRANSACTION',
          filterOriginPaymentMethod: originMethodFilter,
          filterDestinationPaymentMethod: destinationMethodFilter,
          filterTransactionTagKey: tagKey,
          filterTransactionTagValue: tagValue,
          filterCaseType: caseType,
          filterTransactionId: transactionId,
          filterOriginCountry: originCountryFilter,
          filterDestinationCountry: destinationCountryFilter,
          filterTransactionAmoutAbove: amountGreaterThanFilter,
          filterTransactionAmoutBelow: amountLessThanFilter,
        }),
      );
      analytics.event({
        title: 'Table Loaded',
        time,
      });
      return {
        total: response.total,
        items: response.data,
      };
    },
  );

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
        const cases = CASES_LIST(caseType, { ...params });
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
        queryClient.setQueryData(CASES_LIST(caseType, { ...params }), context?.previousState);
      },
    },
  );

  const [close, setClose] = useState(() => () => {});
  const prevIsLoading = usePrevious(updateCasesMutation.isLoading);
  useEffect(() => {
    if (prevIsLoading !== updateCasesMutation.isLoading && prevIsLoading === true) {
      if (updateCasesMutation.isLoading) {
        close();
        const hideMessage = message.loading(`Saving...`, 0);
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

  if (caseType === 'USER') {
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
  if (caseType === 'TRANSACTION') {
    return (
      <TransactionCases
        params={params}
        queryResult={queryResults}
        onChangeParams={handleChangeParams}
        onUpdateCases={(caseIds, updates) => {
          updateCasesMutation.mutate({ caseIds, updates });
        }}
        rules={getRulesAndInstances}
      />
    );
  }
  return neverReturn(caseType, <></>);
}
