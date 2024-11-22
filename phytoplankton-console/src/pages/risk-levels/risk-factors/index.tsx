import React, { useCallback, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useLocalStorageState } from 'ahooks';
import { useQueryClient } from '@tanstack/react-query';
import { ParameterValue, RiskFactorsSimulation } from '../RiskFactorsSimulation';
import { SimulationHistory } from '../RiskFactorsSimulation/SimulationHistoryPage/SimulationHistory';
import ParametersTable from './ParametersTable';
import {
  ALL_RISK_PARAMETERS,
  BUSINESS_RISK_PARAMETERS,
  DEFAULT_RISK_VALUE,
  TRANSACTION_RISK_PARAMETERS,
  USER_RISK_PARAMETERS,
} from './ParametersTable/consts';
import { RiskLevelTableItem } from './ParametersTable/types';
import { Feature } from '@/components/AppWrapper/Providers/SettingsProvider';
import { useApi } from '@/api';
import {
  Entity,
  ParameterName,
  ParameterSettings,
  ParameterValues,
} from '@/pages/risk-levels/risk-factors/ParametersTable/types';
import { ParameterAttributeRiskValues, RiskScoreValueLevel, RiskScoreValueScore } from '@/apis';
import { AsyncResource, failed, getOr, init, loading, success } from '@/utils/asyncResource';
import { getErrorMessage } from '@/utils/lang';
import PageTabs from '@/components/ui/PageTabs';
import { makeUrl } from '@/utils/routing';
import { message } from '@/components/library/Message';
import { BreadcrumbsSimulationPageWrapper } from '@/components/BreadcrumbsSimulationPageWrapper';
import { notEmpty } from '@/utils/array';
import { useQuery } from '@/utils/queries/hooks';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { RISK_FACTORS } from '@/utils/queries/keys';

export default function () {
  const isSimulationMode = window.localStorage.getItem('SIMULATION_RISK_FACTORS') === 'true';
  const { type = isSimulationMode ? 'simulation' : 'consumer' } = useParams();
  return (
    <Feature name="RISK_SCORING" fallback={'Not enabled'}>
      <BreadcrumbsSimulationPageWrapper
        storageKey={'SIMULATION_RISK_FACTORS'}
        nonSimulationDefaultUrl="/risk-levels/risk-factors/"
        simulationDefaultUrl="/risk-levels/risk-factors/simulation"
        breadcrumbs={[
          {
            title: 'Risk factors',
            to: `/risk-levels/risk-factors/${isSimulationMode ? 'simulation' : ''}`,
          },
          type === 'consumer' &&
            !isSimulationMode && {
              title: 'Consumer',
              to: '/risk-levels/risk-factors/consumer',
            },
          type === 'business' &&
            !isSimulationMode && {
              title: 'Business',
              to: '/risk-levels/risk-factors/business',
            },
          type === 'transaction' &&
            !isSimulationMode && {
              title: 'Transaction',
              to: '/risk-levels/risk-factors/transaction',
            },
          (type === 'simulation' || type === 'simulation-history') && {
            title: 'Simulation',
            to: '/risk-levels/risk-factors/simulation',
          },
          type === 'simulation-history' && {
            title: 'Simulation history',
            to: '/risk-levels/risk-factors/simulation-history',
          },
        ].filter(notEmpty)}
        simulationHistoryUrl="/risk-levels/risk-factors/simulation-history"
      >
        <RiskFactors type={type} />
      </BreadcrumbsSimulationPageWrapper>
    </Feature>
  );
}

