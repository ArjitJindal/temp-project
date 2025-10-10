import React from 'react';
import s from './index.module.less';
import { QuestionResponseBarchart } from '@/pages/case-management/AlertTable/InvestigativeCoPilotModal/InvestigativeCoPilot/types';
import BarChart, { BarChartData } from '@/components/charts/BarChart';
import { success } from '@/utils/asyncResource';

interface Props {
  item: QuestionResponseBarchart;
}

const PdfBarchart: React.FC<Props> = ({ item }) => {
  if (!item.values?.length) {
    return <div className={s.noData}>No chart data available</div>;
  }

  const data: BarChartData<string, string> = item.values.map((valueItem) => ({
    series: valueItem.x ?? 'N/A',
    value: valueItem.y ?? 0,
    category: valueItem.x ?? 'N/A',
  }));

  return (
    <div className={s.chartContainer}>
      <BarChart data={success(data)} colors={{}} height={200} hideLegend={true} />
    </div>
  );
};

export default PdfBarchart;
