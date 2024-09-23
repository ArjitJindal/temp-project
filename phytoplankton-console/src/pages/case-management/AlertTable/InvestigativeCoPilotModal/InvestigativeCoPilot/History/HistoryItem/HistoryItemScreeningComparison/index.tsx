import React from 'react';
import { QuestionResponseScreeningComparison } from '../../../types';
import SanctionsComparison, {
  getComparisonItems,
} from '@/components/SanctionsHitsTable/SearchResultDetailsDrawer/SanctionsComparison';
import { P } from '@/components/ui/Typography';

interface Props {
  item: QuestionResponseScreeningComparison;
}

export default function HistoryItemScreeningComparison(props: Props) {
  const { item } = props;
  const { sanctionsHit } = item;
  const comparisonItems = getComparisonItems(
    sanctionsHit?.entity.matchTypeDetails || [],
    sanctionsHit?.hitContext || {},
  );
  if (comparisonItems.length == 0) {
    return (
      <P grey={true}>There is no data to show difference between screening and KYC information</P>
    );
  }
  return <SanctionsComparison items={comparisonItems} />;
}
