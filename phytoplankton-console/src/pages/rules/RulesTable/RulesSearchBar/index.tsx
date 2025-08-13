import { useCallback, useMemo, useState } from 'react';
import { compact, isEmpty, isEqual, sortBy, uniq } from 'lodash';
import { useDebounce } from 'ahooks';
import { replaceMagicKeyword } from '@flagright/lib/utils/object';
import { DEFAULT_CURRENCY_KEYWORD } from '@flagright/lib/constants/currency';
import { humanizeAuto } from '@flagright/lib/utils/humanize';
import { Rule, RuleNature, Feature as FeatureName, FilterTags } from '@/apis';
import { FilterProps } from '@/components/library/Filter/types';
import SearchBar from '@/components/library/SearchBar';
import { ItemGroup, Item } from '@/components/library/SearchBar/SearchBarDropdown';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { RULES_UNIVERSAL_SEARCH } from '@/utils/queries/keys';
import { AsyncResource, getOr, isLoading, isSuccess, success } from '@/utils/asyncResource';
import { useFeatures, useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import { Option } from '@/components/library/Select';
import { useDeepEqualEffect, useSafeLocalStorageState } from '@/utils/hooks';
import { FILTER_TAGSS } from '@/apis/models-custom/FilterTags';

type Props = {
  rules: Rule[];
  onSelectedRule: (rule: Rule) => void;
  onScenarioClick: () => void;
};

export type RuleUniversalSearchFilters = {
  typologies: string[];
  checksFor: string[];
  defaultNature: RuleNature[];
  types: string[] | string;
  tags: FilterTags[];
};

const DEFAULT_FILTER_PARAMS: RuleUniversalSearchFilters = {
  typologies: [],
  checksFor: [],
  defaultNature: [],
  types: [],
  tags: [],
};

const RECENT_RULE_SEARCHES_KEY = 'recent-rule-searches';

const countFilters = (filters: RuleUniversalSearchFilters) => {
  return Object.values(filters).reduce((acc, value) => acc + value?.length || 0, 0);
};

export const RulesSearchBar = (props: Props) => {
  const { rules, onSelectedRule, onScenarioClick } = props;
  const settings = useSettings();
  const features = useFeatures();

  const [universalSearchFilterParams, setUniversalSearchFilterParams] =
    useState<RuleUniversalSearchFilters>(DEFAULT_FILTER_PARAMS);

  const [search, setSearch] = useState<string>();
  const [isAIEnabled, setIsAIEnabled] = useState(false);
  const debouncedSearch = useDebounce(search, { wait: 300 });
  const [triggerAISearch, setTriggerAISearch] = useState(false);

  const isAllFiltersEmpty = useMemo(() => {
    return Object.values(universalSearchFilterParams).every((value) => isEmpty(value));
  }, [universalSearchFilterParams]);

  const [recentSearches, setRecentSearches] = useSafeLocalStorageState<
    (Item & { timestamp: number })[]
  >(RECENT_RULE_SEARCHES_KEY, []);

  const getRuleOptionsByKey = useCallback(
    (key: keyof Rule): Option<string>[] =>
      sortBy(compact(uniq(rules.flatMap((rule) => rule[key])))).map((label) => ({
        label: humanizeAuto(label),
        value: label,
      })),
    [rules],
  );

  const getRuleFilter = useCallback(
    (
      label: string,
      key: keyof Rule,
      options?: Option<string>[],
    ): FilterProps<RuleUniversalSearchFilters> => ({
      key,
      title: label,
      kind: 'AUTO',
      dataType: {
        kind: 'select',
        options: options ?? getRuleOptionsByKey(key),
        mode: 'MULTIPLE',
        displayMode: 'list',
      },
    }),
    [getRuleOptionsByKey],
  );

  const universalSearchFilters = useMemo(() => {
    const filters: FilterProps<RuleUniversalSearchFilters>[] = [
      getRuleFilter('Typology', 'typologies'),
      getRuleFilter('Checking for', 'checksFor'),
      getRuleFilter('Nature', 'defaultNature'),
      getRuleFilter('Type', 'types'),
      getRuleFilter(
        'Tag',
        'tags',
        FILTER_TAGSS.map((tag) => ({ label: humanizeAuto(tag), value: tag })),
      ),
    ];

    return filters;
  }, [getRuleFilter]);

  const onSearch = useCallback((newValue: string | undefined) => {
    setSearch(newValue);
  }, []);

  const api = useApi();

  const recentSearchesObj = useMemo(() => {
    const itemGroups: ItemGroup[] = [
      {
        items: recentSearches.map((recentSearch) =>
          replaceMagicKeyword(
            recentSearch,
            DEFAULT_CURRENCY_KEYWORD,
            settings.defaultValues?.currency ?? 'USD',
          ),
        ),
        title: 'Recent searches',
      },
    ];

    return itemGroups;
  }, [recentSearches, settings.defaultValues?.currency]);

  const [aiSearchedFilters, setAISearchedData] = useState<RuleUniversalSearchFilters>();

  const searchQueryResult = useQuery<ItemGroup[]>(RULES_UNIVERSAL_SEARCH(''), async () => {
    if (!debouncedSearch && isAllFiltersEmpty) {
      return recentSearchesObj;
    }

    const isAiFiltersIncreased =
      isAIEnabled &&
      aiSearchedFilters &&
      countFilters(universalSearchFilterParams) > countFilters(aiSearchedFilters)
        ? true
        : false;

    const sendFilters = !isAIEnabled || isAiFiltersIncreased;

    const rulesSearchResult = await api.getRulesSearch({
      queryStr: debouncedSearch || '',
      filterTypology: sendFilters ? universalSearchFilterParams.typologies : [],
      filterChecksFor: sendFilters ? universalSearchFilterParams.checksFor : [],
      filterNature: sendFilters ? universalSearchFilterParams.defaultNature : [],
      filterTypes: sendFilters
        ? Array.isArray(universalSearchFilterParams.types)
          ? universalSearchFilterParams.types
          : [universalSearchFilterParams.types]
        : [],
      filterTags: sendFilters ? universalSearchFilterParams.tags : [],
      isAISearch: isAIEnabled,
      disableGptSearch: isAIEnabled && isAiFiltersIncreased,
    });
    const filterRulesByFeatures = (rules: Rule[]) =>
      rules.filter(({ requiredFeatures }) =>
        (requiredFeatures ?? []).every((f) => features.includes(f as FeatureName)),
      );

    if (rulesSearchResult.bestSearches) {
      rulesSearchResult.bestSearches = filterRulesByFeatures(rulesSearchResult.bestSearches);
    }

    if (rulesSearchResult.otherSearches) {
      rulesSearchResult.otherSearches = filterRulesByFeatures(rulesSearchResult.otherSearches);
    }
    const result = replaceMagicKeyword<typeof rulesSearchResult>(
      rulesSearchResult,
      DEFAULT_CURRENCY_KEYWORD,
      settings.defaultValues?.currency ?? 'USD',
    );

    const bestMatches = result.bestSearches;
    const otherMatches = result.otherSearches;

    const data = [
      ...(bestMatches.length > 0
        ? [
            {
              title: 'Best matches',
              items: bestMatches.map((rule) => ({
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
              items: otherMatches.map((rule) => ({
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
      setAISearchedData(filters);
    }

    setUniversalSearchFilterParams((prev) => ({ ...prev, ...filters }));

    return data;
  });

  useDeepEqualEffect(() => {
    if (isAIEnabled && triggerAISearch) {
      searchQueryResult.refetch();
      setTriggerAISearch(false);
      return;
    }

    if (!isAIEnabled) {
      searchQueryResult.refetch();
    }
  }, [universalSearchFilterParams, debouncedSearch, isAIEnabled, triggerAISearch]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSelectItem = useCallback(
    (item: Item) => {
      setRecentSearches((prev) => {
        const newRecentSearches = prev?.filter(
          (recentSearch) => recentSearch.itemId !== item.itemId,
        );

        newRecentSearches?.unshift({
          ...item,
          timestamp: Date.now(),
        });

        return (newRecentSearches || []).slice(0, 5);
      });

      const rule = rules.find((rule) => rule.id === item.itemId);

      if (rule) {
        onSelectedRule(rule);
      }
    },
    [onSelectedRule, rules, setRecentSearches],
  );

  const filters = useMemo(() => {
    if (isAllFiltersEmpty) {
      return universalSearchFilters;
    }

    if (isAIEnabled) {
      return universalSearchFilters.filter(
        (filter) => !isEmpty(universalSearchFilterParams[filter.key]),
      );
    }

    return universalSearchFilters;
  }, [isAIEnabled, universalSearchFilterParams, universalSearchFilters, isAllFiltersEmpty]);

  const moreFilters = useMemo(() => {
    if (isAllFiltersEmpty) {
      return [];
    }
    if (isAIEnabled) {
      return universalSearchFilters.filter((filter) =>
        isEmpty(universalSearchFilterParams[filter.key]),
      );
    }

    return [];
  }, [isAIEnabled, universalSearchFilterParams, universalSearchFilters, isAllFiltersEmpty]);

  const items: AsyncResource<ItemGroup[]> = useMemo(() => {
    if (
      isAIEnabled &&
      aiSearchedFilters &&
      !isEqual(aiSearchedFilters, universalSearchFilterParams) &&
      isSuccess(searchQueryResult.data)
    ) {
      if (countFilters(aiSearchedFilters) > countFilters(universalSearchFilterParams)) {
        return success([]);
      }
    }

    if (!debouncedSearch && isAllFiltersEmpty) {
      return success(recentSearchesObj);
    }

    return searchQueryResult.data;
  }, [
    debouncedSearch,
    isAllFiltersEmpty,
    isAIEnabled,
    aiSearchedFilters,
    universalSearchFilterParams,
    recentSearchesObj,
    searchQueryResult.data,
  ]);

  const [showEmptyState, setShowEmptyState] = useState(false);

  useDeepEqualEffect(() => {
    if (
      search &&
      getOr(searchQueryResult.data, []).length === 0 &&
      !isLoading(searchQueryResult.data)
    ) {
      setShowEmptyState(true);
    } else {
      setShowEmptyState(false);
    }
  }, [search, searchQueryResult.data]);
  return (
    <SearchBar<RuleUniversalSearchFilters>
      filters={filters}
      items={items}
      search={search}
      filterParams={universalSearchFilterParams}
      moreFilters={moreFilters}
      onSearch={(newValue) => {
        if (isAIEnabled && !newValue) {
          setSearch('');
          setUniversalSearchFilterParams(DEFAULT_FILTER_PARAMS);
        }
        onSearch(newValue);
      }}
      onSelectItem={onSelectItem}
      onChangeFilterParams={(newFilterParams) => {
        if (
          isAIEnabled &&
          countFilters(newFilterParams) > countFilters(universalSearchFilterParams)
        ) {
          setTriggerAISearch(true);
        }
        setUniversalSearchFilterParams(newFilterParams);
      }}
      placeholder="Search for any rule or use-case using natural language"
      emptyState={{
        title: 'No matching results',
        description: 'Click on ‘Create scenario’ below to configure your own rule from scratch.',
        onAction: () => onScenarioClick(),
        actionLabel: 'Create scenario',
      }}
      onClear={() => {
        setSearch('');
        setUniversalSearchFilterParams(DEFAULT_FILTER_PARAMS);
      }}
      onAISearch={() => {
        setTriggerAISearch(true);
      }}
      showTitleOnSingleItem={!search || search.length > 10}
      isAIEnabled={isAIEnabled}
      setIsAIEnabled={setIsAIEnabled}
      showEmptyState={() => showEmptyState}
    />
  );
};
