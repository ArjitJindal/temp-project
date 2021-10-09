import { request } from 'umi';
import type { AnalysisData } from './data.d';

export async function fakeChartData(): Promise<{ data: AnalysisData }> {
  return request('/api/fake_analysis_chart_data');
}
