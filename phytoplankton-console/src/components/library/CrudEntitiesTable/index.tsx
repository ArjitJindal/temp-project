import { useCallback, useMemo, useState } from 'react';
import pluralize from 'pluralize';
import { useMutation } from '@tanstack/react-query';
import { Space } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { pick } from 'lodash';
import { Resource } from '@flagright/lib/utils';
import { AllParams, TableColumn } from '../Table/types';
import { DEFAULT_PARAMS_STATE } from '../Table/consts';
import { EmptyEntitiesInfo } from '../EmptyDataInfo';
import { DrawerMode, DrawerStepperJsonSchemaForm } from '../DrawerStepperJsonSchemaForm';
import { Step } from '../Stepper';
import { message } from '../Message';
import { ColumnHelper } from '../Table/columnHelper';
import Button from '../Button';
import { Authorized } from '@/components/utils/Authorized';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import Confirm from '@/components/utils/Confirm';
import EditLineIcon from '@/components/ui/icons/Remix/design/edit-line.react.svg';
import EyeLineIcon from '@/components/ui/icons/Remix/system/eye-line.react.svg';
import FileCopyLineIcon from '@/components/ui/icons/Remix/document/file-copy-line.react.svg';
import DeleteLineIcon from '@/components/ui/icons/Remix/system/delete-bin-line.react.svg';
import { usePaginatedQuery } from '@/utils/queries/hooks';
import { getMutationAsyncResource } from '@/utils/queries/mutations/helpers';
import QueryResultsTable from '@/components/shared/QueryResultsTable';
import { useHasResources } from '@/utils/user-utils';

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
  readResources?: (entity: Entity) => Resource[];
  writeResources?: (entity?: Entity) => Resource[];
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
  onChange?: (formState: Entity) => void;
  portal?: boolean;
  enableClone?: boolean;
}

export function CrudEntitiesTable<GetParams, Entity extends { [key: string]: any }>(
  props: Props<GetParams, Entity>,
) {
  const {
    entityName,
    tableId,
    entityIdField,
    readResources,
    writeResources,
    columns,
    apiOperations,
    formSteps,
    formWidth,
    extraInfo,
    onChange,
    portal,
    enableClone,
  } = props;
  const [drawerMode, setDrawerMode] = useState<DrawerMode>('CLOSED');
  const isReadOnly = !useHasResources(writeResources?.() ?? []);
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const [params, setParams] = useState<AllParams<GetParams>>(DEFAULT_PARAMS_STATE as any);
  const queryResult = usePaginatedQuery<Entity>([entityName, params], async (paginationParams) => {
    const { total, data } = await apiOperations.GET({ ...params, ...paginationParams });
    return {
      total,
      items: data,
    };
  });
  const creationMutation = useMutation(
    async (entity: Entity) => {
      return await apiOperations.CREATE(entity);
    },
    {
      onSuccess: () => {
        message.success(`A new ${entityName} is created successfully`);
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
      if (selectedEntity == null) {
        throw new Error(`Unable to update ${entityName} since it is null`);
      }
      return await apiOperations.UPDATE(selectedEntity[entityIdField], entity);
    },
    {
      onSuccess: () => {
        message.success(`${entityName} is updated successfully`);
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
      return await apiOperations.DELETE(entityId);
    },
    {
      onSuccess: () => {
        message.success(`${entityName} is deleted successfully`);
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
  const pluralEntityName = pluralize(entityName.toLowerCase(), 2);
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
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))',
                gap: '8px',
              }}
            >
              <Button
                testName="edit-button"
                size="MEDIUM"
                type="SECONDARY"
                icon={readOnly ? <EyeLineIcon /> : <EditLineIcon />}
                onClick={() => (readOnly ? handleEntityView(entity) : handleEntityEdit(entity))}
                requiredResources={readOnly ? readResources?.(entity) : writeResources?.(entity)}
              >
                {readOnly ? 'View' : 'Edit'}
              </Button>
            </div>
            {enableClone && (
              <Button
                testName="duplicate-button"
                size="MEDIUM"
                type="SECONDARY"
                icon={<FileCopyLineIcon />}
                onClick={() => {
                  const entityToClone = { ...entity, status: 'DRAFT' } as Entity;
                  delete entityToClone[entityIdField]; // Remove ID from cloned entity
                  setSelectedEntity(entityToClone);
                  setDrawerMode('CREATE');
                }}
                requiredResources={writeResources?.(entity)}
                isDisabled={creationMutation.isLoading}
              >
                Duplicate
              </Button>
            )}
            {isReadOnly ? undefined : (
              <Confirm
                title={`Are you sure you want to delete this ${entityName}?`}
                onConfirm={() => {
                  deletionMutation.mutate(entity[entityIdField]);
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
                    requiredResources={writeResources?.(entity)}
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
      defaultWidth: enableClone ? 321 : 201,
    });
  }, [
    creationMutation,
    deletionMutation,
    entityName,
    handleEntityEdit,
    handleEntityView,
    isReadOnly,
    entityIdField,
    enableClone,
    writeResources,
    readResources,
  ]);
  const formInitialValues = useMemo(() => {
    return Object.fromEntries(
      formSteps.map((step) => [
        step.step.key,
        pick(selectedEntity, Object.keys((step.jsonSchema as any).properties ?? {})) ?? {},
      ]),
    ) as any;
  }, [formSteps, selectedEntity]);

  const requiredResources = selectedEntity
    ? readResources?.(selectedEntity)
    : readResources?.({} as Entity);

  return (
    <Authorized minRequiredResources={requiredResources ?? []}>
      <AsyncResourceRenderer resource={queryResult.data}>
        {(data) => {
          return data.total === 0 ? (
            <EmptyEntitiesInfo
              title={`No ${pluralEntityName} found`}
              description={`You haven't added any ${entityName} yet. Create a new ${entityName} by clicking below`}
              action={isReadOnly ? undefined : `Create ${entityName}`}
              onActionButtonClick={handleEntityCreation}
            />
          ) : (
            <QueryResultsTable<Entity, AllParams<GetParams>>
              rowKey={entityIdField as any}
              tableId={tableId}
              hideFilters={true}
              params={params}
              onChangeParams={setParams}
              externalHeader
              queryResults={queryResult}
              columns={columns.concat(actionColumn)}
              extraTools={[
                () =>
                  isReadOnly ? undefined : (
                    <Button
                      type="PRIMARY"
                      onClick={handleEntityCreation}
                      requiredResources={writeResources?.()}
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
        steps={formSteps}
        onSubmit={handleEntitySubmit}
        drawerMaxWidth={formWidth}
        formInitialValues={formInitialValues}
        isSaving={updateMutation.isLoading || creationMutation.isLoading}
        extraInfo={extraInfo}
        onChange={onChange}
        portal={portal}
      />
    </Authorized>
  );
}
