import { replaceMagicKeyword } from '@flagright/lib/utils/object';
import { DEFAULT_CURRENCY_KEYWORD } from '@flagright/lib/constants/currency';
import { capitalizeNameFromEmail } from '@flagright/lib/utils/humanize';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { keyBy } from 'lodash';
import { RuleInstanceMap, RulesMap } from './types';
import { useApi } from '@/api';
import { message } from '@/components/library/Message';
import { ItemGroup } from '@/components/library/SearchBar/SearchBarDropdown';
import { isLoading, isSuccess } from '@/utils/asyncResource';
import { getErrorMessage } from '@/utils/lang';
import { usePaginatedQuery, useQuery } from '@/utils/queries/hooks';
import { useMutation } from '@/utils/queries/mutations/hooks';
import {
  NEW_RULE_ID,
  RULE_FILTERS,
  RULE_QUEUE,
  RULE_QUEUES,
  THRESHOLD_RECOMMENDATIONS,
  GET_RULE,
  GET_RULE_INSTANCE,
  GET_RULE_INSTANCES,
  RULES_UNIVERSAL_SEARCH,
  MACHINE_LEARNING_MODELS,
  RULE_STATS,
  RULES,
  RULE_INSTANCES,
  RULES_WITH_ALERTS,
  GET_RULES,
} from '@/utils/queries/keys';
import { useFeatures, useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import { Feature, RuleInstance, RuleMLModel } from '@/apis';
import { useAuth0User } from '@/utils/user-utils';
import { RULE_ACTION_VALUES } from '@/utils/rules';

export const useNewRuleId = (ruleInstanceId?: string) => {
  const api = useApi();
  return useQuery(NEW_RULE_ID(ruleInstanceId), async () => {
    return await api.getRuleInstancesNewRuleId({
      ruleId: ruleInstanceId,
    });
  });
};

export const useRuleFilters = () => {
  const api = useApi();
  return useQuery(RULE_FILTERS(), () => api.getRuleFilters());
};

export const useRuleQueue = (ruleQueueId: string) => {
  const api = useApi();
  const ruleQueueResult = useQuery(
    RULE_QUEUE(ruleQueueId),
    () => api.getRuleQueue({ ruleQueueId: ruleQueueId }),
    {
      enabled: !!ruleQueueId,
    },
  );
  return {
    ruleQueue: isSuccess(ruleQueueResult.data) ? ruleQueueResult.data.value : undefined,
    isLoading: isLoading(ruleQueueResult.data),
  };
};

export const useRuleQueues = () => {
  const api = useApi();
  const params = { pageSize: 1000 };
  const queryResult = useQuery(RULE_QUEUES(params), async () => {
    return await api.getRuleQueues(params);
  });
  return isSuccess(queryResult.data) ? queryResult.data.value.data : [];
};

export const useRuleInstanceRecommendation = (ruleInstanceId: string) => {
  const api = useApi();
  return useQuery(
    THRESHOLD_RECOMMENDATIONS(ruleInstanceId),
    () => api.getRuleInstanceRuleInstanceIdRecommendation({ ruleInstanceId }),
    {
      enabled: !!ruleInstanceId,
      onError: (e) => {
        message.fatal(`Failed to calculate recommendations for the rule. ${getErrorMessage(e)}`, e);
      },
    },
  );
};

export const useRuleDetails = (ruleId: string) => {
  const api = useApi();
  return useQuery(
    GET_RULE(ruleId),
    () => {
      if (ruleId === 'create') {
        return null;
      }
      return api.getRule({ ruleId });
    },
    {
      enabled: !!ruleId,
    },
  );
};

export const useRuleInstanceDetails = (ruleInstanceId: string) => {
  const api = useApi();
  return useQuery(
    GET_RULE_INSTANCE(ruleInstanceId),
    () => api.getRuleInstancesItem({ ruleInstanceId }),
    {
      enabled: !!ruleInstanceId,
    },
  );
};

export const useRulesSearch = ({
  query,
  isAllFiltersEmpty,
  isAiFiltersIncreased,
  isAIEnabled,
  universalSearchFilterParams,
  recentSearchesObj,
  onFiltersFromAI,
  onUpdateFilters,
}: {
  query: string | undefined;
  isAllFiltersEmpty: boolean;
  isAiFiltersIncreased: boolean;
  isAIEnabled: boolean;
  universalSearchFilterParams: any;
  recentSearchesObj: ItemGroup[];
  onFiltersFromAI?: (filters: any) => void;
  onUpdateFilters?: (filters: any) => void;
}) => {
  const api = useApi();
  const settings = useSettings();
  const features = useFeatures();

  const arrayify = (v: any) => (Array.isArray(v) ? v : v ? [v] : []);
  const keyParams = {
    typologies: universalSearchFilterParams?.typologies ?? [],
    checksFor: universalSearchFilterParams?.checksFor ?? [],
    defaultNature: universalSearchFilterParams?.defaultNature ?? [],
    types: arrayify(universalSearchFilterParams?.types),
    tags: universalSearchFilterParams?.tags ?? [],
    inc: isAiFiltersIncreased,
  };
  return useQuery<ItemGroup[]>(
    RULES_UNIVERSAL_SEARCH(query || '', keyParams, isAIEnabled),
    async () => {
      if (!query && isAllFiltersEmpty) {
        return recentSearchesObj;
      }

      const sendFilters = !isAIEnabled || isAiFiltersIncreased;
      const rulesSearchResult: any = await api.getRulesSearch({
        queryStr: query || '',
        filterTypology: sendFilters ? universalSearchFilterParams.typologies : [],
        filterChecksFor: sendFilters ? universalSearchFilterParams.checksFor : [],
        filterNature: sendFilters ? universalSearchFilterParams.defaultNature : [],
        filterTypes: sendFilters ? arrayify(universalSearchFilterParams.types) : [],
        filterTags: sendFilters ? universalSearchFilterParams.tags : [],
        isAISearch: isAIEnabled,
        disableGptSearch: isAIEnabled && isAiFiltersIncreased,
      });

      const byFeatures = (rules: any[]) =>
        (rules ?? []).filter(({ requiredFeatures }) =>
          (requiredFeatures ?? []).every((f: Feature) => features.includes(f)),
        );

      const bestMatchesRaw = byFeatures(rulesSearchResult.bestSearches);
      const otherMatchesRaw = byFeatures(rulesSearchResult.otherSearches);

      const result: any = replaceMagicKeyword(
        { ...rulesSearchResult, bestSearches: bestMatchesRaw, otherSearches: otherMatchesRaw },
        DEFAULT_CURRENCY_KEYWORD,
        settings.defaultValues?.currency ?? 'USD',
      );

      const bestMatches = result.bestSearches ?? [];
      const otherMatches = result.otherSearches ?? [];

      const data: ItemGroup[] = [
        ...(bestMatches.length > 0
          ? [
              {
                title: 'Best matches',
                items: bestMatches.map((rule: any) => ({
                  itemDescription: rule.description,
                  itemId: rule.id,
                  itemName: rule.name,
                })),
              },
            ]
          : []),
        ...(otherMatches.length > 0
          ? [
              {
                title: 'Other matches',
                items: otherMatches.map((rule: any) => ({
                  itemDescription: rule.description,
                  itemId: rule.id,
                  itemName: rule.name,
                })),
              },
            ]
          : []),
      ];

      const filters = {
        typologies: rulesSearchResult?.filtersApplied?.typologies || [],
        checksFor: rulesSearchResult?.filtersApplied?.checksFor || [],
        defaultNature: rulesSearchResult?.filtersApplied?.ruleNature || [],
        types: rulesSearchResult?.filtersApplied?.types || [],
        tags: rulesSearchResult.filtersApplied?.tags || [],
      };

      if (isAIEnabled) {
        onFiltersFromAI?.(filters);
      }
      onUpdateFilters?.(filters);

      return data;
    },
  );
};

export const usePaginatedRuleMlModels = (params) => {
  const api = useApi();
  return usePaginatedQuery(MACHINE_LEARNING_MODELS(params), async (_) => {
    const result = await api.getRuleMlModels({
      modelId: params.modelId,
      modelType: params.modelType,
      modelName: params.modelName,
    });
    return {
      items: result,
      total: result.length,
    };
  });
};

export const useRuleMlModels = () => {
  const api = useApi();
  return useQuery(MACHINE_LEARNING_MODELS(), async () => {
    return await api.getRuleMlModels();
  });
};

export const useUpdateRuleMlModel = (onRefetch?: () => void) => {
  const api = useApi();
  const auth0User = useAuth0User();
  return useMutation(
    async (mlModel: RuleMLModel) => {
      await api.updateRuleMlModelModelId({
        modelId: mlModel.id,
        RuleMLModel: mlModel,
      });
      return mlModel;
    },
    {
      onSuccess: (mlModel) => {
        message.success(`Model ${mlModel.enabled ? 'enabled' : 'disabled'} successfully`, {
          details: `${capitalizeNameFromEmail(auth0User?.name || '')} ${
            mlModel.enabled ? 'enabled' : 'disabled'
          } the model ${mlModel.id}`,
        });
        onRefetch?.();
      },
      onError: (error: Error) => {
        message.error(`Error: ${error.message}`);
      },
    },
  );
};

export const useRuleStats = (params) => {
  const api = useApi();
  return useQuery(RULE_STATS(params), async () => {
    return await api.getRuleInstancesRuleInstanceIdStats(params);
  });
};

export function useRules(): {
  rules: RulesMap;
  ruleInstances: RuleInstanceMap;
  isLoading: boolean;
} {
  const api = useApi();
  const rulesResults = useQuery(RULES(), () => api.getRules());
  const ruleInstanceResults = useQuery(RULE_INSTANCES(), () => api.getRuleInstances());
  const rulesMap = useMemo(() => {
    if (isSuccess(rulesResults.data)) {
      return keyBy(rulesResults.data.value, 'id');
    } else {
      return {};
    }
  }, [rulesResults.data]);
  const ruleInstancesMap = useMemo(() => {
    if (isSuccess(ruleInstanceResults.data)) {
      return keyBy(ruleInstanceResults.data.value, 'id');
    } else {
      return {};
    }
  }, [ruleInstanceResults.data]);

  return {
    rules: rulesMap,
    ruleInstances: ruleInstancesMap,
    isLoading: isLoading(ruleInstanceResults.data) || isLoading(rulesResults.data),
  };
}

export const usePaginatedRules = (params) => {
  const api = useApi();
  return usePaginatedQuery(GET_RULES(params), async (_) => {
    const rules = await api.getRules();
    const result = [...rules];
    if (params.sort.length > 0) {
      const [key, order] = params.sort[0];
      result.sort((a, b) => {
        let result = 0;
        if (key === 'id') {
          result = parseInt(a.id.split('-')[1]) - parseInt(b.id.split('-')[1]);
        } else if (key === 'defaultAction') {
          result =
            RULE_ACTION_VALUES.indexOf(a.defaultAction) -
            RULE_ACTION_VALUES.indexOf(b.defaultAction);
        } else {
          result = a[key] > b[key] ? 1 : -1;
        }
        result *= order === 'descend' ? -1 : 1;
        return result;
      });
    }

    return {
      items: result,
      total: rules.length,
    };
  });
};

export const useRulesResults = ({
  params,
  ruleMode,
  focusId,
  onViewRule,
}: {
  params: any;
  ruleMode?: string;
  focusId?: string;
  onViewRule?: (ruleInstance: RuleInstance) => void;
}) => {
  const api = useApi();
  const rulesResult = usePaginatedQuery(
    GET_RULE_INSTANCES({ ruleMode, params }),
    async (paginationParams) => {
      const ruleInstances = await api.getRuleInstances({
        ...paginationParams,
        mode: ruleMode as any,
      });
      if (focusId) {
        const ruleInstance = ruleInstances.find((r) => r.id === focusId);
        if (ruleInstance) {
          onViewRule?.(ruleInstance);
        }
      }

      const result = [...ruleInstances];
      if (params.sort.length > 0) {
        const [key, order] = params.sort[0];
        result.sort((a, b) => {
          let comp = 0;
          if (key === 'ruleId') {
            comp =
              (a.ruleId ? parseInt(a.ruleId.split('-')[1]) : 0) -
              (b.ruleId ? parseInt(b.ruleId.split('-')[1]) : 0);
          } else if (key === 'hitCount') {
            comp =
              (a.hitCount && a.runCount ? a.hitCount / a.runCount : 0) -
              (b.hitCount && b.runCount ? b.hitCount / b.runCount : 0);
          } else if (key === 'createdAt') {
            comp =
              a.createdAt !== undefined && b.createdAt !== undefined
                ? a.createdAt - b.createdAt
                : -1;
          } else if (key === 'updatedAt') {
            comp =
              a.updatedAt !== undefined && b.updatedAt !== undefined
                ? a.updatedAt - b.updatedAt
                : -1;
          } else if (key === 'queueId') {
            comp = (b.queueId || 'default') > (a.queueId || 'default') ? 1 : -1;
          } else {
            comp = a[key] > b[key] ? 1 : -1;
          }
          comp *= order === 'descend' ? -1 : 1;
          return comp;
        });
      }

      return {
        items: result,
        total: result.length,
      };
    },
  );

  return rulesResult;
};

export const useRuleOptions = ({ onlyWithAlerts = false }: { onlyWithAlerts?: boolean } = {}) => {
  const api = useApi();
  const rules = useRules();

  const { data: rulesWithAlertsData } = useQuery<string[]>(
    RULES_WITH_ALERTS(),
    () => api.getRulesWithAlerts(),
    {
      enabled: onlyWithAlerts,
    },
  );
  return useMemo(() => {
    let relevantRuleInstances: RuleInstance[] = Object.values(rules.ruleInstances);

    if (onlyWithAlerts && rulesWithAlertsData.kind === 'SUCCESS') {
      const rulesWithAlertsSet = new Set<string>(rulesWithAlertsData.value);
      relevantRuleInstances = relevantRuleInstances.filter((instance) =>
        rulesWithAlertsSet.has(instance.id as string),
      );
    }
    return relevantRuleInstances
      .map((rulesInstance: RuleInstance) => {
        const ruleName =
          rulesInstance.ruleNameAlias ||
          (rulesInstance.ruleId && rules.rules[rulesInstance.ruleId]?.name);

        if (!ruleName) {
          return null;
        }

        return {
          value: rulesInstance.id ?? '',
          label: [ruleName, rulesInstance.id, rulesInstance.ruleId && `(${rulesInstance.ruleId})`]
            .filter(Boolean)
            .join(' '),
        };
      })
      .filter(Boolean);
  }, [rules.ruleInstances, rules.rules, onlyWithAlerts, rulesWithAlertsData]);
};

export const useUpdateRuleInstance = (
  onRuleInstanceUpdated?: (ruleInstance: RuleInstance) => void,
) => {
  const api = useApi();
  const queryClient = useQueryClient();
  const auth0User = useAuth0User();
  return useMutation<RuleInstance, unknown, RuleInstance>(
    async (ruleInstance: RuleInstance) => {
      if (ruleInstance.id == null) {
        throw new Error(`Rule instance ID is not defined, unable to update rule instance`);
      }
      return api.putRuleInstancesRuleInstanceId({
        ruleInstanceId: ruleInstance.id,
        RuleInstance: ruleInstance,
      });
    },
    {
      onSuccess: async (updatedRuleInstance) => {
        if (onRuleInstanceUpdated) {
          onRuleInstanceUpdated(updatedRuleInstance);
        }
        await queryClient.invalidateQueries(GET_RULE_INSTANCE(updatedRuleInstance.id as string));
        await queryClient.invalidateQueries(GET_RULE_INSTANCES());
        await queryClient.invalidateQueries(RULES());

        if (updatedRuleInstance.status === 'DEPLOYING') {
          message.success(
            `Rule ${updatedRuleInstance.id} has been successfully updated and will be live once deployed.`,
          );
        } else {
          message.success(`Rule updated successfully`, {
            details: `${capitalizeNameFromEmail(auth0User?.name || '')} updated the rule ${
              updatedRuleInstance.id
            }`,
          });
        }
      },
      onError: async (err) => {
        message.fatal(`Unable to update the rule - ${getErrorMessage(err)}`, err);
      },
    },
  );
};

export const useCreateRuleInstance = (
  onRuleInstanceCreated?: (ruleInstance: RuleInstance) => void,
) => {
  const api = useApi();
  const auth0User = useAuth0User();
  const queryClient = useQueryClient();
  return useMutation<RuleInstance, unknown, RuleInstance>(
    async (ruleInstance: RuleInstance) => {
      return api.postRuleInstances({
        RuleInstance: ruleInstance,
      });
    },
    {
      onSuccess: async (newRuleInstance) => {
        if (onRuleInstanceCreated) {
          onRuleInstanceCreated(newRuleInstance);
        }
        await queryClient.invalidateQueries(GET_RULE_INSTANCES());
        message.success(`A new rule has been created successfully`, {
          details: `${capitalizeNameFromEmail(auth0User?.name || '')} created the rule ${
            newRuleInstance.id
          }`,
        });
      },
      onError: async (err) => {
        message.fatal(`Unable to create the rule - Some parameters are missing`, err);
      },
    },
  );
};
