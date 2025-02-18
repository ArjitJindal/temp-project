import React from 'react';
import SanctionsHitsTable from '@/components/SanctionsHitsTable';
import { QueryResult } from '@/utils/queries/types';
import { CursorPaginatedData } from '@/utils/queries/hooks';
import { Alert, SanctionsHit, SanctionsHitStatus } from '@/apis';
import { AllParams } from '@/components/library/Table/types';
import { StatePair } from '@/utils/state';
import { SanctionsHitsTableParams } from '@/pages/alert-item/components/AlertDetails/AlertDetailsTabs/helpers';

interface Props {
  alert?: Alert;
  params: StatePair<AllParams<SanctionsHitsTableParams>>;
  selectedSanctionsHitsIds?: string[];
  fitHeight?: boolean;
  onSanctionsHitSelect?: (sanctionsHitsIds: string[]) => void;
  onSanctionsHitsChangeStatus?: (sanctionsHitsIds: string[], newStatus: SanctionsHitStatus) => void;
  queryResult: QueryResult<CursorPaginatedData<SanctionsHit>>;
}

export default function HitsTab(props: Props) {
  const {
    alert,
    params,
    queryResult,
    selectedSanctionsHitsIds,
    fitHeight,
    onSanctionsHitSelect,
    onSanctionsHitsChangeStatus,
  } = props;
  const [tableParams, setTableParams] = params;
  return (
    <SanctionsHitsTable
      tableRef={null}
      queryResult={queryResult}
      hideCleaningReason={true}
      selectedIds={selectedSanctionsHitsIds}
      selection={onSanctionsHitSelect != null}
      params={tableParams}
      onChangeParams={setTableParams}
      onSelect={onSanctionsHitSelect}
      onSanctionsHitsChangeStatus={onSanctionsHitsChangeStatus}
      alertCreatedAt={alert?.createdTimestamp}
      fitHeight={fitHeight}
    />
  );
}
