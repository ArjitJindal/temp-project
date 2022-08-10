import React from 'react';
import { RuleAction } from '@/apis';
import '../../components/ui/colors';

export type TableSearchParams = Partial<{
  current: number;
  timestamp: string[];
  transactionId: string;
  rulesHitFilter: Array<string>;
  rulesExecutedFilter: Array<string>;
  originCurrenciesFilter: Array<string>;
  destinationCurrenciesFilter: Array<string>;
  originUserId: string;
  destinationUserId: string;
  type: string;
  status: RuleAction;
  originMethodFilter: string;
  destinationMethodFilter: string;
}>;
