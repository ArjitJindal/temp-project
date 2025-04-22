import React from 'react';
import { ValueItem } from '../../../types';
import { columns, TableRow, VARIABLES } from '../../consts';
import { findParameter } from '../../helpers';
import MainPanel from '../../../MainPanel';
import s from './styles.module.less';
import Table from '@/components/library/Table';
import { RiskScoreComponent } from '@/apis/models/RiskScoreComponent';
import { RiskFactorParameter } from '@/apis';

interface Props {
  icon: React.ReactNode;
  title: string;
  components: Array<RiskScoreComponent>;
  riskScoreName: string;
  showFormulaBackLink?: boolean;
  riskScoreAlgo: (value: ValueItem) => number;
  lastItem: ValueItem;
  sortedItems: ValueItem[];
}

function V2ModalDetails(props: Props) {
  const {
    icon,
    title,
    components,
    riskScoreName,
    showFormulaBackLink,
    riskScoreAlgo,
    lastItem,
    sortedItems,
  } = props;
  const explanationText = riskScoreName || 'TRS';
  return (
    <div>
      <div className={s.header}>
        <MainPanel
          icon={icon}
          title={title}
          lastItem={lastItem}
          riskScoreAlgo={riskScoreAlgo}
          sortedItems={sortedItems}
        />
        {
          <div className={s.formulaWrapper}>
            <div className={s.formula}>
              {`The following factors are used in calculating ${explanationText} :`}
            </div>
            <div className={s.formulaLegend}>
              {components.map((component, i) => {
                const parameterDescription = findParameter(
                  component.entityType,
                  component.parameter as RiskFactorParameter,
                );
                return (
                  <React.Fragment key={VARIABLES[i]}>
                    {i > 0 && <br />}
                    {i + 1}. {parameterDescription?.title ?? component.parameter} risk
                  </React.Fragment>
                );
              })}
            </div>
            {showFormulaBackLink && (
              <div className={s.formulaLink}>
                {`The complete formula for calculating ${explanationText} is `}
                <a href="/risk-levels/risk-algorithms"> here</a>
              </div>
            )}
          </div>
        }
      </div>
      <V2RiskBreakDownTable components={components} />
    </div>
  );
}

export interface V2RiskBreakDownTableProps {
  components: Array<RiskScoreComponent>;
}

export function V2RiskBreakDownTable(props: V2RiskBreakDownTableProps) {
  const { components } = props;
  return (
    <div className={s.table}>
      <Table<TableRow>
        rowKey={'parameter'}
        sizingMode="FULL_WIDTH"
        pagination={false}
        toolsOptions={false}
        data={{
          total: components.length,
          items: components.map((component) => ({
            entityType: component.entityType,
            parameter: component.parameter as RiskFactorParameter,
            value: component.value,
            riskScore: component.score,
            weight: component.weight,
            riskLevel: component.riskLevel,
          })),
        }}
        columns={columns}
      />
    </div>
  );
}

export default V2ModalDetails;
