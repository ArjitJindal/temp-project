import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { RULE_LOGIC_CONFIG } from '@/utils/queries/keys';
import type { LogicConfig } from '@/apis';
import type { QueryOptions } from '@/utils/queries/types';

export function useRuleLogicConfig(
  params: { excludeSelectOptions?: boolean; filterVarNames?: string[] },
  options?: QueryOptions<LogicConfig, LogicConfig>,
) {
  const api = useApi();
  return useQuery<LogicConfig>(
    RULE_LOGIC_CONFIG(params),
    async (): Promise<LogicConfig> => {
      const response = await api.getLogicConfig({
        LogicConfigRequest: {
          excludeSelectOptions: params.excludeSelectOptions,
          filterVarNames: params.filterVarNames,
        },
      });
      if (!response.logicConfig) {
        throw new Error('No logic config found');
      }
      return response.logicConfig;
    },
    options as any,
  );
}
