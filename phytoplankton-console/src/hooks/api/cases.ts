import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { CASES_ITEM, CASES_LIST } from '@/utils/queries/keys';
import { Case } from '@/apis';
import { DefaultApiGetCaseListRequest } from '@/apis/types/ObjectParamAPI';

export function useCase(caseId: string, options?: { enabled?: boolean }) {
  const api = useApi();
  return useQuery(CASES_ITEM(caseId), (): Promise<Case> => api.getCase({ caseId }), options);
}

export function useCasesList(filter: DefaultApiGetCaseListRequest) {
  const api = useApi();
  return useQuery(CASES_LIST(filter), async () => api.getCaseList(filter));
}
