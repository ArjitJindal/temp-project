import { ImmutableTree, Fields, Types, Operators, Funcs } from '@react-awesome-query-builder/core';

export type LogicBuilderConfig = {
  fields: Fields;
  types?: Types;
  operators?: Operators;
  funcs?: Funcs;
  disableNesting?: boolean;
};

export type LogicBuilderValue = ImmutableTree | undefined;
