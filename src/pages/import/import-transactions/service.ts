/* eslint-disable */
import request from 'umi-request';
import { TableListItem } from './data';

export async function files(
  params: {
    current?: number;
    pageSize?: number;
  },
  options?: { [key: string]: any },
) {
  const result = await request<{
    data: TableListItem[];
    total?: number;
    success?: boolean;
  }>('/api/files', {
    method: 'GET',
    params: {
      ...params,
    },
    ...(options || {}),
  });
  return {
    items: result.data,
    total: result.total,
    success: result.success,
  };
}
