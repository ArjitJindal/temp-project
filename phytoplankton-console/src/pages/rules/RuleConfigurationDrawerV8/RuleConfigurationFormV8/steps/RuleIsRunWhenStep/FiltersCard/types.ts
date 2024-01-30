import { Option as SelectOption } from '@/components/library/Select';
import { RuleLogic } from '@/pages/rules/RuleConfigurationDrawerV8/RuleConfigurationFormV8/types';
import { Option as SelectionGroupOption } from '@/components/library/SelectionGroup';

export type FilterDataType =
  | {
      kind: 'STRING';
    }
  | {
      kind: 'NUMBER';
      min?: number;
      max?: number;
    }
  | {
      kind: 'BOOLEAN';
    }
  | {
      kind: 'DATE';
    }
  | {
      kind: 'AGE_RANGE';
    }
  | {
      kind: 'SELECT';
      mode: 'SINGLE' | 'MULTIPLE';
      options: SelectOption<string>[];
      placeholder?: string;
    }
  | {
      kind: 'SELECTION_GROUP';
      defaultValue: string;
      options: SelectionGroupOption<string>[];
    };

export interface FilterBuildLogicContext<Values> {
  deps: Values;
}

export interface Filter<Values> {
  name: string;
  title: string;
  description: string;
  valueType: FilterDataType;
  buildLogic?: (value: unknown, context: FilterBuildLogicContext<Values>) => RuleLogic | undefined;
}
