import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import DeleteOutlined from '@ant-design/icons/lib/icons/DeleteOutlined';
import EditOutlined from '@ant-design/icons/lib/icons/EditOutlined';
import { useLocalStorageState } from 'ahooks';
import s from './styles.module.less';
import { makeUrl } from '@/utils/routing';
import { RiskFactor, RuleInstanceStatus } from '@/apis';
import { useHasPermissions } from '@/utils/user-utils';
import Button from '@/components/library/Button';
import Table from '@/components/library/Table';
import SegmentedControl from '@/components/library/SegmentedControl';
import Confirm from '@/components/utils/Confirm';
import { BOOLEAN, DATE_TIME, STRING } from '@/components/library/Table/standardDataTypes';
import Id from '@/components/ui/Id';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { TableColumn, TableRefType } from '@/components/library/Table/types';
import { RuleStatusSwitch } from '@/pages/rules/components/RuleStatusSwitch';

interface Props {
  riskFactors?: RiskFactor[];
  canEditRiskFactors: boolean;
  activeIterationIndex: number;
  jobId?: string;
}

export interface RiskFactorsTypeMap {
  CONSUMER_USER: RiskFactor[];
  BUSINESS: RiskFactor[];
  TRANSACTION: RiskFactor[];
}

export const scopeToRiskEntityType = (scope: ScopeSelectorValue) => {
  switch (scope) {
    case 'consumer':
      return 'CONSUMER_USER';
    case 'business':
      return 'BUSINESS';
    case 'transaction':
      return 'TRANSACTION';
  }
};

export const LocalStorageKey = 'risk-factors-simulation';

type ScopeSelectorValue = 'consumer' | 'business' | 'transaction';
export default function SimulationCustomRiskFactorsTable(props: Props) {
  const { canEditRiskFactors = true, activeIterationIndex, riskFactors, jobId } = props;
  const [simulationRiskFactorsMap, setSimulationRiskFactorsMap] =
    useLocalStorageState<RiskFactorsTypeMap>(
      `${LocalStorageKey}-${jobId ? `${jobId}` : 'new'}-${activeIterationIndex}`,
      {
        CONSUMER_USER: [],
        BUSINESS: [],
        TRANSACTION: [],
      },
    );

  useEffect(() => {
    if (
      riskFactors &&
      simulationRiskFactorsMap.CONSUMER_USER.length === 0 &&
      simulationRiskFactorsMap.BUSINESS.length === 0 &&
      simulationRiskFactorsMap.TRANSACTION.length === 0
    ) {
      const initialRiskFactorsMap: RiskFactorsTypeMap = riskFactors.reduce(
        (acc, riskFactor) => {
          acc[riskFactor.type].push(riskFactor);
          return acc;
        },
        {
          CONSUMER_USER: [],
          BUSINESS: [],
          TRANSACTION: [],
        } as RiskFactorsTypeMap,
      );
      setSimulationRiskFactorsMap(initialRiskFactorsMap);
    }
  }, [riskFactors, simulationRiskFactorsMap, setSimulationRiskFactorsMap]);

  const [selectedSection, setSelectedSection] = useState<ScopeSelectorValue>('consumer');
  const canWriteRiskFactors =
    useHasPermissions(['risk-scoring:risk-factors:write']) && canEditRiskFactors;
  const navigate = useNavigate();
  const actionRef = useRef<TableRefType>(null);
  const columnHelper = new ColumnHelper<RiskFactor>();
  const columns: TableColumn<RiskFactor>[] = columnHelper.list([
    columnHelper.simple<'id'>({
      title: 'Risk factor ID',
      key: 'id',
      type: {
        render: (id) => {
          return (
            <Id
              to={makeUrl(`/risk-levels/custom-risk-factors/simulation-mode/:key/:type/:id/read`, {
                key: `${jobId ? jobId : 'new'}-${activeIterationIndex}`,
                type: selectedSection,
                id,
              })}
            >
              {id}
            </Id>
          );
        },
      },
    }),
    columnHelper.simple<'name'>({
      title: 'Risk factor name',
      key: 'name',
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
      defaultSticky: 'RIGHT',
      value: (row) => row.status === 'ACTIVE',
      defaultWidth: 70,
      type: {
        ...BOOLEAN,
        render: (_, { item: entity }) => {
          if (!entity.id) {
            return <></>;
          }
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
        },
      },
    }),
    columnHelper.display({
      id: 'actions',
      title: 'Action',
      defaultSticky: 'RIGHT',
      defaultWidth: 250,
      enableResizing: false,
      render: (entity) => {
        return (
          <div className={s.actionIconsContainer}>
            <Button
              onClick={() => {
                navigate(
                  makeUrl(`/risk-levels/custom-risk-factors/simulation-mode/:key/:type/:id/edit`, {
                    key: `${jobId ? jobId : 'new'}-${activeIterationIndex}`,
                    type: selectedSection,
                    id: entity.id,
                  }),
                  { replace: true },
                );
              }}
              icon={<EditOutlined />}
              size="MEDIUM"
              type="SECONDARY"
              isDisabled={!canWriteRiskFactors}
              testName="risk-factor-edit-button"
            >
              Edit
            </Button>
            <Confirm
              title={`Are you sure you want to delete this ${entity.id} ${entity.name} risk factor?`}
              text="Please confirm that you want to delete this risk factor. This action cannot be undone."
              onConfirm={() => {
                if (canWriteRiskFactors && entity.id) {
                  const updatedRiskFactors = simulationRiskFactorsMap[
                    scopeToRiskEntityType(selectedSection)
                  ].filter((riskFactor) => riskFactor.id !== entity.id);
                  setSimulationRiskFactorsMap({
                    ...simulationRiskFactorsMap,
                    [scopeToRiskEntityType(selectedSection)]: updatedRiskFactors,
                  });
                }
              }}
            >
              {({ onClick }) => (
                <Button
                  onClick={onClick}
                  icon={<DeleteOutlined />}
                  size="MEDIUM"
                  type="SECONDARY"
                  isDisabled={!canWriteRiskFactors}
                  testName="risk-factor-delete-button"
                >
                  Delete
                </Button>
              )}
            </Confirm>
          </div>
        );
      },
    }),
  ]);
  return (
    <div>
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
        {canEditRiskFactors && (
          <Button
            size="MEDIUM"
            type="SECONDARY"
            onClick={() => {
              navigate(
                makeUrl(`/risk-levels/custom-risk-factors/simulation-mode/:key/:type/create`, {
                  key: `${jobId ? jobId : 'new'}-${activeIterationIndex}`,
                  type: selectedSection,
                }),
                { replace: true },
              );
            }}
            isDisabled={!canWriteRiskFactors}
          >
            Create risk factor
          </Button>
        )}
      </div>
      <Table<RiskFactor>
        rowKey="id"
        tableId={`custom-risk-factors-${selectedSection}`}
        innerRef={actionRef}
        data={{ items: simulationRiskFactorsMap[scopeToRiskEntityType(selectedSection)] }}
        columns={columns}
        pagination={false}
        toolsOptions={false}
      />
    </div>
  );
}
