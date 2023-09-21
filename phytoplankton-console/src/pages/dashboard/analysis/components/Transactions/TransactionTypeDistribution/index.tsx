import Donut from '@/pages/dashboard/analysis/components/charts/Donut';
import {
  DashboardStatsTransactionTypeDistributionStats,
  DashboardStatsTransactionTypeDistributionStatsTransactionTypeData,
  TransactionType,
} from '@/apis';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
import {
  COLORS_V2_ANALYTICS_CHARTS_01,
  COLORS_V2_ANALYTICS_CHARTS_02,
  COLORS_V2_ANALYTICS_CHARTS_04,
  COLORS_V2_ANALYTICS_CHARTS_05,
  COLORS_V2_ANALYTICS_CHARTS_07,
  COLORS_V2_ANALYTICS_CHARTS_10,
} from '@/components/ui/colors';
import { isSuccess } from '@/utils/asyncResource';
import { WidgetProps } from '@/components/library/Widget/types';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { TRANSACTION_TYPE_DISTRIBUTION } from '@/utils/queries/keys';
import Widget from '@/components/library/Widget';

const TRANSACTION_TYPE_COLORS: Record<TransactionType, string> = {
  ['DEPOSIT']: COLORS_V2_ANALYTICS_CHARTS_04,
  ['WITHDRAWAL']: COLORS_V2_ANALYTICS_CHARTS_01,
  ['REFUND']: COLORS_V2_ANALYTICS_CHARTS_02,
  ['EXTERNAL_PAYMENT']: COLORS_V2_ANALYTICS_CHARTS_10,
  ['TRANSFER']: COLORS_V2_ANALYTICS_CHARTS_05,
  ['OTHER']: COLORS_V2_ANALYTICS_CHARTS_07,
};

interface Props extends WidgetProps {}

const TransactinTypeDistribution = (props: Props) => {
  const api = useApi();
  const queryResult = useQuery(TRANSACTION_TYPE_DISTRIBUTION(), async () => {
    const response = await api.getDashboardStatsTransactionTypeDistributionStats();
    return response;
  });
  const data = queryResult.data;
  const formatedData = !isSuccess(data)
    ? []
    : data.value.transactionTypeData.map(
        (item: DashboardStatsTransactionTypeDistributionStatsTransactionTypeData) => {
          return { type: item.type, value: item.value };
        },
      );
  return (
    <Widget
      onDownload={(): Promise<{ fileName: string; data: string }> => {
        return new Promise((resolve, _reject) => {
          const fileData = {
            fileName: `distribution-by-transaction-type`,
            data: JSON.stringify(formatedData),
          };
          resolve(fileData);
        });
      }}
      resizing="FIXED"
      {...props}
    >
      <AsyncResourceRenderer<DashboardStatsTransactionTypeDistributionStats> resource={data}>
        {({ transactionTypeData }) => {
          const data = transactionTypeData.map(
            (item: DashboardStatsTransactionTypeDistributionStatsTransactionTypeData) => {
              return { colorField: item.type, angleField: item.value };
            },
          );
          return (
            <Donut data={data} COLORS={TRANSACTION_TYPE_COLORS} shape="CIRCLE" position="right" />
          );
        }}
      </AsyncResourceRenderer>
    </Widget>
  );
};

export default TransactinTypeDistribution;
