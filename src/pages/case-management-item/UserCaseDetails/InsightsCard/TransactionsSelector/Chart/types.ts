import { RuleAction } from '@/apis';

export interface DataItem {
  series: string;
  values: {
    [key in RuleAction]: number;
  };
}

export interface Settings {
  width: number;
  height: number;
}
