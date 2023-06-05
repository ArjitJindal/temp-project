import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { Updater } from '@tanstack/react-table';
import { CASES_ITEM } from '../queries/keys';
import { Case } from '@/apis';

export function useUpdateCaseQueryData() {
  const queryClient = useQueryClient();
  return useCallback(
    (caseId: string | undefined, updater: Updater<Case | undefined>) => {
      if (caseId) {
        queryClient.setQueryData<Case>(CASES_ITEM(caseId), updater);
      }
    },
    [queryClient],
  );
}
