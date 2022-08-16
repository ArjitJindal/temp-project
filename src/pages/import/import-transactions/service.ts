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
  return request<{
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
}
