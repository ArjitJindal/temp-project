import React from 'react';
import ValuesTable from './ValuesTable';
import {
  Entity,
  ParameterValues,
  ParameterName,
  RiskLevelTableItem,
} from '@/pages/risk-levels/risk-factors/ParametersTable/types';
import { useHasPermissions } from '@/utils/user-utils';

interface Props {
  parameter: RiskLevelTableItem;
  onSave: (
    parameter: ParameterName,
    newValues: ParameterValues,
    entity: Entity,
    defaultRiskValue: any,
    weight: number,
  ) => void;
  canEditParameters?: boolean;
  values: ParameterValues;
  setValues: (values: ParameterValues) => void;
  entity: Entity;
  defaultRiskValue: any;
  weight: number;
  setDefaultRiskValue: (value: any) => void;
  setWeight: (value: number) => void;
  initialValues?: ParameterValues;
}

function ParametersTable(props: Props) {
  const {
    parameter,
    values,
    setValues,
    entity,
    defaultRiskValue,
    weight,
    setDefaultRiskValue,
    setWeight,
    onSave,
    canEditParameters = true,
    initialValues,
  } = props;
  const canEdit = useHasPermissions(['risk-scoring:risk-levels:write']) && canEditParameters;

  return (
    <ValuesTable
      parameter={parameter}
      values={values}
      setValues={setValues}
      entity={entity}
      defaultRiskValue={defaultRiskValue}
      weight={weight}
      setDefaultRiskValue={setDefaultRiskValue}
      setWeight={setWeight}
      onSave={onSave}
      canEditParameters={canEdit}
      initialValues={initialValues}
    />
  );
}

export default ParametersTable;
