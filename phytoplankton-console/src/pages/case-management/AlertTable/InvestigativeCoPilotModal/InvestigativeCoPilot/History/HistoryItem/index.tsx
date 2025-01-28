import React, { useLayoutEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { parseQuestionResponse, QuestionResponse } from '../../types';
import HistoryItemRuleHit from './HistoryItemRuleHit';
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

interface Props {
  isUnread: boolean;
  alertId: string;
  item: QuestionResponse;
  observe?: (el: Element) => () => void;
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
    QuestionResponse,
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
          variables: Object.entries(variables)
            .filter(([_, value]) => value != null)
            .map(([name, value]) => ({ name, value })),
        },
      });
      return parseQuestionResponse(response)[0];
    },
    {
      onSuccess: (data) => {
        setItemState(data);
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
        message.success('Comment successfully added!');
      },
      onError: (error) => {
        message.fatal(`Unable to add comment! ${getErrorMessage(error)}`, error);
      },
    },
  );

  const [pageParams, setPageParams] = useState<CommonParams>(DEFAULT_PARAMS_STATE);

  const onPageParams = (newParams: CommonParams) => {
    updateVarsMutation.mutate({
      ...updateVarsMutation.variables,
      page: newParams.page,
      pageSize: newParams.pageSize,
    });
    setPageParams((pageParams) => ({ ...pageParams, ...newParams }));
  };

  return (
    <HistoryItemBase
      ref={rootRef}
      questionId={questionId}
      commentSubmitMutation={commentSubmitMutation}
      isUnread={isUnread}
      isLoading={isLoading(getMutationAsyncResource(updateVarsMutation))}
      item={itemState}
      onRefresh={(vars) => {
        updateVarsMutation.mutate({ ...vars });
        setPageParams(DEFAULT_PARAMS_STATE);
      }}
    >
      {renderItem(itemState, pageParams, onPageParams)}
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
  return neverReturn(item, <>{JSON.stringify(item)}</>);
}
