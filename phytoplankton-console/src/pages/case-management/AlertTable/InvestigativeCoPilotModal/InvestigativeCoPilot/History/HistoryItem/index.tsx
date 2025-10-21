import React, { useLayoutEffect, useRef, useState, useEffect, useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
import { setUserAlias } from '@flagright/lib/utils/userAlias';
import { parseQuestionResponse, QuestionResponse, QuestionResponseRuleHit } from '../../types';
import HistoryItemTable from './HistoryItemTable';
import HistoryItemStackedBarchart from './HistoryItemStackedBarchart';
import HistoryItemTimeSeries from './HistoryItemTimeSeries';
import HistoryItemBase from './HistoryItemBase';
import { VariablesValues } from './HistoryItemBase/Variables';
import HistoryItemBarchart from './HistoryItemBarchart';
import HistoryItemProperties from './HistoryItemProperties';
import HistoryItemEmbedded from './HistoryItemEmbedded';
import HistoryItemScreeningComparison from './HistoryItemScreeningComparison';
import { getErrorMessage, neverReturn } from '@/utils/lang';
import { useApi } from '@/api';
import { message } from '@/components/library/Message';
import { getMutationAsyncResource } from '@/utils/queries/mutations/helpers';
import { isLoading } from '@/utils/asyncResource';
import { FormValues as CommentEditorFormValues } from '@/components/CommentEditor';
import { CommonParams } from '@/components/library/Table/types';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import { sanitizeComment } from '@/components/markdown/MarkdownEditor/mention-utlis';
import HistoryItemRuleHit from '@/pages/case-management/AlertTable/InvestigativeCoPilotModal/InvestigativeCoPilot/History/HistoryItem/HistoryItemRuleHit';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import { HistoryItem } from '@/utils/api/alerts/types';

interface Props {
  isUnread: boolean;
  alertId: string;
  item: QuestionResponse;
  observe?: (el: Element) => () => void;
}

/**
 * Extracts pagination parameters from item variables and returns CommonParams
 */
function extractPageParamsFromVariables(item: QuestionResponse): CommonParams {
  const variables = item.variables || [];
  const params: CommonParams = { ...DEFAULT_PARAMS_STATE };

  variables.forEach((variable) => {
    if (variable.name === 'page' && typeof variable.value === 'number') {
      params.page = variable.value;
    } else if (variable.name === 'pageSize' && typeof variable.value === 'number') {
      params.pageSize = variable.value;
    } else if (variable.name === 'sort' && Array.isArray(variable.value)) {
      // Handle sort parameter if it exists in variables
      params.sort = variable.value;
    }
  });

  return params;
}

export default function HistoryItem(props: Props) {
  const { isUnread, item, alertId, observe } = props;
  const [itemState, setItemState] = useState<QuestionResponse>(item);
  const questionId = itemState.questionId;

  const rootRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (el && observe) {
      return observe(el);
    }
  }, [observe]);

  const api = useApi();
  const updateVarsMutation = useMutation<
    HistoryItem,
    unknown,
    VariablesValues & { page?: number; pageSize?: number }
  >(
    async (variables) => {
      if (questionId == null) {
        throw new Error(`Question id is not defined`);
      }
      const response = await api.postQuestion({
        alertId,
        QuestionRequest: {
          question: questionId,
          createdAt: itemState.createdAt,
          variables: Object.entries(variables)
            .filter(([_, value]) => value != null)
            .map(([name, value]) => ({ name, value })),
        },
      });
      return parseQuestionResponse(response)[0];
    },
    {
      onSuccess: (data) => {
        setItemState(data as QuestionResponse);
      },
      onError: (error) => {
        message.error(getErrorMessage(error));
      },
    },
  );

  const commentSubmitMutation = useMutation<unknown, unknown, CommentEditorFormValues>(
    async (values: CommentEditorFormValues) => {
      return await api.createAlertsComment({
        alertId,
        CommentRequest: { body: sanitizeComment(values.comment), files: values.files },
      });
    },
    {
      onSuccess: () => {
        message.success('Comment added successfully');
      },
      onError: (error) => {
        message.fatal(`Unable to add comment! ${getErrorMessage(error)}`, error);
      },
    },
  );

  // Initialize pageParams with values from item.variables instead of DEFAULT_PARAMS_STATE
  const [pageParams, setPageParams] = useState<CommonParams>(() =>
    extractPageParamsFromVariables(itemState),
  );

  // Update pageParams when itemState changes (e.g., after a mutation)
  useEffect(() => {
    setPageParams(extractPageParamsFromVariables(itemState));
  }, [itemState]);

  const onPageParams = (newParams: CommonParams) => {
    updateVarsMutation.mutate({
      ...updateVarsMutation.variables,
      page: newParams.page,
      pageSize: newParams.pageSize,
      sortField: newParams.sort[0]?.[0],
      sortOrder: newParams.sort[0]?.[1],
      sort: newParams.sort,
    });
    setPageParams((pageParams) => ({ ...pageParams, ...newParams }));
  };

  const preparedItemState = usePreparedItem(itemState);

  return (
    <HistoryItemBase
      ref={rootRef}
      questionId={questionId}
      commentSubmitMutation={commentSubmitMutation}
      isUnread={isUnread}
      isLoading={isLoading(getMutationAsyncResource(updateVarsMutation))}
      item={preparedItemState}
      onRefresh={(vars) => {
        updateVarsMutation.mutate({ ...vars });
        setPageParams(DEFAULT_PARAMS_STATE);
      }}
    >
      {renderItem(preparedItemState, pageParams, onPageParams)}
    </HistoryItemBase>
  );
}

