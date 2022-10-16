import React, { useCallback, useEffect, useState } from 'react';
import { message } from 'antd';
import moment from 'moment';
import { useNavigate } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { TableSearchParams } from './types';
import {
  Case,
  CasesListResponse,
  CaseTransaction,
  CaseType,
  CaseUpdateRequest,
  RuleAction,
} from '@/apis';
import { useApi } from '@/api';
import { useAnalytics } from '@/utils/segment/context';
import { measure } from '@/utils/time-utils';
import { makeUrl, parseQueryString } from '@/utils/routing';
import { useDeepEqualEffect, usePrevious } from '@/utils/hooks';
import { queryAdapter } from '@/pages/case-management/helpers';
import { useQuery } from '@/utils/queries/hooks';
import { AllParams, DEFAULT_PARAMS_STATE } from '@/components/ui/Table';
import { DEFAULT_PAGE_SIZE } from '@/components/ui/Table/consts';
import { CASES_LIST } from '@/utils/queries/keys';
import UserCases from '@/pages/case-management/UserCases';
import { neverReturn } from '@/utils/lang';
import TransactionCases from '@/pages/case-management/TransactionCases';

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

  const queryResults = useQuery<CasesListResponse>(
    CASES_LIST(caseType, { ...params }),
    async () => {
      const {
        sort,
        page,
        timestamp,
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
      } = params;
      const [sortField, sortOrder] = sort[0] ?? [];
      const [response, time] = await measure(() =>
        api.getCaseList({
          limit: DEFAULT_PAGE_SIZE!,
          skip: (page! - 1) * DEFAULT_PAGE_SIZE!,
          afterTimestamp: timestamp ? moment(timestamp[0]).valueOf() : 0,
          beforeTimestamp: Number.MAX_SAFE_INTEGER,
          filterId: caseId,
          filterRulesHit: rulesHitFilter,
          filterRulesExecuted: rulesExecutedFilter,
          filterOutStatus: caseStatus !== 'CLOSED' ? 'ALLOW' : undefined,
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
          includeTransactionUsers: true,
          includeTransactionEvents: false, // todo: do we still need events?
          filterOriginPaymentMethod: originMethodFilter,
          filterDestinationPaymentMethod: destinationMethodFilter,
          filterTransactionTagKey: tagKey,
          filterTransactionTagValue: tagValue,
          filterCaseType: caseType,
        }),
      );
      analytics.event({
        title: 'Table Loaded',
        time,
      });
      return response;
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
        queryClient.setQueryData<CasesListResponse>(
          cases,
          (prevState): CasesListResponse | undefined => {
            if (prevState == null) {
              return prevState;
            }
            return {
              ...prevState,
              data:
                prevState?.data.map((caseItem): Case => {
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

  if (caseType === 'USER') {
    return (
      <UserCases
        params={params}
        queryResult={queryResults}
        onUpdateCases={(caseIds, updates) => {
          updateCasesMutation.mutate({ caseIds, updates });
        }}
        onChangeParams={handleChangeParams}
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
      />
    );
  }
  return neverReturn(caseType, <></>);
}
