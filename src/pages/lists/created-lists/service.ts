import request from 'umi-request';

export async function getActiveLists() {
  return request('/api/lists/created-lists');
}
