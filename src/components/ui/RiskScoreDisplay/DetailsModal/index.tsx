import React from 'react';
import cn from 'clsx';
import MainPanel from '../MainPanel';
import s from './index.module.less';
import Modal from '@/components/ui/Modal';
import { ValueItem } from '@/components/ui/RiskScoreDisplay/types';
import Table from '@/components/ui/Table';
import { RiskLevel } from '@/utils/risk-levels';
import RiskLevelTag from '@/components/library/RiskLevelTag';
import { RiskEntityType, RiskScoreComponent } from '@/apis';
import { ALL_RISK_PARAMETERS } from '@/pages/risk-levels/risk-factors/ParametersTable/consts';
import {
  Entity,
  ParameterName,
  RiskLevelTableItem,
} from '@/pages/risk-levels/risk-factors/ParametersTable/types';
import {
  PARAMETER_RENDERERS,
  DEFAULT_RENDERER,
} from '@/components/ui/RiskScoreDisplay/DetailsModal/helpers';

interface TableRow {
  entityType: Entity;
  parameter: ParameterName;
  value: unknown;
  riskScore: number;
  riskLevel: RiskLevel;
}

interface Props {
  icon: React.ReactNode;
  isOpen: boolean;
  onCancel: () => void;
  title: string;
  values: ValueItem[];
  components?: Array<RiskScoreComponent>;
}

const VARIABLES = [
  ...new Array(('z'.codePointAt(0) as number) - ('a'.codePointAt(0) as number) + 1),
].map((_, i) => String.fromCodePoint(('a'.codePointAt(0) as number) + i));

export default function DetailsModal(props: Props) {
  const { icon, title, isOpen, values, onCancel, components } = props;
  return (
    <Modal title={title} hideFooter={true} isOpen={isOpen} onCancel={onCancel}>
      <div className={cn(s.root)}>
        <div className={s.header}>
          <MainPanel icon={icon} title={title} values={values} />
          {components && (
            <div className={s.formulaWrapper}>
              <div className={s.formula}>
                {`TRS = avg [ ${components.map((x, i) => VARIABLES[i]).join(' + ')} ]`}
              </div>
              <div className={s.formulaLegend}>
                {components.map(({ entityType, parameter }, i) => {
                  const parameterDescription = findParameter(
                    entityType,
                    parameter as ParameterName,
                  );
                  const variable = VARIABLES[i];
                  return (
                    <React.Fragment key={variable}>
                      {i > 0 && <br />}
                      {variable}: {parameterDescription?.title ?? parameter} risk
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        {components && (
          <div className={s.table}>
            <Table<TableRow>
              rowKey={'parameter'}
              pagination={false}
              disableInternalPadding={true}
              options={{
                reload: false,
                density: false,
                setting: false,
              }}
              data={{
                total: components.length,
                items: components.map((component) => ({
                  entityType: component.entityType,
                  parameter: component.parameter as ParameterName,
                  value: component.value,
                  riskScore: component.score,
                  riskLevel: component.riskLevel,
                })),
              }}
              columns={[
                {
                  title: 'Risk factor',
                  key: 'riskFactor',
                  render: (_, { parameter, entityType }) => {
                    const parameterDescription = findParameter(entityType, parameter);
                    return <>{parameterDescription?.title ?? parameter}</>;
                  },
                },
                {
                  title: 'Value',
                  key: 'value',
                  render: (_, entity) => {
                    const { entityType, parameter, value } = entity;
                    if (value == null) {
                      return <>-</>;
                    }
                    const parameterDescription = findParameter(entityType, parameter);
                    if (parameterDescription == null) {
                      return <>{JSON.stringify(value)}</>;
                    }
                    const valueRenderer =
                      PARAMETER_RENDERERS[parameterDescription.dataType] ?? DEFAULT_RENDERER;
                    return <>{valueRenderer(value)}</>;
                  },
                },
                {
                  title: 'Risk score',
                  key: 'riskScore',
                  render: (_, entity) => <>{entity.riskScore}</>,
                },
                {
                  title: 'Risk level',
                  key: 'riskLevel',
                  render: (_, entity) => <RiskLevelTag level={entity.riskLevel} />,
                },
              ]}
            />
          </div>
        )}
      </div>
    </Modal>
  );
}

function findParameter(
  entity: RiskEntityType,
  parameter: ParameterName,
): RiskLevelTableItem | null {
  const parameterDescription = ALL_RISK_PARAMETERS.find(
    (x) => x.entity === entity && x.parameter === parameter,
  );
  return parameterDescription ?? null;
}
