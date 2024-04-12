import React from 'react';
import { DEFAULT_RENDERER, findParameter, PARAMETER_RENDERERS } from './helpers';
import { RISK_LEVEL } from '@/components/library/Table/standardDataTypes';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { Entity, ParameterName } from '@/pages/risk-levels/risk-factors/ParametersTable/types';
import { RiskLevel } from '@/utils/risk-levels';

export interface TableRow {
  entityType: Entity;
  parameter: ParameterName;
  value: unknown;
  riskScore: number;
  riskLevel: RiskLevel;
  weight: number;
}

const helper = new ColumnHelper<TableRow>();

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
  helper.simple({
    title: 'Risk level',
    key: 'riskLevel',
    type: RISK_LEVEL,
  }),
]);
