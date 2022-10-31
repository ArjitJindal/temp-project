import React from 'react';
import cn from 'clsx';
import Legend from '../components/Legend';
import s from './styles.module.less';
import Chart from './Chart';
import COLORS from '@/components/ui/colors';
import { QueryResult } from '@/utils/queries/types';
import { TransactionsStatsByTypesResponseData, TransactionType } from '@/apis';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
import { humanizeCamelCase } from '@/utils/tags';
import { Currency } from '@/utils/currencies';
import NoData from '@/pages/case-management-item/UserCaseDetails/InsightsCard/components/NoData';

const CHART_COLORS = {
  maximum: COLORS.purpleGray.tint,
  minimum: COLORS.turquoise.base,
  average: COLORS.purple.base,
  median: COLORS.navyBlue.base,
};

export type Data = {
  [key in TransactionType]: {
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
              <Chart
                data={response.map((x) => ({
                  title:
                    x.transactionType != null
                      ? humanizeCamelCase(x.transactionType as TransactionType)
                      : '(unknown)',
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
