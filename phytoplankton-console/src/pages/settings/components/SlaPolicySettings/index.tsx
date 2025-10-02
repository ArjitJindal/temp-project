import PlusOutlined from '@ant-design/icons/lib/icons/PlusOutlined';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { capitalizeNameFromEmail, humanizeSnakeCase } from '@flagright/lib/utils/humanize';
import s from './styles.module.less';
import PolicyForm from './PolicyForm';
import { FormValues, formValuesToSlaPolicy } from './utils/utils';
import { useApi } from '@/api';
import { SLAPolicy } from '@/apis';
import Button from '@/components/library/Button';
import { EmptyEntitiesInfo } from '@/components/library/EmptyDataInfo';
import SettingsCard from '@/components/library/SettingsCard';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { DATE } from '@/components/library/Table/standardDataTypes';
import { AllParams, TableColumn } from '@/components/library/Table/types';
import QueryResultsTable from '@/components/shared/QueryResultsTable';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { ConsoleUserAvatar } from '@/pages/case-management/components/ConsoleUserAvatar';
import { useSlaPoliciesPaginated } from '@/hooks/api';
import {
  getDisplayedUserInfo,
  useAuth0User,
  useCurrentUser,
  useHasResources,
  useUsers,
} from '@/utils/user-utils';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import FileCopyLineIcon from '@/components/ui/icons/Remix/document/file-copy-line.react.svg';
import DeleteBinLineIcon from '@/components/ui/icons/Remix/system/delete-bin-line.react.svg';
import { DefaultApiGetSlaPoliciesRequest } from '@/apis/types/ObjectParamAPI';
import { getOr } from '@/utils/asyncResource';
import Drawer from '@/components/library/Drawer';
import { FormRef } from '@/components/library/Form';
import Id from '@/components/ui/Id';
import { message } from '@/components/library/Message';
import Confirm from '@/components/utils/Confirm';
import { isEqual } from '@/utils/lang';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';

const defaultValues: FormValues = {
  id: '',
  name: '',
  description: '',
  type: 'ALERT',
  policyConfiguration: {
    SLATime: {
      breachTime: {
        units: 0,
        granularity: 'hours',
      },
    },
    statusDetails: {
      statuses: ['OPEN'],
    },
    workingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
  },
};

