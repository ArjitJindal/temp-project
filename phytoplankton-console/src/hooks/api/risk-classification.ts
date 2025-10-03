import { useApi } from '@/api';
import { useMutation } from '@/utils/queries/mutations/hooks';

export function usePostRiskClassification() {
  const api = useApi();
  return useMutation((payload: { scores: any; comment: string }) =>
    api.postPulseRiskClassification({
      RiskClassificationRequest: { scores: payload.scores, comment: payload.comment },
    }),
  );
}
