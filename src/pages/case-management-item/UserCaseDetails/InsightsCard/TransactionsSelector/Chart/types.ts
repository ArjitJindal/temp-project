import { RuleAction } from '@/apis';

export type PartialRuleAction = Exclude<RuleAction, 'WHITELIST'>;

export const PARTIAL_RULE_ACTIONS: PartialRuleAction[] = ['ALLOW', 'FLAG', 'SUSPEND', 'BLOCK'];

export type Series = { name: string; label: string };

export interface DataItem {
  series: string;
  values: {
    [key in PartialRuleAction]: number;
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
