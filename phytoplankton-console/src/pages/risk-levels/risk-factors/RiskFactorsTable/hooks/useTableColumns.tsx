import { useCallback, useMemo } from 'react';
import { EditOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router';
import { useAtom } from 'jotai';
import s from '../styles.module.less';
import { ScopeSelectorValue, scopeToRiskEntityType } from '../utils';
import { useOnMenuClick } from './useOnMenusClick';
import { riskFactorsAtom, riskFactorsEditEnabled, useTempRiskFactors } from '@/store/risk-factors';
import { makeUrl } from '@/utils/routing';
import { TableColumn, TableRefType } from '@/components/library/Table/types';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { BOOLEAN, DATE_TIME, STRING } from '@/components/library/Table/standardDataTypes';
import { RuleStatusSwitch } from '@/pages/rules/components/RuleStatusSwitch';
import Id from '@/components/ui/Id';
import Tag from '@/components/library/Tag';
import ActionMenu from '@/pages/risk-levels/risk-factors/components/ActionMenu';
import Button from '@/components/library/Button';
import { RiskFactor, RuleInstanceStatus } from '@/apis';
import { useHasResources } from '@/utils/user-utils';
import { useBulkRerunUsersStatus } from '@/utils/batch-rerun-users';

interface UseTableColumnsProps {
  actionRef: React.RefObject<TableRefType>;
  jobId?: string;
  activeIterationIndex?: number;
  selectedSection: ScopeSelectorValue;
  mode: 'simulation' | 'normal' | 'version-history';
  handleSimulationSave: (riskFactors: RiskFactor[]) => void;
}

export function useTableColumns({
  mode,
  actionRef,
  jobId,
  activeIterationIndex = 1,
  selectedSection,
  handleSimulationSave,
}: UseTableColumnsProps) {
  const canWriteRiskFactors = useHasResources(['write:::risk-scoring/risk-factors/*']);
  const isSimulation = mode === 'simulation';
  const navigate = useNavigate();
  const [riskFactors, setRiskFactors] = useAtom(riskFactorsAtom);
  const riskScoringRerun = useBulkRerunUsersStatus();
  const [isEditEnabled] = useAtom(riskFactorsEditEnabled);

  const { simulationRiskFactorsMap, setSimulationRiskFactorsMap } = useTempRiskFactors({
    riskFactors: [],
    simulationStorageKey: `${jobId ?? 'new'}-${activeIterationIndex}`,
    isSimulation: true,
  });

  const handleEditRiskFactor = useCallback(
    (entity: RiskFactor) => {
      if (entity.parameter) {
        actionRef.current?.expandRow(entity.id);
      } else {
        if (isSimulation) {
          navigate(
            makeUrl(`/risk-levels/risk-factors/simulation-mode/:key/:type/:id/edit`, {
              key: `${jobId ?? 'new'}-${activeIterationIndex}`,
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
    [navigate, selectedSection, isSimulation, jobId, activeIterationIndex, actionRef],
  );

  const { onActionsMenuClick } = useOnMenuClick(
    handleEditRiskFactor,
    mode,
    selectedSection,
    jobId ?? 'new',
    activeIterationIndex,
    handleSimulationSave,
  );

  const columns: TableColumn<RiskFactor>[] = useMemo(() => {
    const columnHelper = new ColumnHelper<RiskFactor>();

    return columnHelper.list([
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
              const riskFactor = riskFactors.getById(entity.id) || entity;
              return (
                <RuleStatusSwitch
                  entity={riskFactor}
                  type="RISK_FACTOR"
                  isDisabled={!isEditEnabled || mode === 'version-history'}
                  onToggle={(checked) => {
                    setRiskFactors({ ...riskFactor, status: checked ? 'ACTIVE' : 'INACTIVE' });
                  }}
                />
              );
            }
          },
        },
      }),
      ...(mode !== 'version-history'
        ? [
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
                        isDisabled={!isEditEnabled || riskScoringRerun.data.isAnyJobRunning}
                      >
                        Edit
                      </Button>
                    )}
                    <ActionMenu
                      entity={entity}
                      onDuplicate={(entity) => onActionsMenuClick('duplicate', entity)}
                      canWriteRiskFactors={canWriteRiskFactors && isEditEnabled}
                    />
                  </div>
                );
              },
            }),
          ]
        : []),
    ]);
  }, [
    riskFactors,
    setRiskFactors,
    canWriteRiskFactors,
    isSimulation,
    selectedSection,
    handleEditRiskFactor,
    actionRef,
    jobId,
    activeIterationIndex,
    simulationRiskFactorsMap,
    setSimulationRiskFactorsMap,
    onActionsMenuClick,
    isEditEnabled,
    riskScoringRerun.data.isAnyJobRunning,
    mode,
  ]);

  return columns;
}
