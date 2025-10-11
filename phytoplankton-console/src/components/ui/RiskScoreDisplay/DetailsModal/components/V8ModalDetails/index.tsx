import React from 'react';
import MainPanel from '../../../MainPanel';
import { ValueItem } from '../../../types';
import { v8Columns, V8TableRow, VARIABLES } from '../../consts';
import { V2RiskBreakDownTable } from '../V2ModalDetails';
import s from './styles.module.less';
import { RiskFactorScoreDetails } from '@/apis/models/RiskFactorScoreDetails';
import Table from '@/components/library/Table';
import { useAllRiskFactorsMap } from '@/hooks/api';
import { RiskScoreComponent } from '@/apis';
import { H4 } from '@/components/ui/Typography';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';

interface Props {
  icon: React.ReactNode;
  title: string;
  factorScoreDetails: Array<RiskFactorScoreDetails>;
  components?: Array<RiskScoreComponent>;
  riskScoreName: string;
  showFormulaBackLink?: boolean;
  riskScoreAlgo: (value: ValueItem) => number;
  lastItem: ValueItem;
  sortedItems: ValueItem[];
  isExternalSource?: boolean;
}

function V8ModalDetails(props: Props) {
  const {
    icon,
    title,
    factorScoreDetails,
    riskScoreName,
    showFormulaBackLink,
    riskScoreAlgo,
    lastItem,
    sortedItems,
    isExternalSource,
    components,
  } = props;
  const factorMap = useAllRiskFactorsMap();
  const explanationText = riskScoreName || 'TRS';
  const v8FactorScoreDetails = factorScoreDetails.filter((val) =>
    val.riskFactorId.startsWith('RF'),
  );
  return (
    <AsyncResourceRenderer resource={factorMap.data}>
      {(factorMap) => (
        <div>
          <div className={s.header}>
            <MainPanel
              icon={icon}
              title={title}
              lastItem={lastItem}
              riskScoreAlgo={riskScoreAlgo}
              sortedItems={sortedItems}
              {...(isExternalSource && { isExternalSource: true })}
            />
            {
              <div className={s.formulaWrapper}>
                <div className={s.formula}>
                  {`The following factors are used in calculating ${explanationText} :`}
                </div>
                <div className={s.formulaLegend}>
                  {factorScoreDetails.map((val, i) => {
                    const name = factorMap[val.riskFactorId]?.name;
                    return (
                      <React.Fragment key={VARIABLES[i]}>
                        {i > 0 && <br />}
                        {i + 1}. {name}
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
          {components && components.length > 0 && <V2RiskBreakDownTable components={components} />}
          {v8FactorScoreDetails && v8FactorScoreDetails.length > 0 && (
            <div className={s.customTable}>
              <H4>Custom risk factors breakdown </H4>
              <div className={s.table}>
                <Table<V8TableRow>
                  rowKey={'id'}
                  sizingMode="FULL_WIDTH"
                  pagination={false}
                  toolsOptions={false}
                  data={{
                    total: v8FactorScoreDetails.length,
                    items: v8FactorScoreDetails
                      .filter((scoreDetail) => {
                        const rf = factorMap[scoreDetail.riskFactorId];
                        const isDefault = !!rf?.parameter;
                        return !isDefault;
                      })
                      .map((scoreDetail) => ({
                        id: scoreDetail.riskFactorId,
                        name: factorMap[scoreDetail.riskFactorId]?.name,
                        riskScore: scoreDetail.score,
                        riskLevel: scoreDetail.riskLevel,
                        weight: scoreDetail.weight,
                      })),
                  }}
                  columns={v8Columns}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </AsyncResourceRenderer>
  );
}

export default V8ModalDetails;
