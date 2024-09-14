import { uniq } from 'lodash';
import { humanizeConstant } from '@flagright/lib/utils/humanize';
import { SanctionsComparisonTableItem, SanctionsComparisonTableItemMatch } from './types';
import { ComplyAdvantageNameMatched, SanctionsHitContext, SanctionsMatchTypeDetails } from '@/apis';
import { notEmpty } from '@/utils/array';

export function getComparisonItems(
  matchTypeDetails: SanctionsMatchTypeDetails[],
  ctx: SanctionsHitContext,
): SanctionsComparisonTableItem[] {
  // Make a single item for every match in every caMatchTypesDetails
  const plainItems = (matchTypeDetails ?? []).flatMap((details): SanctionsComparisonTableItem[] => {
    const { entity, entityType, searchTerm, yearOfBirth } = ctx ?? {};
    const { sources, matchingName, secondaryMatches = [], nameMatches = [] } = details;
    let nameTitle = 'Name';
    if (entity === 'BANK') {
      nameTitle = 'Bank name';
    } else if (entityType === 'CONSUMER_NAME') {
      nameTitle = 'Consumer name';
    } else if (entityType != null) {
      nameTitle = `Name (${humanizeConstant(entityType)})`;
    }
    return [
      nameMatches.length > 0 && {
        title: nameTitle,
        screeningValue: matchingName,
        kycValue: searchTerm,
        match: reduceMatched(nameMatches),
        sources: sources ?? [],
      },
      secondaryMatches.length > 0 && {
        title: 'Date of birth',
        screeningValue: secondaryMatches.map(({ query_term }) => query_term).join(', '),
        kycValue: yearOfBirth,
        match: reduceMatched(secondaryMatches),
        sources: sources ?? [],
      },
    ].filter(notEmpty);
  });

  // Group items with the same values, combining sources
  const comparisonItemsGroups: {
    sources: string[];
    items: SanctionsComparisonTableItem[];
  }[] = [];
  for (const item of plainItems) {
    const existedGroup = comparisonItemsGroups.find((group) => {
      return group.items.some(
        (x) =>
          x.title === item.title &&
          x.screeningValue === item.screeningValue &&
          x.kycValue === item.kycValue &&
          x.match === item.match,
      );
    });
    if (existedGroup) {
      existedGroup.sources.push(...item.sources);
      existedGroup.sources = uniq(existedGroup.sources);
    } else {
      const existedGroupBySource = comparisonItemsGroups.find((group) => {
        return group.sources.some((x) => item.sources.includes(x));
      });
      if (existedGroupBySource) {
        existedGroupBySource.items.push(item);
      } else {
        comparisonItemsGroups.push({
          sources: item.sources,
          items: [item],
        });
      }
    }
  }
  return comparisonItemsGroups.flatMap(({ sources, items }) =>
    items.map((x) => ({ ...x, sources })),
  );
}

export function reduceMatched(
  matches: ComplyAdvantageNameMatched[],
): SanctionsComparisonTableItemMatch {
  const matchTypes: SanctionsComparisonTableItemMatch[] = matches
    .flatMap(({ match_types }) => match_types ?? [])
    .map((x) => {
      let matchType: SanctionsComparisonTableItemMatch;
      switch (x) {
        case 'exact_match':
        case 'exact_birth_year_match':
        case 'fuzzy_birth_year_match':
        case 'equivalent_name':
          matchType = 'TRUE_HIT';
          break;
        default:
          matchType = 'POTENTIAL_HIT';
      }
      return matchType;
    });

  if (matchTypes.length === 0) {
    return 'NO_HIT';
  }
  if (!matchTypes.some((x) => x !== 'TRUE_HIT')) {
    return 'TRUE_HIT';
  }
  return 'POTENTIAL_HIT';
}
