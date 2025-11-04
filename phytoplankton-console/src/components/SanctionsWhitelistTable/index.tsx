import React, { useState } from 'react';
import { SanctionsWhitelistEntity } from '@/apis';
import QueryResultsTable from '@/components/shared/QueryResultsTable';
import { AllParams } from '@/components/library/Table/types';
import {
  SanctionsWhitelistTableParams,
  useColumns,
  useExtraFilters,
} from '@/components/SanctionsWhitelistTable/helpers';
import ScreeningHitDetailsDrawer from '@/components/ScreeningHitTable/ScreeningHitDetailsDrawer';
import { useHasResources } from '@/utils/user-utils';
import { useSanctionsWhitelist, useDeleteSanctionsWhitelist } from '@/utils/api/screening';

interface Props {
  singleUserMode?: boolean;
  params: AllParams<SanctionsWhitelistTableParams>;
  onChangeParams: (newParams: AllParams<SanctionsWhitelistTableParams>) => void;
}

export default function SanctionsWhitelistTable(props: Props) {
  const { singleUserMode = false, params, onChangeParams } = props;

  const hasSanctionsWhitelistWritePermission = useHasResources(['write:::screening/whitelist/*']);

  const queryResult = useSanctionsWhitelist(params);

  const deleteMutation = useDeleteSanctionsWhitelist(() => queryResult.refetch());

  const selectedHitState = useState<SanctionsWhitelistEntity>();

  const filters = useExtraFilters(singleUserMode);
  const columns = useColumns(singleUserMode, deleteMutation, selectedHitState);

  const [selectedSearchHit, setSelectedSearchHit] = selectedHitState;

  return (
    <>
      <QueryResultsTable<SanctionsWhitelistEntity, SanctionsWhitelistTableParams>
        rowKey="sanctionsWhitelistId"
        extraFilters={filters}
        queryResults={queryResult}
        params={params}
        onChangeParams={onChangeParams}
        columns={columns}
        readOnlyFilters={!hasSanctionsWhitelistWritePermission}
      />
      <ScreeningHitDetailsDrawer
        hit={selectedSearchHit?.sanctionsEntity ? selectedSearchHit.sanctionsEntity : null}
        onClose={() => setSelectedSearchHit(undefined)}
      />
    </>
  );
}
