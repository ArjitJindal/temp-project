import React from 'react';
import { DEFAULT_RENDERER, findParameter, PARAMETER_RENDERERS } from './helpers';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { Entity, ParameterName } from '@/pages/risk-levels/risk-factors/ParametersTable/types';
import { RiskLevel } from '@/apis';
import { RISK_LEVEL, STRING } from '@/components/library/Table/standardDataTypes';

export interface TableRow {
  entityType: Entity;
  parameter: ParameterName;
  value: unknown;
  riskScore: number;
  riskLevel: RiskLevel;
  weight: number;
}

export interface V8TableRow {
  id: string;
  name: string;
  riskScore: number;
  riskLevel: RiskLevel;
  weight: number;
}

const helper = new ColumnHelper<TableRow>();
const v8helper = new ColumnHelper<V8TableRow>();

export const v8Columns = v8helper.list([
  v8helper.simple<'id'>({
    key: 'id',
    title: 'Id',
    type: STRING,
  }),
  v8helper.simple<'name'>({
    key: 'name',
    title: 'Name',
    type: STRING,
  }),
  v8helper.simple<'riskScore'>({
    key: 'riskScore',
    title: 'Risk score',
    type: {
      render: (value) => <>{Number((value ?? 0.0)?.toFixed(2))}</>,
    },
  }),
  v8helper.simple({
    title: 'Weight',
    key: 'weight',
    type: {
      render: (value) => <>{Number(value ?? 1)}</>,
    },
  }),
  v8helper.simple<'riskLevel'>({
    key: 'riskLevel',
    title: 'Risk value',
    type: RISK_LEVEL,
  }),
]);

export const columns = helper.list([
  helper.derived({
    id: 'riskFactor',
    title: 'Risk factor',
    value: ({ parameter, entityType }) => {
      const parameterDescription = findParameter(entityType, parameter);
      return parameterDescription?.title ?? parameter;
    },
  }),
  helper.display({
    id: 'value',
    title: 'Value',
    render: (entity) => {
      const { entityType, parameter, value } = entity;
      if (value == null) {
        return <>-</>;
      }
      const parameterDescription = findParameter(entityType, parameter);
      if (parameterDescription == null) {
        return JSON.stringify(value);
      }
      const valueRenderer = PARAMETER_RENDERERS[parameterDescription.dataType] ?? DEFAULT_RENDERER;
      return valueRenderer(value).renderer;
    },
  }),
  helper.simple({
    title: 'Risk score',
    key: 'riskScore',
    type: {
      render: (value) => <>{Number((value ?? 0.0)?.toFixed(2))}</>,
    },
  }),
  helper.simple({
    title: 'Weight',
    key: 'weight',
    type: {
      render: (value) => <>{Number(value ?? 1)}</>,
    },
  }),
  helper.simple<'riskLevel'>({
    title: 'Risk value',
    key: 'riskLevel',
    type: RISK_LEVEL,
  }),
]);

export const VARIABLES = [
  ...new Array(('z'.codePointAt(0) as number) - ('a'.codePointAt(0) as number) + 1),
].map((_, i) => String.fromCodePoint(('a'.codePointAt(0) as number) + i));
