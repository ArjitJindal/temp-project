import {
  BUSINESS_RISK_PARAMETERS,
  isNotArsChangeTxId,
  TRANSACTION_RISK_PARAMETERS,
  USER_RISK_PARAMETERS,
} from '@flagright/lib/utils/risk';
import { keyBy } from 'lodash';
import React from 'react';
import { useApi } from '@/api';
import { ExtendedDrsScore, RiskLevel } from '@/apis';
import Table from '@/components/library/Table';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { NUMBER, RISK_LEVEL, STRING } from '@/components/library/Table/standardDataTypes';
import { H4 } from '@/components/ui/Typography';
import { getOr } from '@/utils/asyncResource';
import { useQuery } from '@/utils/queries/hooks';
import { RISK_FACTORS_V8 } from '@/utils/queries/keys';

export type TableItem = {
  name: string;
  value: any;
  riskScore: number;
  weight: number;
  riskLevel: RiskLevel;
};

function ExpandedRowRenderer(props: ExtendedDrsScore) {
  const label = isNotArsChangeTxId(props.transactionId) ? 'KRS' : 'TRS';
  const api = useApi();
  const columnHelper = new ColumnHelper<TableItem>();
  const columns = columnHelper.list([
    columnHelper.display({
      // Todo fdt-6098: Display logic on info icon
      id: 'name',
      title: 'Risk factor name',
      render: (item) => {
        return <>{item.name}</>;
      },
      defaultWidth: 200,
    }),
    columnHelper.simple<'value'>({
      title: 'Value',
      key: 'value',
      type: STRING,
      defaultWidth: 400,
    }),
    columnHelper.simple<'riskScore'>({
      title: 'Risk score',
      key: 'riskScore',
      type: NUMBER,
      defaultWidth: 200,
    }),
    columnHelper.simple<'weight'>({
      title: 'Weight',
      key: 'weight',
      type: NUMBER,
      defaultWidth: 200,
    }),
    columnHelper.simple<'riskLevel'>({
      title: 'Risk level',
      key: 'riskLevel',
      type: RISK_LEVEL,
      defaultWidth: 200,
    }),
  ]);
  const factorMapResult = useQuery(RISK_FACTORS_V8('ALL', true), async () => {
    const data = await api.getAllRiskFactors({ includeV2: true });
    return keyBy(data, 'id');
  });
  const defaultFactorsData =
    props.components?.map((val): TableItem => {
      const dataSource =
        val.entityType === 'BUSINESS'
          ? BUSINESS_RISK_PARAMETERS
          : val.entityType === 'CONSUMER_USER'
          ? USER_RISK_PARAMETERS
          : TRANSACTION_RISK_PARAMETERS;
      const name = dataSource.find((dt) => dt.parameter === val.parameter)?.title ?? val.parameter;
      return {
        name,
        value: val.value,
        riskScore: val.score,
        weight: val.weight,
        riskLevel: val.riskLevel,
      };
    }) ?? [];
  const factorMap = getOr(factorMapResult.data, {});
  const customRiskFactorsData =
    props.factorScoreDetails?.map((val): TableItem => {
      return {
        name: factorMap[val.riskFactorId]?.name ?? '-',
        value: factorMap[val.riskFactorId]?.description ?? '-',
        riskScore: val.score,
        riskLevel: val.riskLevel,
        weight: val.weight,
      };
    }) ?? [];
  return (
    <div>
      <H4>{`${label} risk factors`}</H4>
      <Table<TableItem>
        hideFilters
        columns={columns}
        toolsOptions={false}
        rowKey="name"
        data={{ items: defaultFactorsData?.concat(customRiskFactorsData) }}
      ></Table>
    </div>
  );
}

export default ExpandedRowRenderer;
