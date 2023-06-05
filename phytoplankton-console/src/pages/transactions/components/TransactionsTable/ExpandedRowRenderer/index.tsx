import React from 'react';
import { getFlatSanctionsDetails } from './helpers';
import ScreeningMatchList from '@/components/ScreeningMatchList';
import { InternalTransaction } from '@/apis';

interface Props {
  transaction: InternalTransaction;
}

export default function ExpandedRowRenderer(props: Props) {
  const { transaction } = props;
  return <ScreeningMatchList details={getFlatSanctionsDetails(transaction)} />;
}
