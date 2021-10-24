import { request } from 'umi';

export async function getActiveRules() {
  return request('/api/rules/created-rules');
}