export function RiskFactors(props: { type: string }) {
  const { type } = props;
  const api = useApi();
  const [valuesResources, setValuesResources] = useState<{
    [key in Entity]?: {
      [key in ParameterName]?: AsyncResource<ParameterSettings>;
    };
  }>({});
  const navigate = useNavigate();
  const [isSimulationMode] = useLocalStorageState('SIMULATION_RISK_FACTORS', false);

  const queryParameterValues = useQuery(RISK_FACTORS(), async () => {
    const response = await api.getPulseRiskParameters();
    return response;
  });

  const queryClient = useQueryClient();

  const updateValuesResources = useCallback(
    (
      entityType: Entity,
      parameter: ParameterName,
      value: AsyncResource<ParameterSettings | null> | null,
    ) => {
      setValuesResources((values) => {
        const newEntity = {
          ...values[entityType],
          [parameter]: value,
        };
        return {
          ...values,
          [entityType]: newEntity,
        };
      });
    },
    [setValuesResources],
  );
  const onUpdateParameter = useCallback(
    async (entityType: Entity, parameter: ParameterName, settings: ParameterSettings) => {
      const lastValue = getOr<ParameterSettings | null>(
        valuesResources[entityType]?.[parameter] ?? init(),
        null,
      );

      updateValuesResources(entityType, parameter, loading(settings));
      const hideSavingMessage = message.loading('Saving...');

      try {
        const riskLevelTableItem = ALL_RISK_PARAMETERS.find(
          (param) => param.parameter === parameter && param.entity === entityType,
        ) as RiskLevelTableItem;
        const response = await api.postPulseRiskParameter({
          PostPulseRiskParameters: {
            parameterAttributeRiskValues: {
              isActive: settings.isActive,
              isDerived: riskLevelTableItem.isDerived,
              parameter,
              parameterType: riskLevelTableItem.parameterType,
              targetIterableParameter: riskLevelTableItem.targetIterableParameter,
              riskEntityType: riskLevelTableItem.entity,
              riskLevelAssignmentValues: settings.values,
              defaultValue: settings.defaultValue,
              weight: settings.weight,
            },
          },
        });
        await queryClient.invalidateQueries(RISK_FACTORS());
        updateValuesResources(
          entityType,
          parameter,
          success<ParameterSettings>({
            isActive: response.isActive,
            values: response.riskLevelAssignmentValues,
            defaultValue: response.defaultValue,
            weight: response.weight,
          }),
        );
        message.success('Saved!');
      } catch (e) {
        updateValuesResources(
          entityType,
          parameter,
          failed<ParameterSettings>(getErrorMessage(e), lastValue),
        );
        message.fatal(`Unable to save parameter! ${getErrorMessage(e)}`, e);
      } finally {
        hideSavingMessage();
      }
    },
    [valuesResources, updateValuesResources, api, queryClient],
  );

  const onSaveValues = useCallback(
    async (
      parameter: ParameterName,
      newValues: ParameterValues,
      entityType: Entity,
      defaultValue: RiskScoreValueLevel | RiskScoreValueScore,
      weight: number,
    ) => {
      const currentParams = getOr<ParameterSettings | null>(
        valuesResources[entityType]?.[parameter] ?? init(),
        null,
      );
      if (currentParams != null) {
        onUpdateParameter(entityType, parameter, {
          ...currentParams,
          values: newValues,
          defaultValue,
          weight,
        });
      }
    },
    [onUpdateParameter, valuesResources],
  );

  const onActivate = useCallback(
    async (entityType: Entity, parameter: ParameterName, isActive: boolean) => {
      const currentParams = getOr<ParameterSettings | null>(
        valuesResources[entityType]?.[parameter] ?? init(),
        null,
      );
      if (currentParams != null) {
        onUpdateParameter(entityType, parameter, {
          ...currentParams,
          isActive,
        });
      }
    },
    [onUpdateParameter, valuesResources],
  );

  const onRefresh = useCallback(
    async (parameter: ParameterName, entityType: Entity): Promise<void> => {
      updateValuesResources(entityType, parameter, loading(null));
      try {
        const response = (await api.getPulseRiskParameter({
          parameter,
          entityType,
        })) as ParameterAttributeRiskValues | null;
        updateValuesResources(
          entityType,
          parameter,
          success<ParameterSettings>({
            isActive: response?.isActive ?? false,
            values: response?.riskLevelAssignmentValues ?? [],
            defaultValue: response?.defaultValue ?? DEFAULT_RISK_VALUE,
            weight: response?.weight ?? 1,
          }),
        );
      } catch (e) {
        console.error(`Unable to fetch parameter values! ${getErrorMessage(e)}`);
        updateValuesResources(
          entityType,
          parameter,
          success<ParameterSettings>({
            isActive: false,
            values: [],
            defaultValue: DEFAULT_RISK_VALUE,
            weight: 1,
          }),
        );
      }
    },
    [api, updateValuesResources],
  );
  return (
    <div>
      {isSimulationMode ? (
        type !== 'simulation-history' ? (
          <AsyncResourceRenderer resource={queryParameterValues.data}>
            {(data) => {
              const parameterValues: ParameterValue = {};
              data.map((item) => {
                parameterValues[item.riskEntityType] = {
                  ...(parameterValues[item.riskEntityType] ?? {}),
                  [item.parameter]: success({
                    isActive: item.isActive,
                    values: item.riskLevelAssignmentValues,
                    defaultValue: item.defaultValue,
                    weight: item.weight,
                    parameterType: item.parameterType,
                  }),
                };
              });
              return <RiskFactorsSimulation riskFactors={[]} parameterValues={parameterValues} />;
            }}
          </AsyncResourceRenderer>
        ) : (
          <SimulationHistory />
        )
      ) : (
        <PageTabs
          activeKey={type}
          onChange={(key) => {
            navigate(makeUrl(`/risk-levels/risk-factors/:type`, { type: key }), { replace: true });
          }}
          items={[
            {
              key: 'consumer',
              title: 'Consumer',
              children: (
                <ParametersTable
                  parameters={USER_RISK_PARAMETERS}
                  parameterSettings={valuesResources['CONSUMER_USER']}
                  onRefresh={onRefresh}
                  onSaveValues={onSaveValues}
                  onActivate={onActivate}
                />
              ),
            },
            {
              key: 'business',
              title: 'Business',
              children: (
                <ParametersTable
                  parameters={BUSINESS_RISK_PARAMETERS}
                  parameterSettings={valuesResources['BUSINESS']}
                  onRefresh={onRefresh}
                  onSaveValues={onSaveValues}
                  onActivate={onActivate}
                />
              ),
            },
            {
              key: 'transaction',
              title: 'Transaction',
              children: (
                <ParametersTable
                  parameters={TRANSACTION_RISK_PARAMETERS}
                  parameterSettings={valuesResources['TRANSACTION']}
                  onRefresh={onRefresh}
                  onSaveValues={onSaveValues}
                  onActivate={onActivate}
                />
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
