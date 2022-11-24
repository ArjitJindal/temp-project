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
    [key in ParameterName]?: AsyncResource<ParameterSettings>;
  }>({});
  const { type = 'consumer' } = useParams<'type'>();
  const navigate = useNavigate();

  const onUpdateParameter = useCallback(
    async (parameter: ParameterName, settings: ParameterSettings) => {
      const lastValue = getOr<ParameterSettings | null>(valuesResources[parameter] ?? init(), null);

      setValuesResources((values) => ({
        ...values,
        [parameter]: loading(settings),
      }));
      const hideSavingMessage = message.loading('Saving...', 0);

      try {
        const riskLevelTableItem = ALL_RISK_PARAMETERS.find(
          (param) => param.parameter === parameter,
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
        setValuesResources((values) => ({
          ...values,
          [parameter]: success<ParameterSettings>({
            isActive: response.isActive,
            values: response.riskLevelAssignmentValues,
          }),
        }));
        message.success('Saved!');
      } catch (e) {
        setValuesResources((values) => ({
          ...values,
          [parameter]: failed<ParameterSettings>(getErrorMessage(e), lastValue),
        }));
        message.error(`Unable to save parameter! ${getErrorMessage(e)}`);
      } finally {
        hideSavingMessage();
      }
    },
    [valuesResources, api],
  );

  const onSaveValues = useCallback(
    async (parameter: ParameterName, newValues: ParameterValues) => {
      const currentParams = getOr<ParameterSettings | null>(
        valuesResources[parameter] ?? init(),
        null,
      );
      if (currentParams != null) {
        onUpdateParameter(parameter, {
          ...currentParams,
          values: newValues,
        });
      }
    },
    [onUpdateParameter, valuesResources],
  );

  const onActivate = useCallback(
    async (parameter: ParameterName, isActive: boolean) => {
      const currentParams = getOr<ParameterSettings | null>(
        valuesResources[parameter] ?? init(),
        null,
      );
      if (currentParams != null) {
        onUpdateParameter(parameter, {
          ...currentParams,
          isActive,
        });
      }
    },
    [onUpdateParameter, valuesResources],
  );

  const onRefresh = useCallback(
    async (parameter: ParameterName): Promise<void> => {
      setValuesResources((values) => {
        const lastRes: AsyncResource<ParameterSettings> | null = values[parameter] ?? null;
        return {
          ...values,
          [parameter]: loading(lastRes ? getOr(lastRes, null) : null),
        };
      });
      try {
        const response = (await api.getPulseRiskParameter({
          parameter,
        })) as ParameterAttributeRiskValues | null;
        // const response: ParameterAttributeRiskValues | null = null
        setValuesResources((values) => ({
          ...values,
          [parameter]: success<ParameterSettings>({
            isActive: response?.isActive ?? false,
            values: response?.riskLevelAssignmentValues ?? [],
          }),
        }));
      } catch (e) {
        console.error(`Unable to fetch parameter values! ${getErrorMessage(e)}`);
        // message.error(`Unable to fetch parameter values!`); Hack for the sales call tomorrow
        setValuesResources((values) => ({
          ...values,
          [parameter]: success<ParameterSettings>({
            isActive: false,
            values: [],
          }),
        }));
      }
    },
    [api],
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
              parameterSettings={valuesResources}
              onRefresh={onRefresh}
              onSaveValues={onSaveValues}
              onActivate={onActivate}
            />
          </Tabs.TabPane>
          <Tabs.TabPane tab="Business" key="business">
            <ParametersTable
              parameters={BUSINESS_RISK_PARAMETERS}
              parameterSettings={valuesResources}
              onRefresh={onRefresh}
              onSaveValues={onSaveValues}
              onActivate={onActivate}
            />
          </Tabs.TabPane>
          <Tabs.TabPane tab="Transaction" key="transaction">
            <ParametersTable
              parameters={TRANSACTION_RISK_PARAMETERS}
              parameterSettings={valuesResources}
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
