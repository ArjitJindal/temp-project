import { request } from 'umi';

export async function queryAdvancedProfile() {
  return request('/api/rules/advanced');
}
