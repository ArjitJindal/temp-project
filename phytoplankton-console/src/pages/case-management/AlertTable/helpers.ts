import { useQueryClient } from '@tanstack/react-query';
import { TableAlertItem } from './types';
import { getPolicyTime } from './SlaStatus/SlaPolicyDetails';
import { message } from '@/components/library/Message';
import { Case, SLAPolicy } from '@/apis';
import { useApi } from '@/api';
import { CASES_ITEM_ALERT_LIST, CASES_LIST } from '@/utils/queries/keys';
import { getErrorMessage } from '@/utils/lang';
import { Mutation } from '@/utils/queries/types';
import { useMutation } from '@/utils/queries/mutations/hooks';
import { ColumnHelper } from '@/components/library/Table/columnHelper';

function useCreateNewCaseMutation({ onResetSelection }: { onResetSelection: () => void }): Mutation<
  unknown,
  unknown,
  {
    sourceCaseId: string;
    alertIds: string[];
  },
  unknown
> {
  const api = useApi();
  const queryClient = useQueryClient();

  const createNewCaseMutation = useMutation<
    Case,
    unknown,
    { sourceCaseId: string; alertIds: string[] }
  >(
    async ({ alertIds, sourceCaseId }) => {
      const hideLoading = message.loading('Moving alerts to new case');
      try {
        return await api.alertsNoNewCase({ AlertsToNewCaseRequest: { sourceCaseId, alertIds } });
      } finally {
        hideLoading();
      }
    },
    {
      onSuccess: async (response, variables) => {
        message.success(`New case ${response.caseId} successfully created`);
        const queryKey = CASES_ITEM_ALERT_LIST(variables.sourceCaseId);
        await queryClient.invalidateQueries({ queryKey });
        await queryClient.invalidateQueries({ queryKey: CASES_LIST({}) });
        onResetSelection();
      },
      onError: (e) => {
        message.fatal(`Unable to create a new case! ${getErrorMessage(e)}`, e);
      },
    },
  );
  return createNewCaseMutation;
}

export const getSlaColumnsForExport = (
  helper: ColumnHelper<TableAlertItem>,
  slaPolicies: SLAPolicy[],
) => {
  const columns = [0, 1, 2].flatMap((i) => [
    helper.simple<'slaPolicyDetails'>({
      title: `SLA policy ${i + 1} - Name`,
      key: `slaPolicyDetails`,
      type: {
        stringify: (slaPolicyDetails) => {
          const policyDetail = slaPolicyDetails?.[i];
          const policyId = policyDetail?.slaPolicyId;
          const policy = slaPolicies.find((policy) => policy.id === policyId);
          return policy?.name ?? '-';
        },
      },
      hideInTable: true,
      exporting: true,
    }),
    helper.simple<'slaPolicyDetails'>({
      title: `SLA policy ${i + 1} - Status`,
      key: `slaPolicyDetails`,
      type: {
        stringify: (slaPolicyDetails) => {
          return slaPolicyDetails?.[i]?.policyStatus ?? '-';
        },
      },
      hideInTable: true,
      exporting: true,
    }),
    helper.simple<'slaPolicyDetails'>({
      title: `SLA policy ${i + 1} - Exceeded by/Exceeding in`,
      key: `slaPolicyDetails`,
      type: {
        stringify: (slaPolicyDetails) => {
          const policyDetail = slaPolicyDetails?.[i];
          if (!policyDetail) {
            return '-';
          }

          const { policyStatus, slaPolicyId, elapsedTime } = policyDetail;
          const policy = slaPolicies.find((policy) => policy.id === slaPolicyId);

          const timeDescription = policyStatus === 'BREACHED' ? 'Exceeded by ' : 'Exceeding in ';

          return policy ? `${timeDescription}${getPolicyTime(policy, elapsedTime)}` : '-';
        },
      },
      hideInTable: true,
      exporting: true,
    }),
  ]);
  return columns;
};

export { useCreateNewCaseMutation };
