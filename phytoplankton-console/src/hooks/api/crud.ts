import { usePaginatedQuery } from '@/utils/queries/hooks';

export function useCrudPaginated<Entity>(
  key: string,
  params: any,
  fetchPage: (mergedParams: any) => Promise<{ total: number; data: Entity[] }>,
) {
  return usePaginatedQuery<Entity>([key, params], async (paginationParams) => {
    const { total, data } = await fetchPage({ ...params, ...paginationParams });
    return { total, items: data };
  });
}
