import { useMutation } from '@tanstack/react-query';
import { State, prepareApiState } from '../RiskClassificationTable';
import { useApi } from '@/api';
import { RiskClassificationHistory } from '@/apis';
import { message } from '@/components/library/Message';

interface UseRiskClassificationMutationProps {
  successAction: (data: RiskClassificationHistory) => void;
}

export function useRiskClassificationMutation({
  successAction,
}: UseRiskClassificationMutationProps) {
  const api = useApi();

  const state = useMutation<RiskClassificationHistory, Error, { state: State; comment: string }>(
    (data) =>
      api.postPulseRiskClassification({
        RiskClassificationRequest: {
          scores: prepareApiState(data.state),
          comment: data.comment,
        },
      }),
    {
      onSuccess: (data) => {
        message.success('Risk values saved successfully');
        successAction(data);
      },
      onError: (error) => {
        message.fatal('Unable to save risk values', error);
      },
    },
  );

  return {
    isLoading: state.isLoading,
    mutate: state.mutate,
    isSuccess: state.isSuccess,
    isError: state.isError,
  };
}
