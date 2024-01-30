import {
  ImmutableTree,
  Fields,
  Types,
  Operators,
  Funcs,
  ValueSource,
} from '@react-awesome-query-builder/core';

export type LogicBuilderConfig = {
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
  enabledValueSources?: ValueSource[];
};

export type LogicBuilderValue = ImmutableTree | undefined;
