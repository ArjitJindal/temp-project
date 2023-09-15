import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { parseQuestionResponse, QuestionResponse } from '../../types';
import HistoryItemTable from './HistoryItemTable';
import HistoryItemStackedBarchart from './HistoryItemStackedBarchart';
import HistoryItemTimeSeries from './HistoryItemTimeSeries';
import { VariablesValues } from './HistoryItemLayout/VariablesPopover';
import HistoryItemLayout from './HistoryItemLayout';
import { getErrorMessage, neverReturn } from '@/utils/lang';
import { useApi } from '@/api';
import { message } from '@/components/library/Message';
import { getMutationAsyncResource } from '@/utils/queries/hooks';
import { isLoading } from '@/utils/asyncResource';
import HistoryItemBarchart from '@/pages/case-management/AlertTable/InvestigativeCoPilotModal/InvestigativeCoPilot/History/HistoryItem/HistoryItemBarchart';

interface Props {
  alertId: string;
  item: QuestionResponse;
}

export default function HistoryItem(props: Props) {
  const { item, alertId } = props;
  const [itemState, setItemState] = useState<QuestionResponse>(item);
  const questionId = itemState.questionId;

  const api = useApi();
  const updateVarsMutation = useMutation<QuestionResponse, unknown, VariablesValues>(
    async (variables) => {
      if (questionId == null) {
        throw new Error(`Question id is not defined`);
      }
      const response = await api.postQuestion({
        alertId: alertId,
        QuestionRequest: {
          questionId,
          variables: Object.entries(variables).map(([name, value]) => ({ name, value })),
        },
      });
      return parseQuestionResponse(response);
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

  return (
    <HistoryItemLayout
      isLoading={isLoading(getMutationAsyncResource(updateVarsMutation))}
      item={itemState}
      onRefresh={(vars) => {
        updateVarsMutation.mutate(vars);
      }}
    >
      {renderItem(itemState)}
    </HistoryItemLayout>
  );
}

function renderItem(item: QuestionResponse) {
  if (item.questionType === 'TABLE') {
    return <HistoryItemTable item={item} />;
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
  return neverReturn(item, <>{JSON.stringify(item)}</>);
}
