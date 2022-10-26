import React from 'react';
import cn from 'clsx';
import Legend from '../components/Legend';
import s from './styles.module.less';
import Pie, { Data as PieData } from './Pie';
import COLORS from '@/components/ui/colors';
import ContainerWidthMeasure from '@/components/utils/ContainerWidthMeasure';
import { QueryResult } from '@/utils/queries/types';
import { TransactionsStatsByTypesResponseData, TransactionType } from '@/apis';
import { neverReturn } from '@/utils/lang';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
import { humanizeCamelCase } from '@/utils/tags';

interface Props {
  queryResult: QueryResult<TransactionsStatsByTypesResponseData[]>;
}

export default function AmountsChart(props: Props) {
  const { queryResult } = props;

  return (
    <AsyncResourceRenderer resource={queryResult.data}>
      {(result) => {
        const data: PieData = result.map((x) => ({
          category: humanizeCamelCase(x.transactionType),
          value: x.count,
          color: getTransactionTypeColor(x.transactionType),
        }));
        return (
          <div className={cn(s.root)}>
            <ContainerWidthMeasure>
              {(width) => (
                <div className={s.pieContainer} style={{ height: Math.min(width, 400) }}>
                  <div className={s.pieWrapper}>
                    <Pie diameter={Math.min(width, 400)} data={data} />
                  </div>
                </div>
              )}
            </ContainerWidthMeasure>

            <Legend data={data} />
          </div>
        );
      }}
    </AsyncResourceRenderer>
  );
}

export function getTransactionTypeColor(transactionType: TransactionType): string {
  if (transactionType === 'DEPOSIT') {
    return COLORS.brandBlue.base;
  } else if (transactionType === 'EXTERNAL_PAYMENT') {
    return COLORS.navyBlue.base;
  } else if (transactionType === 'WITHDRAWAL') {
    return COLORS.purpleGray.tint;
  } else if (transactionType === 'REFUND') {
    return COLORS.purpleGray.base;
  } else if (transactionType === 'TRANSFER') {
    return COLORS.purpleGray.shade;
  }
  return neverReturn(transactionType, 'gray');
}
