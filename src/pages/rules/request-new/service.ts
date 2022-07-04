import request from 'umi-request';

export async function fakeSubmitForm(params: any) {
  return request('/api/rules/request-new', {
    method: 'POST',
    data: params,
  });
}
