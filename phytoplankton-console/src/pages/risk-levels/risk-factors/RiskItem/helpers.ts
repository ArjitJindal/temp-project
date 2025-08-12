import { capitalizeNameFromEmail } from '@flagright/lib/utils/humanize';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useMutation } from '@/utils/queries/mutations/hooks';
import { RISK_FACTORS_V8 } from '@/utils/queries/keys';
import { message } from '@/components/library/Message';
import { makeUrl } from '@/utils/routing';
import { Mutation } from '@/utils/queries/types';
import { useRiskClassificationScores } from '@/utils/risk-levels';
import { useApi } from '@/api';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import { useAuth0User } from '@/utils/user-utils';
import {
  RiskFactorConfigurationFormValues,
  serializeRiskItem,
} from '@/pages/risk-levels/risk-factors/RiskFactorConfiguration/utils';

export type CreateRiskFactorVars = {
  riskFactorFormValues: RiskFactorConfigurationFormValues;
  comment?: string;
};

export function useCreateMutation(
  type: 'consumer' | 'business' | 'transaction',
  id: string | null,
  onSuccess?: () => void,
) {
  const user = useAuth0User();
  const navigate = useNavigate();
  const riskClassificationValues = useRiskClassificationScores();
  const api = useApi();
  const queryClient = useQueryClient();
  const isApprovalWorkflowsEnabled = useFeatureEnabled('APPROVAL_WORKFLOWS');

  const navigateToRiskFactor = () => {
    navigate(
      makeUrl(`/risk-levels/risk-factors/:type`, {
        type,
      }),
    );
  };

  const createRiskFactorMutation = useMutation(
    async (vars: CreateRiskFactorVars) => {
      const { riskFactorFormValues } = vars;
      return api.postCreateRiskFactor({
        RiskFactorsPostRequest: serializeRiskItem(
          riskFactorFormValues,
          type,
          riskClassificationValues,
          id ?? undefined,
          riskFactorFormValues?.v2Props,
        ),
      });
    },
    {
      onSuccess: async (newRiskFactor) => {
        onSuccess?.();
        navigateToRiskFactor();
        await queryClient.invalidateQueries(RISK_FACTORS_V8(type));
        message.success('Risk factor created successfully', {
          link: makeUrl(`/risk-levels/risk-factors/:type/:id/read`, {
            type,
            id: newRiskFactor.id,
          }),
          linkTitle: 'View risk factor',
          details: `${capitalizeNameFromEmail(user?.name || '')} created a risk factor ${
            newRiskFactor.id
          }`,
          copyFeedback: 'Risk factor URL copied to clipboard',
        });
      },
      onError: async (err) => {
        message.fatal(`Unable to create the risk factor - Some parameters are missing`, err);
      },
    },
  );

  const proposeCreateRiskFactorMutation = useMutation(
    async (vars: CreateRiskFactorVars) => {
      const { riskFactorFormValues, comment } = vars;
      if (comment == null) {
        throw new Error(`Comment is required`);
      }
      return api.postPulseRiskFactorsWorkflowProposal({
        RiskFactorRequest: {
          riskFactor: {
            ...serializeRiskItem(riskFactorFormValues, type, riskClassificationValues),
            // riskFactorId: riskItem.id,
          },
          action: 'create',
          comment: comment,
        },
      });
    },
    {
      onSuccess: async () => {
        onSuccess?.();
        navigateToRiskFactor();
        await queryClient.invalidateQueries(RISK_FACTORS_V8(type));
        message.success('Risk factor creation proposal created successfully!');
      },
      onError: async (err) => {
        message.fatal(`Unable to create the proposal`, err);
      },
    },
  );

  const result: Mutation<unknown, unknown, CreateRiskFactorVars> = isApprovalWorkflowsEnabled
    ? proposeCreateRiskFactorMutation
    : createRiskFactorMutation;
  return result;
}
