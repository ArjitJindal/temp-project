import { CURRENCIES } from '@flagright/lib/constants';
import { COPILOT_QUESTIONS } from '@flagright/lib/utils/copilot';
import { QuestionResponseTimeSeries } from '../../../types';
import { notEmpty } from '@/utils/array';
import { dayjs, DEFAULT_DATE_FORMAT } from '@/utils/dayjs';
import { ALL_CHART_COLORS } from '@/components/ui/colors';
import LineChart, { LineData } from '@/components/charts/Line';
import { success } from '@/utils/asyncResource';
import { formatNumber } from '@/utils/number';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';

// Helper function to get currency formatting function based on question ID
const getCurrencyFormatFunction = (item: QuestionResponseTimeSeries, showAllDecimals: boolean) => {
  // Check if this is a transaction count (not amount)
  const isTransactionCount =
    item.questionId === COPILOT_QUESTIONS.TRANSACTION_COUNT ||
    item.title?.toLowerCase().includes('transaction count');

  // If it's a transaction count, format as whole number without currency or decimals
  if (isTransactionCount) {
    return (value: number): string => {
      return Math.round(value).toLocaleString();
    };
  }

  const isTransactionRelated =
    item.questionId === COPILOT_QUESTIONS.TRANSACTION_INSIGHTS ||
    item.title?.toLowerCase().includes('transaction') ||
    item.title?.toLowerCase().includes('amount');

  if (!isTransactionRelated) {
    return (value: number) => formatNumber(value, { keepDecimals: true, showAllDecimals });
  }

  const currencyVariable = item.variables?.find((variable) => variable.name === 'currency');
  const currency = currencyVariable?.value || 'USD';

  return (value: number): string => {
    const formattedNumber = formatNumber(value, { keepDecimals: true, showAllDecimals });
    const currencyInfo = CURRENCIES.find((x) => x.value === currency);

    if (currencyInfo) {
      return `${currencyInfo.symbol || currency}${formattedNumber}`;
    }
    return `${currency} ${formattedNumber}`;
  };
};

interface Props {
  item: QuestionResponseTimeSeries;
}

export default function HistoryItemTimeSeries(props: Props) {
  const { item } = props;
  const settings = useSettings();
  const showAllDecimals = settings.showAllDecimalPlaces ?? false;

  const data: LineData<string, string> = (item.timeseries ?? []).flatMap((seriesItem) =>
    (seriesItem.values ?? []).map((valueItem) => ({
      series: seriesItem.label || 'Value',
      yValue: valueItem.value ?? 0,
      xValue: dayjs(valueItem.time).format(DEFAULT_DATE_FORMAT),
    })),
  );

  const seriesLabels: string[] = (item.timeseries ?? [])
    .map((x) => x.label || 'Value')
    .filter(notEmpty);

  return (
    <LineChart
      data={success(data)}
      colors={seriesLabels.reduce(
        (acc, series, i) => ({ ...acc, [series]: ALL_CHART_COLORS[i % ALL_CHART_COLORS.length] }),
        {},
      )}
      height={200}
      hideLegend={seriesLabels.length < 2}
      formatY={getCurrencyFormatFunction(item, showAllDecimals)}
    />
  );
}
