import { useParams } from 'react-router';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { SimulationHistory } from '../RiskFactorsSimulation/SimulationHistoryPage/SimulationHistory';
import { RiskFactorsSimulation } from '../RiskFactorsSimulation';
import RiskFactorsTable from './RiskFactorsTable';
import { useRiskFactors } from './utils';
import { useHasResources } from '@/utils/user-utils';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { map } from '@/utils/queries/types';
import { PageWrapperContentContainer } from '@/components/PageWrapper';
import VersionHistoryFooter from '@/components/VersionHistory/Footer';
import { useNewVersionId } from '@/utils/version';
import { message } from '@/components/library/Message';
import { useApi } from '@/api';
import { riskFactorsAtom, riskFactorsEditEnabled, riskFactorsStore } from '@/store/risk-factors';
import { getOr } from '@/utils/asyncResource';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import { RISK_FACTOR_WORKFLOW_PROPOSAL } from '@/utils/queries/keys';

interface Props {
  type: string;
}

export default function ({ isSimulationMode }: { isSimulationMode: boolean }) {
  const { type = isSimulationMode ? 'simulation' : 'consumer' } = useParams();
  return <CustomRiskFactors type={type} />;
}

export const CustomRiskFactors = (props: Props) => {
  const { type } = props;
  const queryResult = useRiskFactors(type as 'consumer' | 'business' | 'transaction');
  const canWriteRiskFactors = useHasResources(['write:::risk-scoring/risk-factors/*']);
  const [isUpdateEnabled, setIsUpdateEnabled] = useAtom(riskFactorsEditEnabled);
  const riskFactors = useAtomValue(riskFactorsAtom);
  const store = useSetAtom(riskFactorsStore);
  const count = riskFactors.getCount();
  const api = useApi();
  const newVersionIdQuery = useNewVersionId('RiskFactors');
  const versionId = getOr(newVersionIdQuery.data, {
    id: '',
  });
  const isApprovalWorkflowsEnabled = useFeatureEnabled('APPROVAL_WORKFLOWS');
  const queryClient = useQueryClient();

  const saveRiskFactorsMutation = useMutation<void, Error, { comment: string }>(
    async ({ comment }: { comment: string }) => {
      if (isApprovalWorkflowsEnabled) {
        if (comment == null) {
          throw new Error(`Comment is required`);
        }
        const riskFactorEntities = riskFactors.getAll();
        for (const entity of riskFactorEntities) {
          await api.postPulseRiskFactorsWorkflowProposal({
            RiskFactorRequest: {
              riskFactor: {
                ...entity,
                riskFactorId: entity.id,
              },
              action: 'update',
              comment: comment,
            },
          });
        }
        await queryClient.invalidateQueries(RISK_FACTOR_WORKFLOW_PROPOSAL());
        message.success('Proposal sent successfully!', {
          details: 'Changes will take effect after approval',
        });
      } else {
        await api.putRiskFactors({
          RiskFactorsUpdateRequest: {
            comment: comment,
            riskFactors: riskFactors.getAll(),
          },
        });
        message.success('Changes applied successfully!');
      }
    },
    {
      onSuccess: () => {
        queryResult.refetch();
        setIsUpdateEnabled(false);
        newVersionIdQuery.refetch();
        store(new Map());
      },
      onError: (error) => {
        message.fatal('Failed to save risk factors', error);
      },
    },
  );

  if (type === 'simulation') {
    return (
      <AsyncResourceRenderer resource={queryResult.data}>
        {(data) => <RiskFactorsSimulation riskFactors={data} parameterValues={{}} />}
      </AsyncResourceRenderer>
    );
  } else if (type === 'simulation-history') {
    return <SimulationHistory />;
  }

  return (
    <PageWrapperContentContainer
      footer={
        isUpdateEnabled && (
          <VersionHistoryFooter
            onCancel={() => {
              store(new Map());
              setIsUpdateEnabled(false);
            }}
            versionId={versionId.id ?? ''}
            mutation={saveRiskFactorsMutation}
            isDisabled={count === 0}
            modalTitle="Update risk factors"
            modalIdLabel="Risk factor version"
            footerMessage={
              count > 0
                ? `${count} risk factors have been updated`
                : 'Note that updating risk factors would save as a new version'
            }
          />
        )
      }
    >
      <RiskFactorsTable
        type={type}
        mode="normal"
        baseUrl={`/risk-levels/risk-factors`}
        queryResults={() =>
          map(queryResult, (data) => ({
            items: data.map((riskFactor) => {
              const changedFactor = riskFactors.getById(riskFactor.id);
              return changedFactor ?? riskFactor;
            }),
          }))
        }
        canEditRiskFactors={canWriteRiskFactors}
      />
    </PageWrapperContentContainer>
  );
};
