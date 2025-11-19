import { useMemo, useState } from 'react';
import {
  useAlertsSamplingUpdateMutation,
  useDeleteAlertsSamplingMutation,
} from '../case-management/QA/utils';
import { QAModal } from '../case-management/QA/Modal';
import s from './index.module.less';
import { AlertsQaSampling, Priority } from '@/apis';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { DATE_TIME, PRIORITY, QA_SAMPLE_ID } from '@/components/library/Table/standardDataTypes';
import { AllParams, TableColumn } from '@/components/library/Table/types';
import PageWrapper, { PageWrapperContentContainer } from '@/components/PageWrapper';
import QueryResultsTable from '@/components/shared/QueryResultsTable';
import { Authorized } from '@/components/utils/Authorized';
import { useUsers } from '@/utils/api/auth';
import AccountTag from '@/components/AccountTag';
import { AccountsFilter } from '@/components/library/AccountsFilter';
import { PRIORITYS } from '@/apis/models-custom/Priority';
import Breadcrumbs from '@/components/library/Breadcrumbs';
import Button from '@/components/library/Button';
import EditLineIcon from '@/components/ui/icons/Remix/design/edit-line.react.svg';
import DeleteLineIcon from '@/components/ui/icons/Remix/system/delete-bin-line.react.svg';
import Confirm from '@/components/utils/Confirm';
import { useAlertQaSampling } from '@/utils/api/alerts';
import { getAccountUserName } from '@/utils/user-utils';

interface TableItem extends AlertsQaSampling {}

export interface QASamplesTableParams {
  samplingName?: string;
  samplingId?: string;
  priority?: Priority[];
  createdAt?: number[];
  createdBy?: string[];
}

const QASamplesTable = () => {
  const { users } = useUsers();
  const [params, onChangeParams] = useState<AllParams<QASamplesTableParams>>({
    pageSize: 20,
    sort: [['createdAt', 'descend']],
  });
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const queryResults = useAlertQaSampling(params);

  const deleteMutation = useDeleteAlertsSamplingMutation(
    () => {},
    { success: 'Sample deleted successfully', error: 'Failed to delete sample' },
    queryResults,
  );

  const editMutation = useAlertsSamplingUpdateMutation(
    setIsEditModalOpen,
    { success: 'Sample updated successfully', error: 'Failed to update sample' },
    queryResults,
  );

  const [selectedIdForEdit, setSelectedIdForEdit] = useState<string | null>(null);

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
            return value ? getAccountUserName(users[value]) : '';
          },
          render: (value) => <AccountTag accountId={value} />,
        },
      }),
      helper.display({
        title: 'Actions',
        defaultWidth: 200,
        render: (value, { item }) => {
          return (
            <div className={s.actions} key={item.samplingId}>
              <Button
                onClick={() => {
                  setIsEditModalOpen(true);
                  setSelectedIdForEdit(item.samplingId);
                }}
                type="TETRIARY"
                icon={<EditLineIcon />}
              >
                Edit
              </Button>
              <QAModal
                isModalOpen={selectedIdForEdit === item.samplingId && isEditModalOpen}
                setIsModalOpen={setIsEditModalOpen}
                onSubmit={(values) => {
                  editMutation.mutate({
                    sampleId: item.samplingId,
                    body: {
                      samplingName: values.samplingName,
                      samplingDescription: values.samplingDescription,
                      samplingQuantity: values.samplingQuantity,
                      priority: values.priority,
                    },
                  });
                }}
                sampleType={item.samplingType}
                type="EDIT"
                params={item.samplingType === 'AUTOMATIC' ? item.filters : undefined}
                initialValues={item}
              />
              <Confirm
                onConfirm={() => deleteMutation.mutate(item.samplingId)}
                text="Are you sure you want to delete this sample? This action cannot be undone."
                title="Delete sample"
              >
                {({ onClick }) => (
                  <Button onClick={onClick} icon={<DeleteLineIcon />} type="TETRIARY">
                    Delete
                  </Button>
                )}
              </Confirm>
            </div>
          );
        },
      }),
    ]);
  }, [users, deleteMutation, editMutation, isEditModalOpen, selectedIdForEdit]);

  return (
    <Authorized minRequiredResources={['read:::case-management/qa/*']} showForbiddenPage>
      <PageWrapper
        header={
          <Breadcrumbs
            items={[
              { title: 'Case Management', to: '/case-management' },
              { title: 'QA', to: '/case-management/cases' },
              { title: 'Sampling' },
            ]}
          />
        }
      >
        <PageWrapperContentContainer>
          <QueryResultsTable<TableItem, QASamplesTableParams>
            columns={columns}
            queryResults={queryResults}
            rowKey="samplingId"
            onChangeParams={onChangeParams}
            params={params}
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
                title: 'Created by',
                renderer: ({ params, setParams }) => (
                  <AccountsFilter
                    users={params.createdBy ?? []}
                    title="Created by"
                    onConfirm={(value) => {
                      setParams((prevState) => ({
                        ...prevState,
                        createdBy: value,
                      }));
                    }}
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

export default QASamplesTable;
