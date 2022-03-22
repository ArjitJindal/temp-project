/* eslint-disable */
import { request } from 'umi';
import { CustomerUsersListItem, BusinessUsersListItem } from './data.d';

/** 获取规则列表 GET /api/rule */
export async function customerUsers(
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
    data: CustomerUsersListItem[];
    /** 列表的内容总数 */
    total?: number;
    success?: boolean;
  }>('/api/customerUsers', {
    method: 'GET',
    params: {
      ...params,
    },
    ...(options || {}),
  });
}

export async function businessUsers(
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
    data: BusinessUsersListItem[];
    /** 列表的内容总数 */
    total?: number;
    success?: boolean;
  }>('/api/businessUsers', {
    method: 'GET',
    params: {
      ...params,
    },
    ...(options || {}),
  });
}
