import React, { useState } from 'react';
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
import { WidgetProps } from '@/components/library/Widget/types';
import { getPaymentMethodTitle, PAYMENT_METHODS, PaymentMethod } from '@/utils/payments';
import { isSuccess, map } from '@/utils/asyncResource';
import Treemap, {
  TreemapData,
  TreemapItem,
} from '@/pages/dashboard/analysis/components/charts/Treemap';
import { dayjs } from '@/utils/dayjs';
import Widget from '@/components/library/Widget';
import WidgetRangePicker, {
  Value as WidgetRangePickerValue,
} from '@/pages/dashboard/analysis/components/widgets/WidgetRangePicker';

const DEFAULT_DATE_RANGE: WidgetRangePickerValue = {
  startTimestamp: dayjs().subtract(1, 'year').valueOf(),
  endTimestamp: dayjs().valueOf(),
};

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
  const [dateRange, setDateRange] = useState<WidgetRangePickerValue>();

  const { startTimestamp, endTimestamp } = dateRange ?? DEFAULT_DATE_RANGE;
  const params = {
    startTimestamp,
    endTimestamp,
  };

  const api = useApi();
  const queryResult = useQuery(DASHBOARD_TRANSACTIONS_TOTAL_STATS({}), async () => {
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
      extraControls={[<WidgetRangePicker value={dateRange} onChange={setDateRange} />]}
      onDownload={
        isSuccess(preparedDataRes)
          ? async () => ({
              fileName: `distribution-by-payment-methods.json`,
              data: JSON.stringify(preparedDataRes.value),
            })
          : undefined
      }
      resizing="FIXED"
      {...props}
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
