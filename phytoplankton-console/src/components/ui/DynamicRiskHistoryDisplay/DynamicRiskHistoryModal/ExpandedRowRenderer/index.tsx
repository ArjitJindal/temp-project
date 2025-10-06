import {
  BUSINESS_RISK_PARAMETERS,
  TRANSACTION_RISK_PARAMETERS,
  USER_RISK_PARAMETERS,
} from '@flagright/lib/utils/risk-parameters';
import { isNotArsChangeTxId } from '@flagright/lib/utils/risk';
import { keyBy } from 'lodash';
import s from './index.module.less';
import { useApi } from '@/api';
import { ExtendedDrsScore, RiskLevel } from '@/apis';
import Table from '@/components/library/Table';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { NUMBER, RISK_LEVEL, STRING } from '@/components/library/Table/standardDataTypes';
import { H4 } from '@/components/ui/Typography';
import { useQuery } from '@/utils/queries/hooks';
import { RISK_FACTOR_LOGIC, RISK_FACTORS_V8 } from '@/utils/queries/keys';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import InformationLineIcon from '@/components/ui/icons/Remix/system/information-line.react.svg';
import LogicDisplay from '@/components/ui/LogicDisplay';
import Tooltip from '@/components/library/Tooltip';
import COLORS from '@/components/ui/colors';

export type TableItem = {
  name: string;
  value: any;
  riskScore: number;
  weight: number;
  riskLevel: RiskLevel;
  rowKey: string;
  isCustom: boolean;
  riskFactorId?: string;
  versionId?: string;
};

export type CoustomRiskFactorLogicProps = {
  riskFactorId: string;
  versionId: string;
  riskLevel: RiskLevel;
};

function CustomRiskFactorLogic(props: CoustomRiskFactorLogicProps) {
  const api = useApi();

  const riskFactorLogic = useQuery(
    RISK_FACTOR_LOGIC(props.riskFactorId, props.versionId, props.riskLevel),
    async () => {
      const data = await api.riskFactorLogic({
        riskFactorId: props.riskFactorId,
        versionId: props.versionId,
        riskLevel: props.riskLevel,
      });
      return data;
    },
  );

  return (
    <Tooltip
      placement="top"
      arrowColor={COLORS.white}
      overlay={
        <div className={s.riskFactorLogicModal}>
          <div className={s.title}>Risk factor configuration</div>
          <AsyncResourceRenderer
            resource={riskFactorLogic.data}
            renderFailed={() => <div>Risk factor logic not found</div>}
          >
            {(data) => {
              if (data.isDefaultRiskLevel) {
                return (
                  <span>
                    Default (value does not meet any defined risk factor logic conditions).
                  </span>
                );
              }
              return (
                <LogicDisplay
                  logic={data.riskFactorLogic?.logic ?? {}}
                  entityVariables={data.riskFactorEntityVariables}
                  aggregationVariables={data.riskFactorAggregationVariables}
                  ruleType={'USER'}
                />
              );
            }}
          </AsyncResourceRenderer>
        </div>
      }
    >
      <InformationLineIcon className={s.infoIcon} />
    </Tooltip>
  );
}

function ExpandedRowRenderer(props: ExtendedDrsScore) {
  const label = isNotArsChangeTxId(props.transactionId) ? 'KRS' : 'TRS';
  const api = useApi();
  const columnHelper = new ColumnHelper<TableItem>();
  const columns = columnHelper.list([
    columnHelper.display({
      id: 'name',
      title: 'Risk factor name',
      render: (item, { item: entity }) => {
        return (
          <div className={s.riskFactorName}>
            {item.name}{' '}
            {entity.isCustom && entity.riskFactorId && entity.versionId && entity.riskLevel && (
              <CustomRiskFactorLogic
                riskFactorId={entity.riskFactorId}
                versionId={entity.versionId}
                riskLevel={entity.riskLevel}
              />
            )}
          </div>
        );
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
  const factorMapResult = useQuery(RISK_FACTORS_V8('ALL'), async () => {
    const data = await api.getAllRiskFactors({ includeV2: true });
    return keyBy(data, 'id');
  });
  const defaultFactorsDataComponents =
    props.components?.map((val): TableItem => {
      const dataSource =
        val.entityType === 'BUSINESS'
          ? BUSINESS_RISK_PARAMETERS
          : val.entityType === 'CONSUMER_USER'
          ? USER_RISK_PARAMETERS
          : TRANSACTION_RISK_PARAMETERS;
      const name = dataSource.find((dt) => dt.parameter === val.parameter)?.title ?? val.parameter;
      if (
        val.parameter === 'originAmountDetails.transactionAmount' ||
        val.parameter === 'destinationAmountDetails.transactionAmount'
      ) {
        return {
          name,
          value: val.value?.transactionAmount ?? '-',
          riskScore: val.score,
          weight: val.weight,
          riskLevel: val.riskLevel,
          rowKey: val.parameter,
          isCustom: false,
        };
      }
      return {
        name,
        value: val.value,
        riskScore: val.score,
        weight: val.weight,
        riskLevel: val.riskLevel,
        rowKey: val.parameter,
        isCustom: false,
      };
    }) ?? [];

  return (
    <AsyncResourceRenderer resource={factorMapResult.data}>
      {(factorMap) => {
        const defaultFactorsData =
          props.factorScoreDetails
            ?.map((val): TableItem | null => {
              const parameter = factorMap[val.riskFactorId]?.parameter;
              if (!parameter) {
                return null;
              }
              const name = factorMap[val.riskFactorId]?.name ?? '-';
              return {
                name,
                value: factorMap[val.riskFactorId]?.description ?? '-',
                riskScore: val.score,
                weight: val.weight,
                riskLevel: val.riskLevel,
                isCustom: false,
                rowKey: parameter ?? '',
              };
            })
            .filter((item): item is TableItem => item !== null) ?? [];
        const allDefaultFactors = [...defaultFactorsDataComponents, ...defaultFactorsData];
        const finalDefaultFactorsData = allDefaultFactors.reduce((acc, current) => {
          const existingIndex = acc.findIndex((item) => item.rowKey === current.rowKey);
          if (existingIndex === -1) {
            acc.push(current);
          } else {
            acc[existingIndex] = current;
          }
          return acc;
        }, [] as TableItem[]);
        const customRiskFactorsData =
          props.factorScoreDetails
            ?.map((val): TableItem => {
              const isDefault = !!factorMap[val.riskFactorId]?.parameter;
              return {
                name: factorMap[val.riskFactorId]?.name ?? '-',
                value: factorMap[val.riskFactorId]?.description ?? '-',
                riskScore: val.score,
                riskLevel: val.riskLevel,
                weight: val.weight,
                rowKey: val.riskFactorId,
                isCustom: !isDefault,
                riskFactorId: val.riskFactorId,
                versionId: val.versionId ?? 'CURRENT',
              };
            })
            .filter((val) => val.isCustom) ?? [];
        return (
          <div>
            <H4>{`${label} risk factors`}</H4>
            <Table<TableItem>
              hideFilters
              columns={columns}
              toolsOptions={false}
              rowKey="rowKey"
              data={{ items: finalDefaultFactorsData?.concat(customRiskFactorsData) }}
            ></Table>
          </div>
        );
      }}
    </AsyncResourceRenderer>
  );
}

export default ExpandedRowRenderer;
