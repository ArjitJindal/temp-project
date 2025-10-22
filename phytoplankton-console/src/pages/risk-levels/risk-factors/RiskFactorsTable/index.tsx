import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { ScopeSelectorValue } from './utils';
import { useTableColumns } from './hooks/useTableColumns';
import { ExpandedComponent } from './ExpandedComponent';
import { TableHeader } from './TableHeader';
import { RiskFactor } from '@/apis';
import { isSingleRow, TableData, TableRefType } from '@/components/library/Table/types';
import QueryResultsTable from '@/components/shared/QueryResultsTable';
import { map, QueryResult } from '@/utils/queries/types';
import { makeUrl } from '@/utils/routing';
import { useQuery } from '@/utils/queries/hooks';
import { RISK_FACTOR_WORKFLOW_PROPOSAL_LIST } from '@/utils/queries/keys';
import { useApi } from '@/api';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import {
  failed,
  init,
  isFailed,
  isInit,
  isLoading,
  isSuccess,
  loading,
} from '@/utils/asyncResource';
import { RiskFactorRow } from '@/pages/risk-levels/risk-factors/RiskFactorsTable/types';

type BaseProps = {
  type: string;
  queryResults: (selectedSection: ScopeSelectorValue) => QueryResult<{ items: RiskFactor[] }>;
  jobId?: string;
  canEditRiskFactors?: boolean;
  baseUrl?: string;
};

type SimulationModeProps = BaseProps & {
  mode: 'simulation';
  activeIterationIndex: number;
  simulationRiskFactors?: RiskFactor[];
  handleSimulationSave?: (riskFactors: RiskFactor[]) => void;
};

type NormalModeProps = BaseProps & {
  mode: 'normal';
  activeIterationIndex?: number;
  simulationRiskFactors?: never;
  handleSimulationSave?: never;
};

type VersionHistoryModeProps = BaseProps & {
  mode: 'version-history';
  activeIterationIndex?: number;
  simulationRiskFactors?: never;
  handleSimulationSave?: never;
};

type Props = SimulationModeProps | NormalModeProps | VersionHistoryModeProps;

export default function RiskFactorsTable(props: Props) {
  const {
    type,
    mode,
    simulationRiskFactors,
    queryResults: queryResultsFactory,
    activeIterationIndex,
    jobId,
    canEditRiskFactors = true,
    handleSimulationSave,
    baseUrl,
  } = props;
  const actionRef = useRef<TableRefType>(null);
  const navigate = useNavigate();
  const [selectedSection, setSelectedSection] = useState<ScopeSelectorValue>(
    type as ScopeSelectorValue,
  );
  const [editableRiskFactor, setEditableRiskFactor] = useState<RiskFactor | null>(null);
  const isApprovalWorkflowsEnabled = useFeatureEnabled('APPROVAL_WORKFLOWS');

  const riskFactorsColumns = useTableColumns({
    actionRef,
    jobId,
    activeIterationIndex,
    selectedSection,
    mode,
    handleSimulationSave: handleSimulationSave || (() => {}),
    setEditableRiskFactor,
  });

  const queryResults: QueryResult<{ items: RiskFactor[] }> = useMemo(() => {
    return queryResultsFactory(selectedSection);
  }, [queryResultsFactory, selectedSection]);

  const api = useApi();
  const { data: pendingProposalRes } = useQuery(
    RISK_FACTOR_WORKFLOW_PROPOSAL_LIST(),
    async () => {
      const proposals = await api.getPulseRiskFactorsWorkflowProposal();
      return proposals;
    },
    {
      enabled: isApprovalWorkflowsEnabled,
    },
  );

  // Merging query results with pending proposals
  const queryResultsWithProposals: QueryResult<TableData<RiskFactorRow>> = useMemo(() => {
    if (!queryResults) {
      return {
        data: init(),
        refetch: () => {},
      };
    }
    if (!isApprovalWorkflowsEnabled) {
      return queryResults;
    }
    if (isFailed(pendingProposalRes)) {
      return {
        data: failed(pendingProposalRes.message),
        refetch: () => {},
      };
    }
    if (isLoading(pendingProposalRes) || isInit(pendingProposalRes)) {
      return {
        data: loading(),
        refetch: () => {},
      };
    }
    const proposals = pendingProposalRes.value;
    if (isApprovalWorkflowsEnabled && !isSuccess(pendingProposalRes)) {
      return {
        data: loading(),
        refetch: () => {},
      };
    }

    return map(queryResults, (data): TableData<RiskFactorRow> => {
      const newRiskFactorsRows = proposals
        .filter((x) => {
          if (x.action !== 'create') {
            return false;
          }
          switch (x.riskFactor.type) {
            case 'CONSUMER_USER':
              return type === 'consumer';
            case 'BUSINESS':
              return type === 'business';
            case 'TRANSACTION':
              return type === 'transaction';
          }
        })
        .map((proposal): RiskFactorRow => {
          return {
            ...proposal.riskFactor,
            proposal: proposal,
          };
        });

      return {
        ...data,
        items: [
          ...newRiskFactorsRows,
          ...data.items.map((item) => {
            return {
              ...item,
              proposal: proposals.find(
                (x) =>
                  (x.action === 'update' || x.action === 'delete') &&
                  isSingleRow(item) &&
                  x.riskFactor.id === item.id,
              ),
            };
          }),
        ],
      };
    });
  }, [queryResults, pendingProposalRes, isApprovalWorkflowsEnabled, type]);

  return (
    <>
      <TableHeader
        canEditRiskFactors={canEditRiskFactors}
        selectedSection={selectedSection}
        setSelectedSection={(value) => {
          setSelectedSection(value);
          if (baseUrl) {
            navigate(makeUrl(`${baseUrl}/${value}`, { type: value }));
          }
        }}
        mode={mode}
        activeIterationIndex={activeIterationIndex}
      />
      <QueryResultsTable<RiskFactorRow>
        rowKey="id"
        tableId={`custom-risk-factors-${selectedSection}`}
        innerRef={actionRef}
        queryResults={queryResultsWithProposals}
        columns={riskFactorsColumns}
        pagination={false}
        fitHeight={mode !== 'simulation'}
        toolsOptions={false}
        isExpandable={(row) => 'parameter' in row.content && !!row.content.parameter}
        renderExpanded={(row) => (
          <ExpandedComponent
            riskFactor={row}
            selectedSection={selectedSection}
            simulationRiskFactors={simulationRiskFactors}
            handleSimulationSave={handleSimulationSave}
            canEditRiskFactors={canEditRiskFactors}
            mode={mode}
            jobId={jobId}
            isEditable={editableRiskFactor?.id === row.id}
            setEditableRiskFactor={setEditableRiskFactor}
            activeIterationIndex={activeIterationIndex}
          />
        )}
      />
    </>
  );
}
