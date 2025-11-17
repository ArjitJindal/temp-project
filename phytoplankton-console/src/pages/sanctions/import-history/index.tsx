import { useState } from 'react';
import PageWrapper, { PageWrapperContentContainer } from '@/components/PageWrapper';
import Breadcrumbs from '@/components/library/Breadcrumbs';
import QueryResultsTable from '@/components/shared/QueryResultsTable';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { DATE_TIME } from '@/components/library/Table/standardDataTypes';
import { AllParams, CommonParams, TableColumn } from '@/components/library/Table/types';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import { useSanctionsBulkSearchItems } from '@/utils/api/screening';
import Id from '@/components/ui/Id';
import AccountTag from '@/components/AccountTag';

type ImportRow = {
  searchTermId: string;
  searchTerm: string;
  reason?: string;
  createdBy?: string;
  createdAt?: number;
};

export default function ImportHistoryPage() {
  const [params, setParams] = useState<AllParams<CommonParams>>({
    ...DEFAULT_PARAMS_STATE,
  });
  const query = useSanctionsBulkSearchItems({ pageSize: params.pageSize, from: params.from });
  const helper = new ColumnHelper<ImportRow>();
  const columns: TableColumn<ImportRow>[] = [
    helper.simple<'searchTermId'>({
      title: 'Import ID',
      key: 'searchTermId',
      type: {
        render: (value) => <Id to={`/screening/bulk-search/${value}`}>{value}</Id>,
        stringify: (value) => String(value ?? ''),
        link: (value) => (value ? `/screening/bulk-search/${value}` : undefined),
      },
    }),
    helper.simple<'searchTerm'>({
      title: 'Search term',
      key: 'searchTerm',
      type: {
        render: (value, { item }) => (
          <Id to={`/screening/bulk-search/${item.searchTermId}`}>{value}</Id>
        ),
      },
    }),
    helper.simple<'reason'>({ title: 'Import reason', key: 'reason' }),
    helper.simple<'createdBy'>({
      title: 'Created by',
      key: 'createdBy',
      type: {
        render: (userId) => (userId ? <AccountTag accountId={userId} /> : <></>),
      },
    }),
    helper.simple<'createdAt'>({
      title: 'Created at',
      key: 'createdAt',
      type: DATE_TIME,
      filtering: false,
    }),
  ];

  return (
    <PageWrapper
      header={
        <Breadcrumbs
          items={[
            { title: 'Screening', to: '/screening/manual-screening' },
            { title: 'Manual screening', to: '/screening/manual-screening' },
            { title: 'Batch screening', to: '/screening/manual-screening' },
            { title: 'Import history', to: '/screening/imports' },
          ]}
        />
      }
    >
      <PageWrapperContentContainer>
        <QueryResultsTable<ImportRow>
          rowKey="searchTermId"
          queryResults={query as any}
          params={params as any}
          onChangeParams={(p) =>
            setParams((prev) => ({
              ...prev,
              pageSize: (p as any).pageSize ?? prev.pageSize,
              from: (p as any).from ?? prev.from,
            }))
          }
          columns={columns}
          sizingMode="FULL_WIDTH"
          fitHeight
        />
      </PageWrapperContentContainer>
    </PageWrapper>
  );
}
