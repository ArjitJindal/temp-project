import type { FC } from 'react';
import { useEffect, useState } from 'react';
import { GridContent } from '@ant-design/pro-layout';
import moment from 'moment';
import TransactionsChartCard, {
  TimeWindowType,
  TransactionsStats,
} from './components/TransactionsChartCard';
import { AnalysisData } from './data.d';
import { useApi } from '@/api';
import {
  AsyncResource,
  failed,
  getOr,
  init,
  isLoading,
  loading,
  map,
  success,
} from '@/utils/asyncResource';
import { DashboardStatsTransactionsCountData } from '@/apis';

type AnalysisProps = {
  dashboardAndanalysis: AnalysisData;
  loading: boolean;
};

const Analysis: FC<AnalysisProps> = () => {
  const [endDate, setEndDate] = useState<moment.Moment | null>(null);
  const [timeWindowType, setTimeWindowType] = useState<TimeWindowType>('YEAR');

  const api = useApi();
  const [data, setData] = useState<AsyncResource<DashboardStatsTransactionsCountData[]>>(init());
  useEffect(() => {
    let isCanceled = false;
    async function fetch() {
      setData((state) => loading(getOr(state, null)));
      try {
        const result = await api.getDashboardStatsTransactions({
          timeframe: timeWindowType,
          endTimestamp: endDate ? endDate.valueOf() : Date.now(),
        });
        if (isCanceled) {
          return;
        }
        setData(success(result.data));
      } catch (e) {
        setData(failed('Unknown error')); // todo: get actual error message
      }
    }

    fetch().catch((e) => {
      console.error(e);
    });

    return () => {
      isCanceled = true;
    };
  }, [endDate, timeWindowType, api]);

  const salesDataResource: AsyncResource<TransactionsStats> = map(data, (value) => ({
    data: value.map((item, i) => ({
      id: item._id,
      flaggedTransactions: item.flaggedTransactions ?? 0,
      stoppedTransactions: item.stoppedTransactions ?? 0,
    })),
  }));

  return (
    <GridContent>
      <TransactionsChartCard
        salesData={getOr(salesDataResource, { data: [] })}
        endDate={endDate}
        timeWindowType={timeWindowType}
        loading={isLoading(data)}
        onChangeEndDate={setEndDate}
        onSelectTimeWindow={setTimeWindowType}
      />
    </GridContent>
  );
};

export default Analysis;