function renderItem(
  item: QuestionResponse,
  pageParams: CommonParams,
  onPageParams: (params: CommonParams) => void,
) {
  if (item.questionType === 'TABLE') {
    return <HistoryItemTable item={item} pageParams={pageParams} onPageParams={onPageParams} />;
  }
  if (item.questionType === 'STACKED_BARCHART') {
    return <HistoryItemStackedBarchart item={item} />;
  }
  if (item.questionType === 'TIME_SERIES') {
    return <HistoryItemTimeSeries item={item} />;
  }
  if (item.questionType === 'BARCHART') {
    return <HistoryItemBarchart item={item} />;
  }
  if (item.questionType === 'PROPERTIES') {
    return <HistoryItemProperties item={item} />;
  }
  if (item.questionType === 'EMBEDDED') {
    return <HistoryItemEmbedded item={item} />;
  }
  if (item.questionType === 'SCREENING_COMPARISON') {
    return <HistoryItemScreeningComparison item={item} />;
  }
  if (item.questionType === 'RULE_HIT') {
    return <HistoryItemRuleHit item={item} />;
  }
  if (item.questionType === 'RULE_LOGIC') {
    const { properties } = item;
    const itemResult = properties?.reduce((acc, item) => {
      if (item.value !== undefined) {
        if (item.key) {
          acc[item.key] = item.value;
        }
      }
      return acc;
    }, {});
    return <HistoryItemRuleHit item={itemResult as QuestionResponseRuleHit} />;
  }
  return neverReturn(item, <>{JSON.stringify(item)}</>);
}

/*
  Helpers
 */

/**
 * Makes replacement in labels for user aliases
 */
export function usePreparedItem(itemState: QuestionResponse): QuestionResponse {
  const { userAlias } = useSettings();

  return useMemo(() => {
    if (itemState.questionType === 'TIME_SERIES') {
      return {
        ...itemState,
        timeseries: itemState.timeseries?.map((timeseriesItem) => ({
          ...timeseriesItem,
          label: setUserAlias(timeseriesItem.label, userAlias),
        })),
      };
    }
    if (itemState.questionType === 'BARCHART') {
      return {
        ...itemState,
        values: itemState.values?.map((valueItem) => ({
          ...valueItem,
          x: setUserAlias(valueItem.x, userAlias),
        })),
      };
    }
    if (itemState.questionType === 'STACKED_BARCHART') {
      return {
        ...itemState,
        values: itemState.series?.map((seriesItem) => ({
          ...seriesItem,
          label: setUserAlias(seriesItem.label, userAlias),
          values: seriesItem.values?.map((valueItem) => ({
            ...valueItem,
            x: setUserAlias(valueItem.x, userAlias),
          })),
        })),
      };
    }
    return itemState;
  }, [itemState, userAlias]);
}
