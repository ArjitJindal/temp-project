import { CurrencyCode, RuleAction, TransactionState } from '@/apis';

export const PARTIAL_RULE_ACTIONS: RuleAction[] = ['ALLOW', 'FLAG', 'SUSPEND', 'BLOCK'];

export type Series = { name: string; label: string };

export interface DataItem {
  series: string;
  values: {
    [key in RuleAction | TransactionState | CurrencyCode]: number;
  };
}

export interface Settings {
  width: number;
  height: number;
}

export interface CalculatedParams {
  yMax: number;
  xLabelFontSize: number;
  columnWidth: number;
  gap: number;
}
