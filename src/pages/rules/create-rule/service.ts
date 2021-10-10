import { request } from 'umi';
import { TableListItem } from './data.d';

export async function fakeSubmitForm(params: any) {
  return request('/api/stepForm', {
    method: 'POST',
    data: params,
  });
}

/** 获取规则列表 GET /api/rule */
export async function rules(
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
    data: TableListItem[];
    /** 列表的内容总数 */
    total?: number;
    success?: boolean;
  }>('/api/rules', {
    method: 'GET',
    params: {
      ...params,
    },
    ...(options || {}),
  });
}
