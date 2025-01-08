import React from 'react';
import { keyBy } from 'lodash';
import MainPanel from '../../../MainPanel';
import { ValueItem } from '../../../types';
import { v8Columns, V8TableRow, VARIABLES } from '../../consts';
import s from './styles.module.less';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { RISK_FACTORS_V8 } from '@/utils/queries/keys';
import { getOr } from '@/utils/asyncResource';
import { RiskFactorScoreDetails } from '@/apis/models/RiskFactorScoreDetails';
import Table from '@/components/library/Table';

interface Props {
  icon: React.ReactNode;
  title: string;
  factorScoreDetails: Array<RiskFactorScoreDetails>;
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
  } = props;
  const api = useApi();
  const queryResult = useQuery(RISK_FACTORS_V8(), async () => {
    return await api.getAllRiskFactors();
  });
  const v8FactorData = getOr(queryResult.data, []);
  const factorMap = keyBy(v8FactorData, 'id');
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
      <div className={s.table}>
        <Table<V8TableRow>
          rowKey={'id'}
          sizingMode="FULL_WIDTH"
          pagination={false}
          toolsOptions={false}
          data={{
            total: factorScoreDetails.length,
            items: factorScoreDetails.map((scoreDetail) => ({
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
  );
}

export default V8ModalDetails;
