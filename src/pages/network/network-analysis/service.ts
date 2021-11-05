// @ts-ignore
/* eslint-disable */
import { request } from 'umi';
import { NetworkAnalysisTableListItem } from './data.d';

/** 获取规则列表 GET /api/networkAnalysis */
export async function networkAnalysis(
  params: {
    // query
    /** 当前的页码 */
    current?: number;
    /** 页面的容量 */
    pageSize?: number;
  },
  options?: { [key: string]: any },
) {
  return request<{
    data: NetworkAnalysisTableListItem[];
    /** 列表的内容总数 */
    total?: number;
    success?: boolean;
  }>('/api/networkAnalysis', {
    method: 'GET',
    params: {
      ...params,
    },
    ...(options || {}),
  });
}
