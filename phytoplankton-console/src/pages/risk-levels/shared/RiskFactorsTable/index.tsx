import { useRef, useState, useCallback, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { EditOutlined } from '@ant-design/icons';
import { useQueryClient } from '@tanstack/react-query';
import s from './styles.module.less';
import ValuesTable from '@/pages/risk-levels/risk-factors/RiskFactorConfiguration/RiskFactorConfigurationForm/RiskFactorConfigurationStep/ParametersTable/ValuesTable';
import * as Card from '@/components/ui/Card';
import SegmentedControl from '@/components/library/SegmentedControl';
import { makeUrl } from '@/utils/routing';
import Button from '@/components/library/Button';
import {
  RiskFactor,
  RuleInstanceStatus,
  RiskEntityType,
  RiskParameterLevelKeyValue,
  RiskLevel,
} from '@/apis';
import { TableColumn, TableRefType } from '@/components/library/Table/types';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { BOOLEAN, DATE_TIME, STRING } from '@/components/library/Table/standardDataTypes';
import { useHasPermissions } from '@/utils/user-utils';
import { message } from '@/components/library/Message';
import Id from '@/components/ui/Id';
import { RuleStatusSwitch } from '@/pages/rules/components/RuleStatusSwitch';
import Table from '@/components/library/Table';
import QueryResultsTable from '@/components/shared/QueryResultsTable';
import Tag from '@/components/library/Tag';
import ActionMenu from '@/pages/risk-levels/risk-factors/components/ActionMenu';
import { useApi } from '@/api';
import { RISK_FACTORS_V8 } from '@/utils/queries/keys';
import { useSafeLocalStorageState } from '@/utils/hooks';

export type ScopeSelectorValue = 'consumer' | 'business' | 'transaction';

export const scopeToRiskEntityType = (scope: ScopeSelectorValue): RiskEntityType => {
  switch (scope) {
    case 'consumer':
      return 'CONSUMER_USER';
    case 'business':
      return 'BUSINESS';
    case 'transaction':
      return 'TRANSACTION';
  }
};

export interface RiskFactorsTypeMap {
  CONSUMER_USER: RiskFactor[];
  BUSINESS: RiskFactor[];
  TRANSACTION: RiskFactor[];
}

interface Props {
  type: string;
  isSimulation?: boolean;
  riskFactors?: RiskFactor[];
  queryResults?: any;
  simulationStorageKey?: string;
  activeIterationIndex?: number;
  jobId?: string;
  canEditRiskFactors?: boolean;
  api?: any;
  handleSaveParameters?: ({
    values,
    defaultRiskLevel,
    defaultWeight,
    defaultRiskScore,
    riskFactorId,
  }: {
    values: RiskParameterLevelKeyValue[];
    defaultRiskLevel: RiskLevel;
    defaultWeight: number;
    defaultRiskScore: number;
    riskFactorId: string;
  }) => Promise<void>;
  handleSimulationSave?: (riskFactors: RiskFactor[]) => void;
}

export default function RiskFactorsTable(props: Props) {
  const {
    type,
    isSimulation,
    riskFactors,
    queryResults,
    simulationStorageKey,
    activeIterationIndex = 1,
    jobId,
    canEditRiskFactors = true,
    handleSaveParameters,
    handleSimulationSave,
  } = props;
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const actionRef = useRef<TableRefType>(null);
  const api = useApi();

  const [updatedRiskFactor, setUpdatedRiskFactor] = useState<{ [key: string]: RiskFactor }>({});
  const [selectedSection, setSelectedSection] = useState<ScopeSelectorValue>(
    type as ScopeSelectorValue,
  );

  useEffect(() => {
    if (!location.pathname.includes('simulation')) {
      navigate(makeUrl(`/risk-levels/risk-factors/:type`, { type: selectedSection }), {
        replace: true,
      });
    }
  }, [selectedSection, navigate, location.pathname]);

  const defaultRiskFactorsMap: RiskFactorsTypeMap = riskFactors
    ? riskFactors.reduce(
        (acc, riskFactor) => {
          acc[riskFactor.type].push(riskFactor);
          return acc;
        },
        {
          CONSUMER_USER: [],
          BUSINESS: [],
          TRANSACTION: [],
        } as RiskFactorsTypeMap,
      )
    : {
        CONSUMER_USER: [],
        BUSINESS: [],
        TRANSACTION: [],
      };

  const [localStorageRiskFactors, setLocalStorageRiskFactors] =
    useSafeLocalStorageState<RiskFactorsTypeMap>(
      simulationStorageKey || 'temp-risk-factors',
      defaultRiskFactorsMap,
    );

  const [memoryRiskFactors, setMemoryRiskFactors] =
    useState<RiskFactorsTypeMap>(defaultRiskFactorsMap);

  const simulationRiskFactorsMap =
    isSimulation && simulationStorageKey ? localStorageRiskFactors : memoryRiskFactors;

  const setSimulationRiskFactorsMap = useCallback(
    (value: RiskFactorsTypeMap | ((prev: RiskFactorsTypeMap) => RiskFactorsTypeMap)) => {
      if (isSimulation && simulationStorageKey) {
        setLocalStorageRiskFactors(value as any);
      } else {
        setMemoryRiskFactors(value);
      }
    },
    [isSimulation, simulationStorageKey, setLocalStorageRiskFactors, setMemoryRiskFactors],
  );

  const canWriteRiskFactors =
    useHasPermissions(
      ['risk-scoring:risk-factors:write'],
      ['write:::risk-scoring/risk-factors/*'],
    ) && canEditRiskFactors;

  const handleActivationChangeMutation = useCallback(
    async ({ id, status }: { id: string; status: RuleInstanceStatus }) => {
      if (!isSimulation && api) {
        try {
          const data = await api.putRiskFactors({
            riskFactorId: id,
            RiskFactorsUpdateRequest: {
              status: status,
            },
          });
          await queryClient.invalidateQueries(['RISK_FACTORS_V8', selectedSection]);
          setUpdatedRiskFactor((prev) => ({ ...prev, [data.id]: data }));
          message.success(`Risk factor updated`);
        } catch (err) {
          message.fatal(`Unable to update the risk factor - Some parameters are missing`, err);
        }
      }
    },
    [isSimulation, api, queryClient, selectedSection],
  );

  const handleEditRiskFactor = useCallback(
    (entity: RiskFactor) => {
      if (entity.parameter) {
        actionRef.current?.expandRow(entity.id);
      } else {
        if (isSimulation) {
          navigate(
            makeUrl(`/risk-levels/risk-factors/simulation-mode/:key/:type/:id/edit`, {
              key: `${jobId ? jobId : 'new'}-${activeIterationIndex}`,
              type: selectedSection,
              id: entity.id,
            }),
            { replace: true },
          );
        } else {
          navigate(
            makeUrl(`/risk-levels/risk-factors/:type/:id/edit`, {
              type: selectedSection,
              id: entity.id,
            }),
            { replace: true },
          );
        }
      }
    },
    [navigate, selectedSection, isSimulation, jobId, activeIterationIndex],
  );

  const onActionsMenuClick = useCallback(
    (action: string, entity: RiskFactor) => {
      if (action === 'edit') {
        handleEditRiskFactor(entity);
      } else if (action === 'duplicate') {
        if (entity.parameter) {
          if (isSimulation) {
            const updatedRiskFactors = simulationRiskFactorsMap[
              scopeToRiskEntityType(selectedSection)
            ].map((rf) => rf);

            const newRiskFactor = {
              ...entity,
              id: `${entity.id} (Copy)`,
              name: `${entity.name} (Copy)`,
            };

            updatedRiskFactors.push(newRiskFactor);

            setSimulationRiskFactorsMap({
              ...simulationRiskFactorsMap,
              [scopeToRiskEntityType(selectedSection)]: updatedRiskFactors,
            });

            if (handleSimulationSave) {
              handleSimulationSave(updatedRiskFactors);
            }

            message.success('Risk factor duplicated');
          } else {
            const duplicateParameterRiskFactor = async () => {
              try {
                const hideSavingMessage = message.loading('Duplicating risk factor...');
                const newRiskFactor = await api.postCreateRiskFactor({
                  RiskFactorsPostRequest: {
                    parameter: entity.parameter as any,
                    type: entity.type,
                    status: 'ACTIVE',
                    name: `${entity.name} (Copy)`,
                    description: entity.description || '',
                    baseCurrency: entity.baseCurrency,
                    riskLevelAssignmentValues: entity.riskLevelAssignmentValues || [],
                    defaultRiskLevel: entity.defaultRiskLevel || 'LOW',
                    defaultWeight: entity.defaultWeight || 1,
                    defaultRiskScore: entity.defaultRiskScore || 0,
                    logicAggregationVariables: [],
                    logicEntityVariables: [],
                    riskLevelLogic: [],
                    isDerived: entity.isDerived || false,
                    riskFactorId: entity.id,
                  },
                });

                await queryClient.invalidateQueries(RISK_FACTORS_V8(selectedSection));

                hideSavingMessage();
                message.success(`Risk factor duplicated - ${newRiskFactor.id}`);
              } catch (err) {
                message.fatal(`Unable to duplicate the risk factor`, err);
              }
            };

            duplicateParameterRiskFactor();
          }
        } else {
          if (isSimulation) {
            navigate(
              makeUrl(`/risk-levels/risk-factors/simulation-mode/:key/:type/create`, {
                key: `${jobId ? jobId : 'new'}-${activeIterationIndex}`,
                type: selectedSection,
              }),
              {
                replace: true,
                state: {
                  prefill: {
                    ...entity,
                    name: `${entity.name} (Copy)`,
                  },
                },
              },
            );
          } else {
            navigate(
              makeUrl(`/risk-levels/risk-factors/:type/:id/duplicate`, {
                type: selectedSection,
                id: entity.id,
              }),
              { replace: true },
            );
          }
        }
      }
    },
    [
      handleEditRiskFactor,
      navigate,
      selectedSection,
      api,
      queryClient,
      isSimulation,
      simulationRiskFactorsMap,
      setSimulationRiskFactorsMap,
      handleSimulationSave,
      jobId,
      activeIterationIndex,
    ],
  );

  const columnHelper = new ColumnHelper<RiskFactor>();
  const columns: TableColumn<RiskFactor>[] = columnHelper.list([
    columnHelper.simple<'id'>({
      title: 'Risk factor ID',
      key: 'id',
      defaultWidth: 100,
      type: {
        render: (id, { item: entity }) => {
          return (
            <div className={s.idWithTag}>
              {entity.parameter ? (
                <Id onClick={() => actionRef.current?.expandRow(entity.id)}>{id}</Id>
              ) : (
                <Id
                  to={
                    isSimulation
                      ? makeUrl(`/risk-levels/risk-factors/simulation-mode/:key/:type/:id/read`, {
                          key: `${jobId ? jobId : 'new'}-${activeIterationIndex}`,
                          type: selectedSection,
                          id,
                        })
                      : makeUrl(`/risk-levels/risk-factors/:type/:id/read`, {
                          type: selectedSection,
                          id,
                        })
                  }
                >
                  {id}
                </Id>
              )}
              {!entity.parameter && (
                <Tag key={entity.id} color="blue">
                  Custom
                </Tag>
              )}
            </div>
          );
        },
      },
    }),
    columnHelper.simple<'name'>({
      title: 'Risk factor name',
      key: 'name',
      defaultWidth: 250,
      type: STRING,
    }),
    columnHelper.simple<'description'>({
      title: 'Risk factor description',
      key: 'description',
      type: STRING,
      defaultWidth: 300,
    }),
    columnHelper.simple<'updatedAt'>({
      title: 'Last updated at',
      key: 'updatedAt',
      type: DATE_TIME,
    }),
    columnHelper.derived<boolean>({
      id: 'enabled',
      title: 'Enabled',
      value: (row) => row.status === 'ACTIVE',
      defaultWidth: 70,
      type: {
        ...BOOLEAN,
        render: (_, { item: entity }) => {
          if (!entity.id) {
            return <></>;
          }

          if (isSimulation) {
            return (
              <RuleStatusSwitch
                entity={entity}
                isDisabled={!canWriteRiskFactors}
                type="RISK_FACTOR"
                onToggle={(checked) => {
                  const updatedRiskFactors = simulationRiskFactorsMap[
                    scopeToRiskEntityType(selectedSection)
                  ].map((riskFactor) => {
                    if (riskFactor.id === entity.id) {
                      return {
                        ...riskFactor,
                        status: checked ? 'ACTIVE' : ('INACTIVE' as RuleInstanceStatus),
                      };
                    }
                    return riskFactor;
                  });
                  setSimulationRiskFactorsMap({
                    ...simulationRiskFactorsMap,
                    [scopeToRiskEntityType(selectedSection)]: updatedRiskFactors,
                  });
                }}
              />
            );
          } else {
            const riskFactor = updatedRiskFactor[entity.id] || entity;
            return (
              <RuleStatusSwitch
                entity={riskFactor}
                type="RISK_FACTOR"
                onToggle={(checked) =>
                  handleActivationChangeMutation({
                    id: entity.id,
                    status: checked ? 'ACTIVE' : 'INACTIVE',
                  })
                }
              />
            );
          }
        },
      },
    }),
    columnHelper.display({
      id: 'actions',
      title: 'Action',
      defaultWidth: 250,
      enableResizing: false,
      render: (entity) => {
        return (
          <div className={s.actions}>
            {canWriteRiskFactors && (
              <Button
                icon={<EditOutlined />}
                size="MEDIUM"
                type="SECONDARY"
                onClick={() => handleEditRiskFactor(entity)}
                testName="risk-factor-edit-button"
              >
                Edit
              </Button>
            )}
            <ActionMenu
              entity={entity}
              onDuplicate={(entity) => onActionsMenuClick('duplicate', entity)}
              canWriteRiskFactors={canWriteRiskFactors}
            />
          </div>
        );
      },
    }),
  ]);

  const getRiskFactorsForSelectedSection = () => {
    return simulationRiskFactorsMap[scopeToRiskEntityType(selectedSection)];
  };

  const renderExpandedComponent = (entity: RiskFactor) => {
    if (isSimulation) {
      return (
        <div className={s.expandedRow}>
          <ValuesTable
            entity={entity}
            onSave={(updatedEntity) => {
              const updatedRiskFactors = simulationRiskFactorsMap[
                scopeToRiskEntityType(selectedSection)
              ].map((rf) => {
                if (rf.id === entity.id) {
                  return updatedEntity;
                }
                return rf;
              });
              setSimulationRiskFactorsMap({
                ...simulationRiskFactorsMap,
                [scopeToRiskEntityType(selectedSection)]: updatedRiskFactors,
              });
              if (handleSimulationSave) {
                handleSimulationSave(updatedRiskFactors);
              }
              message.success('Risk factor parameters updated successfully');
            }}
            canEditParameters={canWriteRiskFactors}
          />
        </div>
      );
    } else {
      return (
        <div className={s.expandedRow}>
          <ValuesTable
            entity={entity}
            onSave={(updatedEntity) => {
              if (handleSaveParameters) {
                handleSaveParameters({
                  values: updatedEntity.riskLevelAssignmentValues || [],
                  defaultRiskLevel: updatedEntity.defaultRiskLevel || 'LOW',
                  defaultWeight: updatedEntity.defaultWeight || 1,
                  defaultRiskScore: updatedEntity.defaultRiskScore || 0,
                  riskFactorId: updatedEntity.id,
                });
              }
            }}
            canEditParameters={canWriteRiskFactors}
          />
        </div>
      );
    }
  };

  const TableHeader = (
    <div className={s.header}>
      <SegmentedControl<ScopeSelectorValue>
        size="MEDIUM"
        active={selectedSection}
        onChange={(newValue) => {
          setSelectedSection(newValue);
        }}
        items={[
          { value: 'consumer', label: 'Consumer' },
          { value: 'business', label: 'Business' },
          { value: 'transaction', label: 'Transaction' },
        ]}
      />
      <Button
        size="MEDIUM"
        type="SECONDARY"
        onClick={() => {
          if (isSimulation) {
            navigate(
              makeUrl(`/risk-levels/risk-factors/simulation-mode/:key/:type/create`, {
                key: `${jobId ? jobId : 'new'}-${activeIterationIndex}`,
                type: selectedSection,
              }),
              { replace: true },
            );
          } else {
            const url = makeUrl(`/risk-levels/risk-factors/:type/create`, {
              type: selectedSection,
            });
            navigate(url, { replace: true });
          }
        }}
        isDisabled={!canWriteRiskFactors}
        testName="create-risk-factor-button"
      >
        {isSimulation ? 'Simulate risk factor' : 'Custom risk factor'}
      </Button>
    </div>
  );

  return (
    <Card.Root>
      <Card.Section>
        {TableHeader}

        {isSimulation ? (
          <Table<RiskFactor>
            rowKey="id"
            tableId={`custom-risk-factors-${selectedSection}`}
            innerRef={actionRef}
            data={{ items: getRiskFactorsForSelectedSection() }}
            columns={columns}
            pagination={false}
            toolsOptions={false}
            isExpandable={(row) => 'parameter' in row.content && !!row.content.parameter}
            renderExpanded={renderExpandedComponent}
          />
        ) : (
          <QueryResultsTable<RiskFactor>
            rowKey="id"
            tableId={`custom-risk-factors-${selectedSection}`}
            innerRef={actionRef}
            queryResults={queryResults}
            columns={columns}
            pagination={false}
            toolsOptions={false}
            isExpandable={(row) => 'parameter' in row.content && !!row.content.parameter}
            renderExpanded={renderExpandedComponent}
          />
        )}
      </Card.Section>
    </Card.Root>
  );
}
