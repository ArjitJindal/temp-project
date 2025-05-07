import React from 'react';
import cn from 'clsx';
import { sumBy } from 'lodash';
import { Currency } from '@flagright/lib/constants';
import { capitalizeWords } from '@flagright/lib/utils/humanize';
import Legend from '../components/Legend';
import s from './styles.module.less';
import Chart from './Chart';
import COLORS from '@/components/ui/colors';
import { QueryResult } from '@/utils/queries/types';
import { TransactionsStatsByTypesResponseData } from '@/apis';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import NoData from '@/pages/case-management-item/CaseDetails/InsightsCard/components/NoData';
import Money from '@/components/ui/Money';

const CHART_COLORS = {
  maximum: COLORS.purpleGray.tint,
  minimum: COLORS.turquoise.base,
  average: COLORS.purple.base,
  median: COLORS.navyBlue.base,
};

export type Data = {
  [key in string]: {
    min?: number;
    max?: number;
    average?: number;
    median?: number;
  };
};

interface Props {
  queryResult: QueryResult<TransactionsStatsByTypesResponseData[]>;
  currency: Currency;
}

export default function AmountsChart(props: Props) {
  const { currency } = props;
  return (
    <div className={cn(s.root)}>
      <AsyncResourceRenderer resource={props.queryResult.data}>
        {(response) => {
          if (response.length === 0) {
            return <NoData />;
          }
          return (
            <>
              <div className={s.amountCard}>
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div>
                    <b>Cumulative transaction amount</b>
                  </div>
                  <div>
                    <Money value={sumBy(response, (x) => x?.sum ?? 0)} currency={currency} />
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div>
                    <b>Total no. of Transactions</b>
                  </div>
                  <div>{sumBy(response, (x) => x.count)?.toLocaleString()}</div>
                </div>
              </div>
              <Chart
                data={response.map((x) => ({
                  title:
                    x.transactionType != null ? capitalizeWords(x.transactionType) : '(unknown)',
                  maximum: x.max,
                  minimum: x.min,
                  average: x.average,
                  median: x.median,
                }))}
                colors={CHART_COLORS}
                currency={currency}
              />
              <Legend
                data={[
                  { category: 'Maximum', color: CHART_COLORS.maximum },
                  { category: 'Minimum', color: CHART_COLORS.minimum },
                  { category: 'Average', color: CHART_COLORS.average },
                  { category: 'Median', color: CHART_COLORS.median },
                ]}
              />
            </>
          );
        }}
      </AsyncResourceRenderer>
    </div>
  );
}
