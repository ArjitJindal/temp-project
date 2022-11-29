import React, { useCallback, useState } from 'react';
import { message, Tabs } from 'antd';
import { useNavigate, useParams } from 'react-router';
import ParametersTable from './ParametersTable';
import {
  ALL_RISK_PARAMETERS,
  BUSINESS_RISK_PARAMETERS,
  TRANSACTION_RISK_PARAMETERS,
  USER_RISK_PARAMETERS,
} from './ParametersTable/consts';
import { RiskLevelTableItem } from './ParametersTable/types';
import PageWrapper from '@/components/PageWrapper';
import { useI18n } from '@/locales';
import { Feature } from '@/components/AppWrapper/Providers/SettingsProvider';
import { useApi } from '@/api';
import {
  ParameterName,
  ParameterSettings,
  ParameterValues,
  Entity,
} from '@/pages/risk-levels/risk-level/ParametersTable/types';
import { ParameterAttributeRiskValues } from '@/apis';
import { AsyncResource, failed, getOr, init, loading, success } from '@/utils/asyncResource';
import { getErrorMessage } from '@/utils/lang';
import PageTabs from '@/components/ui/PageTabs';
import { makeUrl } from '@/utils/routing';

export default function () {
  const i18n = useI18n();
  const api = useApi();
  const [valuesResources, setValuesResources] = useState<{
    [key in Entity]?: {
      [key in ParameterName]?: AsyncResource<ParameterSettings>;
    };
  }>({});
  const { type = 'consumer' } = useParams<'type'>();
  const navigate = useNavigate();

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
      const hideSavingMessage = message.loading('Saving...', 0);

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
              riskScoreType: riskLevelTableItem.riskScoreType,
              matchType: riskLevelTableItem.matchType,
              targetIterableParameter: riskLevelTableItem.targetIterableParameter,
              riskEntityType: riskLevelTableItem.entity,
              // riskValueType: riskLevelTableItem.type,
              riskLevelAssignmentValues: settings.values,
            },
          },
        });
        updateValuesResources(
          entityType,
          parameter,
          success<ParameterSettings>({
            isActive: response.isActive,
            values: response.riskLevelAssignmentValues,
          }),
        );
        message.success('Saved!');
      } catch (e) {
        updateValuesResources(
          entityType,
          parameter,
          failed<ParameterSettings>(getErrorMessage(e), lastValue),
        );
        message.error(`Unable to save parameter! ${getErrorMessage(e)}`);
      } finally {
        hideSavingMessage();
      }
    },
    [valuesResources, updateValuesResources, api],
  );

  const onSaveValues = useCallback(
    async (parameter: ParameterName, newValues: ParameterValues, entityType: Entity) => {
      const currentParams = getOr<ParameterSettings | null>(
        valuesResources[entityType]?.[parameter] ?? init(),
        null,
      );
      if (currentParams != null) {
        onUpdateParameter(entityType, parameter, {
          ...currentParams,
          values: newValues,
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
          }),
        );
      }
    },
    [api, updateValuesResources],
  );
  return (
    <Feature name="PULSE" fallback={'Not enabled'}>
      <PageWrapper
        title={i18n('menu.risk-levels.risk-level')}
        description={i18n('menu.risk-levels.risk-level.description')}
      >
        <PageTabs
          activeKey={type}
          onChange={(key) => {
            navigate(makeUrl(`/risk-levels/risk-level/:type`, { type: key }), { replace: true });
          }}
        >
          <Tabs.TabPane tab="Consumer" key="consumer">
            <ParametersTable
              parameters={USER_RISK_PARAMETERS}
              parameterSettings={valuesResources['CONSUMER_USER']}
              onRefresh={onRefresh}
              onSaveValues={onSaveValues}
              onActivate={onActivate}
            />
          </Tabs.TabPane>
          <Tabs.TabPane tab="Business" key="business">
            <ParametersTable
              parameters={BUSINESS_RISK_PARAMETERS}
              parameterSettings={valuesResources['BUSINESS']}
              onRefresh={onRefresh}
              onSaveValues={onSaveValues}
              onActivate={onActivate}
            />
          </Tabs.TabPane>
          <Tabs.TabPane tab="Transaction" key="transaction">
            <ParametersTable
              parameters={TRANSACTION_RISK_PARAMETERS}
              parameterSettings={valuesResources['TRANSACTION']}
              onRefresh={onRefresh}
              onSaveValues={onSaveValues}
              onActivate={onActivate}
            />
          </Tabs.TabPane>
        </PageTabs>
      </PageWrapper>
    </Feature>
  );
}
