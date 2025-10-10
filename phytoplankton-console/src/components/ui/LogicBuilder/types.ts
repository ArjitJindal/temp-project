import { Fields, Funcs, ImmutableTree, Operators, Types } from '@react-awesome-query-builder/core';
import { Config, CoreOperators } from '@react-awesome-query-builder/ui';
import { TagColor } from '@/components/library/Tag';

type LogicBuilderMode = 'EDIT' | 'VIEW';

export type LogicBuilderConfig = {
  mode?: LogicBuilderMode;
  fields: Fields;
  types?: Types;
  operators?: Operators;
  funcs?: Funcs;
  addRuleLabel?: string;
  addGroupLabel?: string;
  enableNesting?: boolean;
  enableReorder?: boolean;
  hideLabels?: boolean;
  disableVariablesSource?: string[];
  onClickVariable?: (name: string) => void;
};

export type LogicBuilderValue = ImmutableTree | undefined;

export type QueryBuilderConfig = Omit<Config, 'operators'> & {
  operators: Omit<CoreOperators<Config>, 'multiselect_not_contains' | 'multiselect_contains'>;
} & {
  settings: Config['settings'] & {
    mode: LogicBuilderMode;
    variableColors?: { [variableName: string]: TagColor | undefined };
    onClickVariable?: (name: string) => void;
  };
};
