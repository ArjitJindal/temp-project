import { useCallback, useMemo, useState } from 'react';
import { compact, sortBy, uniq } from 'lodash';
import { useDebounce, useLocalStorageState } from 'ahooks';
import { replaceMagicKeyword } from '@flagright/lib/utils/object';
import { DEFAULT_CURRENCY_KEYWORD } from '@flagright/lib/constants/currency';
import { Rule, RuleNature } from '@/apis';
import { FilterProps } from '@/components/library/Filter/types';
import SearchBar from '@/components/library/SearchBar';
import { ItemGroup, Item } from '@/components/library/SearchBar/SearchBarDropdown';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { RULES_UNIVERSAL_SEARCH } from '@/utils/queries/keys';
import { success } from '@/utils/asyncResource';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import { Option } from '@/components/library/Select';

type Props = {
  rules: Rule[];
  onSelectedRule: (rule: Rule) => void;
};

type RuleUniversalSearchFilters = {
  typology: string[];
  checksFor: string[];
  defaultNature: RuleNature[];
};

const RECENT_RULE_SEARCHES_KEY = 'recent-rule-searches';

export const RulesSearchBar = (props: Props) => {
  const { rules, onSelectedRule } = props;
  const settings = useSettings();

  const [universalSearchFilterParams, setUniversalSearchFilterParams] =
    useState<RuleUniversalSearchFilters>({ typology: [], checksFor: [], defaultNature: [] });

  const [search, setSearch] = useState<string>();

  const debouncedSearch = useDebounce(search, { wait: 300 });

  const [recentSearches, setRecentSearches] = useLocalStorageState<
    (Item & { timestamp: number })[]
  >(RECENT_RULE_SEARCHES_KEY, []);

  const getRuleOptionsByKey = useCallback(
    (key: keyof Rule): Option<string>[] =>
      sortBy(compact(uniq(rules.flatMap((rule) => rule[key])))).map((label) => ({
        label,
        value: label,
      })),
    [rules],
  );

  const getRuleFilter = useCallback(
    (label: string, key: keyof Rule): FilterProps<RuleUniversalSearchFilters> => ({
      key,
      title: label,
      kind: 'AUTO',
      dataType: {
        kind: 'select',
        options: getRuleOptionsByKey(key),
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
    ];

    return filters;
  }, [getRuleFilter]);

  const onSearch = useCallback((newValue: string | undefined) => {
    setSearch(newValue);
  }, []);

  const api = useApi();

  const searchQueryResult = useQuery<ItemGroup[]>(
    RULES_UNIVERSAL_SEARCH(debouncedSearch || '', universalSearchFilterParams),
    async () => {
      if (!debouncedSearch) {
        return [];
      }

      const rulesSearchResult = await api.getRulesSearch({
        queryStr: debouncedSearch || '',
        filterTypology: universalSearchFilterParams.typology,
        filterChecksFor: universalSearchFilterParams.checksFor,
        filterNature: universalSearchFilterParams.defaultNature,
      });

      const rules = replaceMagicKeyword(
        rulesSearchResult,
        DEFAULT_CURRENCY_KEYWORD,
        settings.defaultValues?.currency ?? 'USD',
      );

      return [
        {
          items: rules.map((rule) => ({
            itemDescription: rule.description,
            itemId: rule.id,
            itemName: rule.name,
          })),
          title: 'Best results',
        },
      ];
    },
  );

  return (
    <SearchBar
      filters={universalSearchFilters}
      items={
        search
          ? searchQueryResult.data
          : success<ItemGroup[]>([
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
            ])
      }
      search={search}
      filterParams={universalSearchFilterParams}
      onSearch={onSearch}
      onSelectItem={(item) => {
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
      }}
      onChangeFilterParams={setUniversalSearchFilterParams}
      placeholder="Search for any rule or use-case using natural language"
      emptyState={{
        title: 'No matching results',
        description: 'Click on ‘Create scenario’ below to configure your own rule from scratch.',
        onAction: () => {
          alert('onAction');
        },
        actionLabel: 'Create scenario',
      }}
    />
  );
};
