import { useCallback, useMemo, useState } from 'react';
import pluralize from 'pluralize';
import { useMutation } from '@tanstack/react-query';
import { Space } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { pick } from 'lodash';
import { AllParams, TableColumn } from '../Table/types';
import { DEFAULT_PARAMS_STATE } from '../Table/consts';
import { EmptyEntitiesInfo } from '../EmptyDataInfo';
import { DrawerMode, DrawerStepperJsonSchemaForm } from '../DrawerStepperJsonSchemaForm';
import { Step } from '../Stepper';
import { message } from '../Message';
import { ColumnHelper } from '../Table/columnHelper';
import Button from '../Button';
import Confirm from '@/components/utils/Confirm';
import EditLineIcon from '@/components/ui/icons/Remix/design/edit-line.react.svg';
import DeleteLineIcon from '@/components/ui/icons/Remix/system/delete-bin-line.react.svg';
import { usePaginatedQuery } from '@/utils/queries/hooks';
import { getMutationAsyncResource } from '@/utils/queries/mutations/helpers';
import QueryResultsTable from '@/components/common/QueryResultsTable';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
import { Permission } from '@/apis';
import { useHasPermissions } from '@/utils/user-utils';
import { Authorized } from '@/components/Authorized';

function getDrawerTitle(drawerMode: DrawerMode, entityName: string): string {
  let verb = '';
  if (drawerMode === 'CREATE') {
    verb = 'Create';
  } else if (drawerMode === 'UPDATE') {
    verb = 'Update';
  } else if (drawerMode === 'READ_ONLY') {
    verb = 'View';
  }
  return `${verb} ${entityName}`;
}

function getDrawerDescription(drawerMode: DrawerMode, entityName: string): string {
  let verb = '';
  if (drawerMode === 'CREATE') {
    verb = 'create a';
  } else if (drawerMode === 'UPDATE') {
    verb = 'update the';
  }
  return drawerMode === 'READ_ONLY'
    ? ''
    : `Fill in the required information to ${verb} ${entityName}`;
}

interface Props<GetParams, Entity extends { [key: string]: any }> {
  entityName: string;
  tableId: string;
  entityIdField: keyof Entity;
  readPermissions?: Permission[];
  writePermissions?: Permission[];
  columns: TableColumn<Entity>[];
  apiOperations: {
    GET: (params: GetParams) => Promise<{ total: number; data: Entity[] }>;
    CREATE: (entity: Entity) => Promise<Entity>;
    UPDATE: (entityId: string, entity: Entity) => Promise<Entity>;
    DELETE: (entityId: string) => Promise<void>;
  };
  formSteps: Array<{ step: Step; jsonSchema: object }>;
  formWidth?: string;
  extraInfo?: { label: string; redirectUrl: string };
}

