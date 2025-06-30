import React, { useState } from 'react';
import { SanctionsWhitelistEntity } from '@/apis';
import { useApi } from '@/api';
import { SANCTIONS_WHITELIST_SEARCH } from '@/utils/queries/keys';
import { useCursorQuery } from '@/utils/queries/hooks';
import QueryResultsTable from '@/components/shared/QueryResultsTable';
import { useMutation } from '@/utils/queries/mutations/hooks';
import { message } from '@/components/library/Message';
import { getErrorMessage } from '@/utils/lang';
import { AllParams } from '@/components/library/Table/types';
import {
  SanctionsWhitelistTableParams,
  useColumns,
  useExtraFilters,
} from '@/components/SanctionsWhitelistTable/helpers';
import ComplyAdvantageHitDetailsDrawer from '@/components/ComplyAdvantageHitTable/ComplyAdvantageHitDetailsDrawer';

interface Props {
  singleUserMode?: boolean;
  params: AllParams<SanctionsWhitelistTableParams>;
  onChangeParams: (newParams: AllParams<SanctionsWhitelistTableParams>) => void;
}

export default function SanctionsWhitelistTable(props: Props) {
  const { singleUserMode = false, params, onChangeParams } = props;

  const api = useApi();

  const queryResult = useCursorQuery(SANCTIONS_WHITELIST_SEARCH(params), async ({ from }) => {
    return api.searchSanctionsWhitelist({
      start: from || params.from,
      pageSize: params.pageSize,
      filterUserId: params.userId ? [params.userId] : undefined,
      filterEntity: params.entity ? [params.entity] : undefined,
      filterEntityType: params.entityType ? [params.entityType] : undefined,
    });
  });

  const deleteMutation = useMutation<unknown, unknown, { ids: string[] }>(
    async (variables) => {
      await api.deleteSanctionsWhitelistRecords({
        request_body: variables.ids,
      });
    },
    {
      onSuccess: () => {
        message.success('Record deleted successfully');
        queryResult.refetch();
      },
      onError: (e) => {
        message.fatal(`Failed to delete record: ${getErrorMessage(e)}`, e);
      },
    },
  );

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
      />
      <ComplyAdvantageHitDetailsDrawer
        hit={selectedSearchHit?.sanctionsEntity ? selectedSearchHit.sanctionsEntity : null}
        onClose={() => setSelectedSearchHit(undefined)}
      />
    </>
  );
}
