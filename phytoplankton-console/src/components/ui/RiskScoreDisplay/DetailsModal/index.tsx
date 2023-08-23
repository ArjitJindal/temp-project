import React from 'react';
import cn from 'clsx';
import MainPanel from '../MainPanel';
import s from './index.module.less';
import { columns, TableRow } from './consts';
import { findParameter } from './helpers';
import Modal from '@/components/library/Modal';
import { ValueItem } from '@/components/ui/RiskScoreDisplay/types';
import Table from '@/components/library/Table';
import { RiskScoreComponent } from '@/apis';
import { ParameterName } from '@/pages/risk-levels/risk-factors/ParametersTable/types';

interface Props {
  icon: React.ReactNode;
  isOpen: boolean;
  onCancel: () => void;
  title: string;
  values: ValueItem[];
  components?: Array<RiskScoreComponent>;
  riskScoreName: string;
  showFormulaBackLink?: boolean;
}

const VARIABLES = [
  ...new Array(('z'.codePointAt(0) as number) - ('a'.codePointAt(0) as number) + 1),
].map((_, i) => String.fromCodePoint(('a'.codePointAt(0) as number) + i));

export default function DetailsModal(props: Props) {
  const { icon, title, isOpen, values, onCancel, components, riskScoreName, showFormulaBackLink } =
    props;
  const explanationText = riskScoreName || 'TRS';
  return (
    <Modal title={title} hideFooter={true} isOpen={isOpen} onCancel={onCancel} width="M">
      <div className={cn(s.root)}>
        <div className={s.header}>
          <MainPanel icon={icon} title={title} values={values} />
          {components && (
            <div className={s.formulaWrapper}>
              <div className={s.formula}>
                {`The following factors are used in calculating ${explanationText} :`}
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
                      {i + 1}. {parameterDescription?.title ?? parameter} risk
                    </React.Fragment>
                  );
                })}
              </div>
              {showFormulaBackLink ? (
                <div className={s.formulaLink}>
                  {`The complete formula for calculating ${explanationText} is `}
                  <a href="/risk-levels/risk-algorithms"> here</a>
                </div>
              ) : (
                <></>
              )}
            </div>
          )}
        </div>
        {components && (
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
                  parameter: component.parameter as ParameterName,
                  value: component.value,
                  riskScore: component.score,
                  riskLevel: component.riskLevel,
                })),
              }}
              columns={columns}
            />
          </div>
        )}
      </div>
    </Modal>
  );
}
