import React, { useState } from 'react';
import cn from 'clsx';
import { Currency } from '@flagright/lib/constants';
import { capitalizeWords } from '@flagright/lib/utils/humanize';
import Legend from '../components/Legend';
import s from './styles.module.less';
import Pie, { Data as PieData } from './Pie';
import COLORS from '@/components/ui/colors';
import ContainerWidthMeasure from '@/components/utils/ContainerWidthMeasure';
import { QueryResult } from '@/utils/queries/types';
import { TransactionsStatsByTypesResponseData, TransactionType } from '@/apis';
import { neverReturn } from '@/utils/lang';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import NoData from '@/pages/case-management-item/CaseDetails/InsightsCard/components/NoData';

interface Props {
  currency: Currency | null;
  queryResult: QueryResult<TransactionsStatsByTypesResponseData[]>;
}

export default function AmountsChart(props: Props) {
  const { queryResult, currency } = props;

  const [highlighted, setHighlighted] = useState<string | null>(null);

  return (
    <AsyncResourceRenderer resource={queryResult.data}>
      {(result) => {
        if (result.length === 0) {
          return <NoData />;
        }
        const data: PieData = result.map((x) => ({
          category:
            x.transactionType == null
              ? '(unknown)'
              : capitalizeWords(x.transactionType as TransactionType),
          value: currency === null ? x.count : x.sum ?? 0,
          color: getTransactionTypeColor(x.transactionType as TransactionType),
        }));
        return (
          <div className={cn(s.root)}>
            <ContainerWidthMeasure>
              {(width) => (
                <div className={s.pieContainer} style={{ height: Math.min(width, 400) }}>
                  <div className={s.pieWrapper}>
                    <Pie
                      currency={currency}
                      diameter={Math.min(width, 400)}
                      data={data}
                      highlighted={highlighted}
                      onChangeHighlighted={setHighlighted}
                    />
                  </div>
                </div>
              )}
            </ContainerWidthMeasure>

            <Legend data={data} highlighted={highlighted} onChangeHighlighted={setHighlighted} />
          </div>
        );
      }}
    </AsyncResourceRenderer>
  );
}

// todo: generalize
export function getTransactionTypeColor(transactionType: TransactionType | undefined): string {
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
  } else if (transactionType === 'OTHER') {
    return COLORS.purpleGray.shade;
  } else if (transactionType == null) {
    return COLORS.turquoise.tint;
  }
  return neverReturn(transactionType, 'gray');
}
