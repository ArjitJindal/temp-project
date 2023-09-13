import React, { useState } from 'react';
import { RangeValue } from 'rc-picker/es/interface';
import {
  COLORS_V2_ANALYTICS_CHARTS_09,
  COLORS_V2_ANALYTICS_CHARTS_11,
  COLORS_V2_ANALYTICS_CHARTS_15,
  COLORS_V2_ANALYTICS_CHARTS_16,
  COLORS_V2_ANALYTICS_CHARTS_17,
  COLORS_V2_ANALYTICS_CHARTS_18,
  COLORS_V2_ANALYTICS_CHARTS_19,
  COLORS_V2_ANALYTICS_CHARTS_20,
  COLORS_V2_ANALYTICS_CHARTS_22,
} from '@/components/ui/colors';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { DASHBOARD_TRANSACTIONS_TOTAL_STATS } from '@/utils/queries/keys';
import Widget from '@/components/library/Widget';
import { WidgetProps } from '@/components/library/Widget/types';
import { getPaymentMethodTitle, PAYMENT_METHODS, PaymentMethod } from '@/utils/payments';
import { isSuccess, map } from '@/utils/asyncResource';
import Treemap, {
  TreemapData,
  TreemapItem,
} from '@/pages/dashboard/analysis/components/charts/Treemap';
import DatePicker from '@/components/ui/DatePicker';
import { dayjs, Dayjs } from '@/utils/dayjs';

const TREEMAP_COLORS: { [key in PaymentMethod]: string } = {
  ACH: COLORS_V2_ANALYTICS_CHARTS_22,
  CARD: COLORS_V2_ANALYTICS_CHARTS_17,
  WALLET: COLORS_V2_ANALYTICS_CHARTS_16,
  GENERIC_BANK_ACCOUNT: COLORS_V2_ANALYTICS_CHARTS_15,
  UPI: COLORS_V2_ANALYTICS_CHARTS_19,
  IBAN: COLORS_V2_ANALYTICS_CHARTS_18,
  SWIFT: COLORS_V2_ANALYTICS_CHARTS_20,
  MPESA: COLORS_V2_ANALYTICS_CHARTS_09,
  CHECK: COLORS_V2_ANALYTICS_CHARTS_11,
};

interface Props extends WidgetProps {}

export default function PaymentMethodDistributionWidget(props: Props) {
  const [dateRange, setDateRange] = useState<RangeValue<Dayjs>>([
    dayjs().subtract(1, 'year'),
    dayjs(),
  ]);
  const api = useApi();
  let startTimestamp = dayjs().subtract(1, 'day').valueOf();
  let endTimestamp = Date.now();

  const [start, end] = dateRange ?? [];
  if (start != null && end != null) {
    startTimestamp = start.startOf('day').valueOf();
    endTimestamp = end.endOf('day').valueOf();
  }

  const params = {
    startTimestamp,
    endTimestamp,
  };

  const queryResult = useQuery(DASHBOARD_TRANSACTIONS_TOTAL_STATS(params), async () => {
    return await api.getDashboardStatsTransactionsTotal(params);
  });

  const preparedDataRes = map(queryResult.data, (value): TreemapData<PaymentMethod> => {
    const resultMap: {
      [key: string]: number;
    } = PAYMENT_METHODS.reduce((acc, x) => ({ ...acc, [x]: 0 }), {});
    for (const paymentMethod of PAYMENT_METHODS) {
      const count = value.data[`paymentMethods_${paymentMethod}`];
      if (count != null) {
        resultMap[paymentMethod] += count;
      }
    }
    return Object.entries(resultMap).map(
      ([name, value]): TreemapItem<PaymentMethod> => ({
        name: name as PaymentMethod,
        value,
      }),
    );
  });

  return (
    <Widget
      {...props}
      extraControls={[<DatePicker.RangePicker value={dateRange} onChange={setDateRange} />]}
      onDownload={
        isSuccess(preparedDataRes)
          ? async () => ({
              fileName: `distribution-by-payment-methods.json`,
              data: JSON.stringify(preparedDataRes.value),
            })
          : undefined
      }
      width="HALF"
    >
      <AsyncResourceRenderer resource={preparedDataRes}>
        {(preparedData) => (
          <Treemap<PaymentMethod>
            height={330}
            data={preparedData}
            colors={TREEMAP_COLORS}
            formatTitle={(name) => (name == null ? `Other` : getPaymentMethodTitle(name))}
          />
        )}
      </AsyncResourceRenderer>
    </Widget>
  );
}
