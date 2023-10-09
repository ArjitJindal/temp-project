import React from 'react';
import { MatchListDropdown } from './MatchListDropdown';
import { SanctionsDetails } from '@/apis';
import Tabs from '@/components/library/Tabs';

interface Props {
  details: SanctionsDetails[];
}

export default function ScreeningMatchList(props: Props) {
  const { details } = props;

  return (
    <Tabs
      type="line"
      items={[
        {
          tab: 'Match list',
          key: 'match_list',
          children: <MatchListDropdown details={details} />,
        },
      ]}
    />
  );
}
