import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { NARRATIVE_TEMPLATE_LIST } from '@/utils/queries/keys';

const NARRATIVE_PAGE = 1;
const NARRATIVE_PAGE_SIZE = 1000;

export function useNarrativeTemplates() {
  const api = useApi();
  return useQuery(
    NARRATIVE_TEMPLATE_LIST({ page: NARRATIVE_PAGE, pageSize: NARRATIVE_PAGE_SIZE }),
    async () => {
      return await api.getNarratives({ page: NARRATIVE_PAGE, pageSize: NARRATIVE_PAGE_SIZE });
    },
  );
}