export function SlaPolicySettings() {
  const api = useApi();
  const auth0User = useAuth0User();
  const [users, loadingUsers] = useUsers();
  const [params, setParams] = useState<AllParams<DefaultApiGetSlaPoliciesRequest>>({
    ...DEFAULT_PARAMS_STATE,
    pageSize: 50,
  });
  const isPnb = useFeatureEnabled('PNB');
  const slaPoliciesResult = useSlaPoliciesPaginated(params, {});
  const isReadOnly = !useHasResources(['write:::settings/case-management/*']);
  const formRef = useRef<FormRef<any>>(null);
  const [isDrawerVisible, setIsDrawerVisible] = useState(false);
  const currentUser = useCurrentUser();
  const [hasChanges, setHasChanges] = useState(false);
  const creationMutation = useMutation(
    async (values: FormValues) => {
      return await api.postSlaPolicy({
        SLAPolicy: formValuesToSlaPolicy(values, currentUser?.id ?? ''),
      });
    },
    {
      onSuccess: async (response) => {
        message.success('A new SLA policy is created successfully', {
          details: `${capitalizeNameFromEmail(auth0User?.name || '')} created a new SLA policy ${
            response.id
          }`,
        });
        setIsDrawerVisible(false);
        setSelectedSlaPolicy(undefined);
        slaPoliciesResult.refetch();
      },
      onError: (error: Error) => {
        message.fatal(`Error: ${error.message}`);
      },
    },
  );
  const updateMutation = useMutation(
    async (values: FormValues) => {
      if (selectedSlaPolicy == null) {
        throw new Error(`Unable to update selected policy since it is null`);
      }
      return await api.putSlaPolicy({
        slaId: selectedSlaPolicy.id,
        SLAPolicy: formValuesToSlaPolicy(values, currentUser?.id ?? ''),
      });
    },
    {
      onSuccess: () => {
        message.success('SLA policy is updated successfully', {
          details: `${capitalizeNameFromEmail(auth0User?.name || '')} updated the SLA policy ${
            selectedSlaPolicy?.id
          }`,
        });
        setSelectedSlaPolicy(undefined);
        setIsDrawerVisible(false);
        slaPoliciesResult.refetch();
      },
      onError: (error: Error) => {
        message.fatal(`Error: ${error.message}`);
      },
    },
  );
  const deletionMutation = useMutation(
    async (slaId: string) => {
      await api.deleteSlaPolicy({ slaId });
    },
    {
      onSuccess: () => {
        message.success('SLA policy deleted successfully', {
          details: `${capitalizeNameFromEmail(auth0User?.name || '')} deleted the SLA policy ${
            selectedSlaPolicy?.id
          }`,
        });
        slaPoliciesResult.refetch();
      },
      onError: (error: Error) => {
        message.fatal(`Error: ${error.message}`);
      },
    },
  );
  const handleCreate = useCallback(
    async (values: FormValues) => {
      creationMutation.mutate(values);
    },
    [creationMutation],
  );
  const handleEdit = useCallback(
    async (values: FormValues) => {
      updateMutation.mutate(values);
    },
    [updateMutation],
  );
  const [selectedSlaPolicy, setSelectedSlaPolicy] = useState<FormValues | undefined>(undefined);
  const handleOpenForm = useCallback(
    (slaPolicyId?: string) => {
      if (slaPolicyId) {
        const slaPolicy = getOr(slaPoliciesResult.data, { total: 0, items: [] }).items.find(
          (slaPolicy) => slaPolicy.id === slaPolicyId,
        );
        setSelectedSlaPolicy(slaPolicy);
      }
      setIsDrawerVisible(true);
      setHasChanges(false);
    },
    [slaPoliciesResult],
  );

  const handleCopySlaPolicy = useCallback(
    async (slaPolicy: SLAPolicy) => {
      const newSlaPolicy = {
        ...slaPolicy,
        id: '',
        name: `${slaPolicy.name} (copy)`,
        description: `${slaPolicy.description} (copy)`,
      };
      creationMutation.mutate({ ...defaultValues, ...newSlaPolicy });
    },
    [creationMutation],
  );

  const columns: TableColumn<SLAPolicy>[] = useMemo(() => {
    const helper = new ColumnHelper<SLAPolicy>();
    return helper.list([
      helper.simple<'id'>({
        title: 'ID',
        key: 'id',
        type: {
          render: (value) => (
            <Id
              onClick={() => {
                handleOpenForm(value);
              }}
            >
              {value}
            </Id>
          ),
        },
      }),

      helper.simple<'name'>({
        title: 'Name',
        key: 'name',
      }),
      helper.simple<'description'>({
        title: 'Description',
        key: 'description',
        defaultWidth: 200,
      }),
      ...(isPnb
        ? [
            helper.display({
              title: 'Type',
              id: 'type',
              render: (value) => humanizeSnakeCase(value.type ?? ''),
            }),
          ]
        : []),
      helper.simple<'createdBy'>({
        title: 'Created by',
        key: 'createdBy',
        type: {
          render: (userId, _) => {
            return userId ? (
              <ConsoleUserAvatar userId={userId} users={users} loadingUsers={loadingUsers} />
            ) : (
              <>-</>
            );
          },
          stringify(value, items) {
            return items.createdBy ? getDisplayedUserInfo(users[items.createdBy]).name : '-';
          },
        },
      }),
      helper.simple<'createdAt'>({
        title: 'Created On',
        key: 'createdAt',
        type: DATE,
      }),
      helper.simple<'updatedAt'>({
        title: 'Last updated',
        key: 'updatedAt',
        type: DATE,
      }),
      helper.display({
        id: 'actions',
        title: 'Actions',
        defaultSticky: 'RIGHT',
        defaultWidth: 150,
        render: (item) => {
          return (
            <div className={s.actionIconsContainer}>
              <FileCopyLineIcon
                className={s.actionIcons}
                onClick={() => {
                  handleCopySlaPolicy(item);
                }}
              />
              <Confirm
                title={`Are you sure you want to delete this SLA policy?`}
                onConfirm={() => {
                  deletionMutation.mutate(item.id);
                }}
                text={`Please confirm that you want to delete this SLA policy. This action cannot be undone.`}
              >
                {({ onClick }) => (
                  <DeleteBinLineIcon
                    className={s.actionIcons}
                    onClick={() => {
                      onClick();
                    }}
                  />
                )}
              </Confirm>
            </div>
          );
        },
      }),
    ]);
  }, [deletionMutation, handleOpenForm, users, loadingUsers, handleCopySlaPolicy, isPnb]);
  const initialValues = selectedSlaPolicy ?? defaultValues;
  return (
    <SettingsCard
      title="SLA Policy"
      description="Define SLA policies for investigation"
      minRequiredResources={['read:::settings/case-management/sla-policies/*']}
    >
      <Drawer
        title={'Create SLA policy'}
        description="Fill in the required information to create a SLA policy"
        isVisible={isDrawerVisible}
        onChangeVisibility={(isShown) => {
          if (!isShown) {
            setSelectedSlaPolicy(undefined);
            setHasChanges(false);
          }
          setIsDrawerVisible(isShown);
        }}
        drawerMaxWidth="1200px"
        hasChanges={hasChanges}
        footer={
          <div>
            <Button
              type="PRIMARY"
              onClick={() => {
                formRef.current?.submit();
              }}
            >
              {selectedSlaPolicy ? 'Update' : 'Create'}
            </Button>
          </div>
        }
      >
        <PolicyForm
          initialValues={initialValues}
          handleCreate={handleCreate}
          handleEdit={handleEdit}
          formRef={formRef}
          mode={selectedSlaPolicy ? 'EDIT' : 'CREATE'}
          onChange={(formValues) => {
            setHasChanges(!isEqual(formValues, initialValues));
          }}
        />
      </Drawer>
      <AsyncResourceRenderer resource={slaPoliciesResult.data}>
        {(slaPolicies) => {
          if (slaPolicies.items.length === 0) {
            return (
              <EmptyEntitiesInfo
                title={`SLA Policy not found`}
                description={
                  'No SLA policy has been created yet. Click on ‘Create SLA’  below to configure a new SLA policy.'
                }
                action={isReadOnly ? undefined : `Create SLA`}
                onActionButtonClick={handleOpenForm}
              />
            );
          }
          return (
            <QueryResultsTable<SLAPolicy>
              rowKey="id"
              columns={columns}
              queryResults={slaPoliciesResult}
              tableId="sla-policy-table"
              hideFilters={true}
              params={params}
              externalHeader
              onChangeParams={setParams}
              extraTools={[
                () =>
                  isReadOnly ? undefined : (
                    <Button
                      type="PRIMARY"
                      onClick={() => handleOpenForm(undefined)}
                      requiredResources={['write:::settings/case-management/*']}
                    >
                      <PlusOutlined />
                      Create SLA
                    </Button>
                  ),
              ]}
            />
          );
        }}
      </AsyncResourceRenderer>
    </SettingsCard>
  );
}

export default SlaPolicySettings;