export function CrudEntitiesTable<GetParams, Entity extends { [key: string]: any }>(
  props: Props<GetParams, Entity>,
) {
  const [drawerMode, setDrawerMode] = useState<DrawerMode>('CLOSED');
  const isReadOnly = !useHasPermissions(props.writePermissions ?? []);
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const [params, setParams] = useState<AllParams<GetParams>>(DEFAULT_PARAMS_STATE as any);
  const queryResult = usePaginatedQuery<Entity>(
    [props.entityName, params],
    async (paginationParams) => {
      const { total, data } = await props.apiOperations.GET({ ...params, ...paginationParams });
      return {
        total,
        items: data,
      };
    },
  );
  const creationMutation = useMutation(
    async (entity: Entity) => {
      return await props.apiOperations.CREATE(entity);
    },
    {
      onSuccess: () => {
        message.success('Successfully created');
        setDrawerMode('CLOSED');
        queryResult.refetch();
      },
      onError: (error: Error) => {
        message.error(`Error: ${error.message}`);
      },
    },
  );
  const updateMutation = useMutation(
    async (entity: Entity) => {
      return await props.apiOperations.UPDATE(selectedEntity![props.entityIdField], entity);
    },
    {
      onSuccess: () => {
        message.success('Successfully updated');
        setDrawerMode('CLOSED');
        queryResult.refetch();
      },
      onError: (error: Error) => {
        message.error(`Error: ${error.message}`);
      },
    },
  );
  const deletionMutation = useMutation(
    async (entityId: string) => {
      return await props.apiOperations.DELETE(entityId);
    },
    {
      onSuccess: () => {
        message.success('Successfully deleted');
        queryResult.refetch();
      },
      onError: (error: Error) => {
        message.error(`Error: ${error.message}`);
      },
    },
  );
  const handleEntityCreation = useCallback(() => {
    setSelectedEntity(null);
    setDrawerMode('CREATE');
  }, []);
  const handleEntityEdit = useCallback((entity: Entity) => {
    setSelectedEntity(entity);
    setDrawerMode('UPDATE');
  }, []);
  const handleEntityView = useCallback((entity: Entity) => {
    setSelectedEntity(entity);
    setDrawerMode('READ_ONLY');
  }, []);
  const handleDrawerChangeVisibility = useCallback((visible: boolean) => {
    if (!visible) {
      setDrawerMode('CLOSED');
    }
  }, []);
  const handleEntitySubmit = useCallback(
    async (newEntity: Entity) => {
      if (drawerMode === 'CREATE') {
        creationMutation.mutate(newEntity);
      } else if (drawerMode === 'UPDATE') {
        updateMutation.mutate(newEntity);
      }
    },
    [creationMutation, drawerMode, updateMutation],
  );
  const entityName = props.entityName.toLowerCase();
  const pluralEntityName = pluralize(entityName, 2);
  const actionColumn = useMemo(() => {
    const tableHelper = new ColumnHelper<Entity>();
    return tableHelper.display({
      id: '_action',
      title: 'Action',
      enableResizing: false,
      render: (entity) => {
        const readOnly =
          isReadOnly ||
          (entity?.status === undefined ? false : entity.status === 'DRAFT' ? false : true);
        return (
          <Space>
            <Button
              testName="edit-button"
              size="MEDIUM"
              type="SECONDARY"
              icon={<EditLineIcon />}
              onClick={() => (readOnly ? handleEntityView(entity) : handleEntityEdit(entity))}
              requiredPermissions={readOnly ? props.readPermissions : props.writePermissions}
            >
              {readOnly ? 'View' : 'Edit'}
            </Button>
            {isReadOnly ? undefined : (
              <Confirm
                title={`Are you sure you want to delete this ${entityName}?`}
                onConfirm={() => {
                  deletionMutation.mutate(entity[props.entityIdField]);
                }}
                text={`Please confirm that you want to delete this ${entityName}. This action cannot be undone.`}
                res={getMutationAsyncResource(deletionMutation)}
              >
                {({ onClick }) => (
                  <Button
                    testName="delete-button"
                    size="MEDIUM"
                    type="TETRIARY"
                    icon={<DeleteLineIcon />}
                    onClick={onClick}
                    isDisabled={deletionMutation.isLoading}
                    requiredPermissions={props.writePermissions}
                  >
                    Delete
                  </Button>
                )}
              </Confirm>
            )}
          </Space>
        );
      },
      defaultSticky: 'RIGHT',
      defaultWidth: 201,
    });
  }, [
    deletionMutation,
    entityName,
    handleEntityEdit,
    handleEntityView,
    isReadOnly,
    props.entityIdField,
    props.writePermissions,
    props.readPermissions,
  ]);
  const formInitialValues = useMemo(() => {
    return Object.fromEntries(
      props.formSteps.map((step) => [
        step.step.key,
        pick(selectedEntity, Object.keys((step.jsonSchema as any).properties ?? {})) ?? {},
      ]),
    ) as any;
  }, [props.formSteps, selectedEntity]);
  return (
    <Authorized required={props.readPermissions ?? []}>
      <AsyncResourceRenderer resource={queryResult.data}>
        {(data) => {
          return data.total === 0 ? (
            <EmptyEntitiesInfo
              title={`No ${pluralEntityName} found`}
              description={`You haven’t added any ${entityName} yet. Create a new ${entityName} by clicking below`}
              action={isReadOnly ? undefined : `Create ${entityName}`}
              onActionButtonClick={handleEntityCreation}
            />
          ) : (
            <QueryResultsTable<Entity, AllParams<GetParams>>
              rowKey={props.entityIdField as any}
              tableId={props.tableId}
              hideFilters={true}
              params={params}
              onChangeParams={setParams}
              queryResults={queryResult}
              columns={props.columns.concat(actionColumn)}
              extraTools={[
                () =>
                  isReadOnly ? undefined : (
                    <Button
                      type="PRIMARY"
                      onClick={handleEntityCreation}
                      requiredPermissions={props.writePermissions}
                    >
                      <PlusOutlined />
                      Create {`${entityName}`}
                    </Button>
                  ),
              ]}
            />
          );
        }}
      </AsyncResourceRenderer>

      <DrawerStepperJsonSchemaForm<Entity>
        isVisible={drawerMode !== 'CLOSED'}
        onChangeVisibility={handleDrawerChangeVisibility}
        title={getDrawerTitle(drawerMode, entityName)}
        description={getDrawerDescription(drawerMode, entityName)}
        mode={drawerMode}
        steps={props.formSteps}
        onSubmit={handleEntitySubmit}
        drawerMaxWidth={props.formWidth}
        formInitialValues={formInitialValues}
        isSaving={updateMutation.isLoading || creationMutation.isLoading}
        extraInfo={props.extraInfo}
      />
    </Authorized>
  );
}
