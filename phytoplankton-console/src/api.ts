import { ObjectDefaultApi as FlagrightApi } from './apis/types/ObjectParamAPI';
import { useApiFromContext } from '@/components/AppWrapper/Providers/ApiProvider';

export function useApi(): FlagrightApi {
  return useApiFromContext();
}
