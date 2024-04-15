import { useMemo, useState } from 'react';
import { useApi } from '@/api';
import { AlertsQaSampling, Priority } from '@/apis';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import {
  DATE_TIME,
  PERCENT,
  PRIORITY,
  QA_SAMPLE_ID,
} from '@/components/library/Table/standardDataTypes';
import { AllParams, TableColumn } from '@/components/library/Table/types';
import PageWrapper, { PageWrapperContentContainer } from '@/components/PageWrapper';
import QueryResultsTable from '@/components/shared/QueryResultsTable';
import { Authorized } from '@/components/utils/Authorized';
import { usePaginatedQuery } from '@/utils/queries/hooks';
import { ALERT_QA_SAMPLING } from '@/utils/queries/keys';
import { useUsers } from '@/utils/user-utils';
import AccountTag from '@/components/AccountTag';
import ActionTakenByFilterButton from '@/pages/auditlog/components/ActionTakeByFilterButton';
import { PRIORITYS } from '@/apis/models-custom/Priority';
import Breadcrumbs from '@/components/library/Breadcrumbs';

interface TableItem extends AlertsQaSampling {}
interface TableParams {
  samplingName?: string;
  samplingPercentage?: number;
  samplingId?: string;
  priority?: Priority;
  createdAt?: number[];
  createdBy?: string[];
}

const QASamplesTable = () => {
  const api = useApi();
  const [users] = useUsers();
  const [params, onChangeParams] = useState<AllParams<TableParams>>({
    pageSize: 20,
    sort: [['createdAt', 'descend']],
  });

  const queryResults = usePaginatedQuery(
    ALERT_QA_SAMPLING({ ...params }),
    async (paginationParams) => {
      const data = await api.getAlertsQaSampling({
        ...paginationParams,
        sortField: params.sort?.[0]?.[0],
        sortOrder: params.sort?.[0]?.[1] ?? 'descend',
        filterSampleName: params.samplingName,
        filterSamplePercentage: params.samplingPercentage,
        filterSampleId: params.samplingId,
      });

      return {
        items: data.data,
        total: data.total,
      };
    },
  );

  const columns: TableColumn<TableItem>[] = useMemo(() => {
    const helper = new ColumnHelper<TableItem>();

    return helper.list([
      helper.simple<'priority'>({
        title: '',
        key: 'priority',
        type: PRIORITY,
        defaultWidth: 50,
        headerTitle: 'Priority',
        sorting: true,
      }),
      helper.simple<'samplingId'>({
        title: 'Sampling ID',
        key: 'samplingId',
        type: QA_SAMPLE_ID,
        filtering: true,
        sorting: true,
      }),
      helper.simple<'samplingName'>({
        title: 'Sample name',
        key: 'samplingName',
        filtering: true,
      }),
      helper.simple<'samplingDescription'>({
        title: 'Sample description',
        key: 'samplingDescription',
        filtering: true,
      }),
      helper.simple<'samplingPercentage'>({
        title: 'Sampling %',
        key: 'samplingPercentage',
        type: PERCENT,
        filtering: true,
      }),
      helper.derived<string>({
        title: "No. of alerts QA'd",
        value: (item) => `${item.numberOfAlertsQaDone ?? 0} / ${item.numberOfAlerts}`,
      }),
      helper.simple<'createdAt'>({
        title: 'Created at',
        key: 'createdAt',
        type: DATE_TIME,
        filtering: true,
        sorting: true,
      }),
      helper.simple<'createdBy'>({
        title: 'Created by',
        key: 'createdBy',
        type: {
          stringify: (value) => {
            return value ? users[value]?.email : '';
          },
          render: (value) => <AccountTag accountId={value} />,
        },
      }),
    ]);
  }, [users]);

  return (
    <Authorized required={['case-management:qa:read']} showForbiddenPage>
      <PageWrapper
        header={
          <div style={{ display: 'flex', padding: '1rem' }}>
            <Breadcrumbs
              items={[
                { title: 'Case Management', to: '/case-management' },
                { title: 'QA', to: '/case-management/cases' },
                { title: 'Sampling' },
              ]}
            />
          </div>
        }
      >
        <PageWrapperContentContainer>
          <QueryResultsTable<TableItem, TableParams>
            columns={columns}
            queryResults={queryResults}
            rowKey="samplingId"
            onChangeParams={onChangeParams}
            params={params}
            selection
            extraFilters={[
              {
                title: 'Priority',
                key: 'priority',
                renderer: {
                  kind: 'select',
                  mode: 'MULTIPLE',
                  displayMode: 'select',
                  options: PRIORITYS.map((x) => ({ value: x, label: x })),
                },
                showFilterByDefault: true,
              },
              {
                key: 'createdBy',
                title: 'Action taken by',
                renderer: ({ params, setParams }) => (
                  <ActionTakenByFilterButton
                    initialState={params.createdBy ?? []}
                    title="Created by"
                    onConfirm={(value) => {
                      setParams((prevState) => ({
                        ...prevState,
                        createdBy: value,
                      }));
                    }}
                    hideIcon
                  />
                ),
              },
            ]}
          />
        </PageWrapperContentContainer>
      </PageWrapper>
    </Authorized>
  );
};

export { QASamplesTable };
