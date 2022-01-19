import { request } from 'umi';

export async function getActiveLists() {
  return request('/api/lists/created-lists');
}
