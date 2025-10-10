import { useDebounce } from 'ahooks';
import { ObjectDefaultApi as FlagrightApi } from './apis/types/ObjectParamAPI';
import { useApiFromContext } from '@/components/AppWrapper/Providers/ApiProvider';

/**
 * @param debounce - The debounce time in milliseconds
 * @returns The API instance with debounce applied if debounce is provided
 */
export function useApi(options?: { debounce?: number }): FlagrightApi {
  const api = useApiFromContext();
  const debouncedApi = useDebounce(api, { wait: options?.debounce });
  return options?.debounce ? debouncedApi : api;
}
