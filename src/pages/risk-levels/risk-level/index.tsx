import React, { useCallback, useState } from 'react';
import { message } from 'antd';
import ParametersTable from './ParametersTable';
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

export default function () {
  const i18n = useI18n();
  const api = useApi();
  const [valuesResources, setValuesResources] = useState<{
    [key in ParameterName]?: AsyncResource<ParameterSettings>;
  }>({});

  const onUpdateParameter = useCallback(
    async (parameter: ParameterName, settings: ParameterSettings) => {
      const lastValue = getOr<ParameterSettings | null>(valuesResources[parameter] ?? init(), null);

      setValuesResources((values) => ({
        ...values,
        [parameter]: loading(settings),
      }));
      const hideSavingMessage = message.loading('Saving...', 0);

      try {
        const response = await api.postPulseRiskParameter({
          PostPulseRiskParameters: {
            parameterAttributeRiskValues: {
              isActive: settings.isActive,
              parameter: parameter,
              riskValueType: 'DISCRETE',
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
        message.error(`Unable to fetch parameter values!`);
        setValuesResources((values) => ({ ...values, [parameter]: success<ParameterValues>([]) }));
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
        <ParametersTable
          parameterSettings={valuesResources}
          onRefresh={onRefresh}
          onSaveValues={onSaveValues}
          onActivate={onActivate}
        />
      </PageWrapper>
    </Feature>
  );
}
