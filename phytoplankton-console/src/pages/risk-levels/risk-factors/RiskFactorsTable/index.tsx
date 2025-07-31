import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { ScopeSelectorValue } from './utils';
import { useTableColumns } from './hooks/useTableColumns';
import { ExpandedComponent } from './ExpandedComponent';
import { TableHeader } from './TableHeader';
import { RiskFactor } from '@/apis';
import { TableRefType } from '@/components/library/Table/types';
import QueryResultsTable from '@/components/shared/QueryResultsTable';
import { QueryResult } from '@/utils/queries/types';
import { makeUrl } from '@/utils/routing';

interface Props {
  type: string;
  mode: 'simulation' | 'normal' | 'version-history';
  simulationRiskFactors?: RiskFactor[];
  queryResults: (selectedSection: ScopeSelectorValue) => QueryResult<{ items: RiskFactor[] }>;
  activeIterationIndex?: number;
  jobId?: string;
  canEditRiskFactors?: boolean;
  handleSimulationSave?: (riskFactors: RiskFactor[]) => void;
  baseUrl?: string;
}

export default function RiskFactorsTable(props: Props) {
  const {
    type,
    mode,
    simulationRiskFactors,
    queryResults,
    activeIterationIndex = 1,
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

  const riskFactorsColumns = useTableColumns({
    actionRef,
    jobId,
    activeIterationIndex,
    selectedSection,
    mode,
    handleSimulationSave: handleSimulationSave || (() => {}),
  });

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
      />
      <QueryResultsTable<RiskFactor>
        rowKey="id"
        tableId={`custom-risk-factors-${selectedSection}`}
        innerRef={actionRef}
        queryResults={queryResults(selectedSection)}
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
            activeIterationIndex={activeIterationIndex}
          />
        )}
      />
    </>
  );
}
