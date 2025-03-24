import { useMemo, useRef, useState } from 'react';
import { EditOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router';
import { getSelectedRiskLevel, getSelectedRiskScore } from '../utils';
import { ParameterName, ParameterValues } from '../../risk-factors/ParametersTable/types';
import s from './style.module.less';
import RiskFactorConfigurationForm, {
  RiskFactorConfigurationFormValues,
  STEPS,
} from './RiskFactorConfigurationForm';
import { BasicDetailsFormValues } from './RiskFactorConfigurationForm/BasicDetailsStep';
import Button from '@/components/library/Button';
import { FormRef } from '@/components/library/Form';
import { useHasPermissions } from '@/utils/user-utils';
import ArrowLeftSLineIcon from '@/components/ui/icons/Remix/system/arrow-left-s-line.react.svg';
import ArrowRightSLineIcon from '@/components/ui/icons/Remix/system/arrow-right-s-line.react.svg';
import {
  RiskClassificationScore,
  RiskFactor,
  RiskFactorParameter,
  RiskFactorsPostRequest,
  RiskScoreValueLevel,
  RiskScoreValueScore,
} from '@/apis';
import { makeUrl } from '@/utils/routing';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { NEW_RISK_FACTOR_ID } from '@/utils/queries/keys';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import {
  DEFAULT_RISK_VALUE,
  ALL_RISK_PARAMETERS,
} from '@/pages/risk-levels/risk-factors/ParametersTable/consts';
import { Entity } from '@/pages/risk-levels/risk-factors/ParametersTable/types';
import { message } from '@/components/library/Message';
import { getErrorMessage } from '@/utils/lang';

interface Props {
  riskItemType: 'consumer' | 'business' | 'transaction';
  mode: 'CREATE' | 'EDIT' | 'READ' | 'DUPLICATE';
  id?: string;
  riskItem?: RiskFactor;
  onSubmit: (values: RiskFactorConfigurationFormValues, riskItem?: RiskFactor) => void;
  isLoadingUpdation?: boolean;
  isLoadingCreation?: boolean;
  dataKey?: string;
}

export const RiskFactorConfiguration = (props: Props) => {
  const {
    riskItemType,
    mode,
    id,
    riskItem,
    onSubmit,
    isLoadingUpdation,
    isLoadingCreation,
    dataKey,
  } = props;
  const navigate = useNavigate();
  const canWriteRiskFactors = useHasPermissions(['risk-scoring:risk-factors:write']);
  const [activeStepKey, setActiveStepKey] = useState(STEPS[0]);
  const activeStepIndex = STEPS.findIndex((key) => key === activeStepKey);
  const formRef = useRef<FormRef<any>>(null);

  const isMutable = useMemo(() => ['CREATE', 'EDIT', 'DUPLICATE'].includes(mode), [mode]);
  const formInitialValues = riskItem ? deserializeRiskItem(riskItem) : undefined;
  const navigateToRiskFactors = () => {
    dataKey
      ? navigate(
          makeUrl(`/risk-levels/custom-risk-factors/simulation-mode/:key/:type`, {
            type: riskItemType,
            key: dataKey,
          }),
        )
      : navigate(makeUrl(`/risk-levels/custom-risk-factors/:type`, { type: riskItemType }));
  };
  const api = useApi();
  const queryResult = useQuery<string | undefined>(NEW_RISK_FACTOR_ID(id), async () => {
    const newRiskId = await api.getNewRiskFactorId({ riskId: id });
    return newRiskId.riskFactorId;
  });

  const [parameter] = useState<RiskFactorParameter>(
    (riskItem?.parameter as RiskFactorParameter) || ('' as RiskFactorParameter),
  );
  const [values, setValues] = useState<ParameterValues>(riskItem?.riskLevelAssignmentValues || []);
  const [entity] = useState<Entity>(riskItem?.type || 'TRANSACTION');
  const [defaultRiskValueState, setDefaultRiskValueState] = useState<
    RiskScoreValueLevel | RiskScoreValueScore
  >(
    riskItem?.defaultRiskScore
      ? { type: 'RISK_SCORE', value: riskItem.defaultRiskScore }
      : DEFAULT_RISK_VALUE,
  );
  const [weight, setWeight] = useState<number>(riskItem?.defaultWeight || 1);

  const handleSaveParameters = async () => {
    const riskLevelTableItem = ALL_RISK_PARAMETERS.find(
      (param) => param.parameter === parameter && param.entity === entity,
    );
    if (!riskLevelTableItem) {
      message.fatal('Unable to find matching risk parameter configuration.');
      return;
    }
    const settings = {
      isActive: true,
      values: values,
      defaultValue: defaultRiskValueState,
      weight: weight,
    };
    const hideSavingMessage = message.loading('Saving parameters...');
    try {
      await api.postPulseRiskParameter({
        PostPulseRiskParameters: {
          parameterAttributeRiskValues: {
            isActive: settings.isActive,
            isDerived: riskLevelTableItem.isDerived,
            parameter: parameter as RiskFactorParameter,
            parameterType: riskLevelTableItem.parameterType,
            targetIterableParameter: riskLevelTableItem.targetIterableParameter,
            riskEntityType: riskLevelTableItem.entity,
            riskLevelAssignmentValues: settings.values,
            defaultValue: settings.defaultValue as RiskScoreValueLevel | RiskScoreValueScore,
            weight: settings.weight,
          },
        },
      });
      message.success('Parameters saved successfully.');
    } catch (e) {
      message.fatal(`Unable to save parameter! ${getErrorMessage(e)}`, e);
    } finally {
      hideSavingMessage();
    }
  };

  const liftedParameters = {
    parameter,
    values,
    setValues,
    entity,
    defaultRiskValue: defaultRiskValueState,
    weight,
    setDefaultRiskValue: setDefaultRiskValueState,
    setWeight,
    onSave: handleSaveParameters,
  };

  return (
    <>
      <AsyncResourceRenderer resource={queryResult.data}>
        {(riskFactorId) => (
          <RiskFactorConfigurationForm
            ref={formRef}
            activeStepKey={activeStepKey}
            readonly={!canWriteRiskFactors || mode === 'READ'}
            onActiveStepChange={setActiveStepKey}
            onSubmit={(formValues) => {
              if (formValues.v2Props) {
                handleSaveParameters();
              }
              onSubmit(formValues, riskItem);
            }}
            id={id}
            type={riskItemType}
            formInitialValues={formInitialValues}
            newRiskId={mode === 'EDIT' || mode === 'READ' ? id : riskFactorId}
            liftedParameters={riskItem && riskItem.parameter ? liftedParameters : undefined}
          />
        )}
      </AsyncResourceRenderer>
      <div className={s.footerButtons}>
        {(!canWriteRiskFactors || mode === 'EDIT' || mode === 'DUPLICATE') && (
          <Button type="TETRIARY" onClick={navigateToRiskFactors}>
            Cancel
          </Button>
        )}
        {isMutable && (
          <Button
            type="TETRIARY"
            onClick={() => {
              const nextStep = STEPS[activeStepIndex - 1];
              setActiveStepKey(nextStep);
            }}
            icon={<ArrowLeftSLineIcon />}
            isDisabled={activeStepIndex === 0}
          >
            Previous
          </Button>
        )}
        {(mode === 'EDIT' || mode === 'DUPLICATE' || activeStepIndex !== STEPS.length - 1) && (
          <Button
            type="SECONDARY"
            onClick={() => {
              const nextStep = STEPS[activeStepIndex + 1];
              setActiveStepKey(nextStep);
            }}
            isDisabled={activeStepIndex === STEPS.length - 1}
            iconRight={<ArrowRightSLineIcon />}
            testName="drawer-next-button-v8"
          >
            Next
          </Button>
        )}
        {canWriteRiskFactors && mode === 'CREATE' && activeStepIndex === STEPS.length - 1 && (
          <>
            <Button
              htmlType="submit"
              isLoading={isLoadingCreation}
              isDisabled={!canWriteRiskFactors}
              onClick={() => {
                if (!formRef?.current?.validate()) {
                  formRef?.current?.submit(); // To show errors
                  return;
                }
                formRef?.current?.submit();
              }}
              requiredPermissions={['risk-scoring:risk-factors:write']}
              testName="drawer-create-save-button"
            >
              Create
            </Button>
          </>
        )}
        {canWriteRiskFactors && (mode === 'EDIT' || mode === 'DUPLICATE') && (
          <Button
            htmlType="submit"
            isLoading={isLoadingUpdation}
            isDisabled={!canWriteRiskFactors}
            onClick={() => {
              if (!formRef?.current?.validate()) {
                formRef?.current?.submit(); // To show errors
                return;
              }
              formRef?.current?.submit();
            }}
            requiredPermissions={['risk-scoring:risk-factors:write']}
            testName="drawer-create-save-button"
          >
            Save
          </Button>
        )}
        {canWriteRiskFactors && mode === 'READ' && (
          <Button
            type="SECONDARY"
            onClick={() => {
              if (dataKey) {
                navigate(
                  makeUrl(`/risk-levels/custom-risk-factors/simulation-mode/:key/:type/:id/edit`, {
                    type: riskItemType,
                    key: dataKey,
                    id,
                  }),
                );
              } else {
                navigate(
                  makeUrl(`/risk-levels/custom-risk-factors/:type/:id/edit`, {
                    type: riskItemType,
                    id,
                  }),
                );
              }
            }}
            icon={<EditOutlined />}
            requiredPermissions={['risk-scoring:risk-factors:write']}
          >
            Edit
          </Button>
        )}
      </div>
    </>
  );
};

export function deserializeRiskItem(riskItem: RiskFactor): RiskFactorConfigurationFormValues {
  const basicDetailsStep = {
    name: riskItem.name,
    description: riskItem.description,
    defaultWeight: riskItem.defaultWeight,
    defaultRiskValue: riskItem.defaultRiskScore ?? 'HIGH',
  };
  const riskFactorConfigurationStep = {
    baseCurrency: riskItem.baseCurrency,
    aggregationVariables: riskItem.logicAggregationVariables,
    riskLevelLogic: riskItem.riskLevelLogic,
    entityVariables: riskItem.logicEntityVariables,
  };
  if (riskItem.parameter) {
    return {
      basicDetailsStep: basicDetailsStep as BasicDetailsFormValues,
      riskFactorConfigurationStep: riskFactorConfigurationStep,
      v2Props: {
        parameter: riskItem.parameter as ParameterName,
        item: riskItem,
      },
    };
  }
  return {
    basicDetailsStep: basicDetailsStep as BasicDetailsFormValues,
    riskFactorConfigurationStep,
  };
}

export function serializeRiskItem(
  riskFactorFormValues: RiskFactorConfigurationFormValues,
  type: 'consumer' | 'business' | 'transaction',
  riskClassificationValues: RiskClassificationScore[],
  riskFactorId?: string,
  v2Props?: {
    parameter: ParameterName;
    item: RiskFactor;
  },
): RiskFactorsPostRequest {
  const baseRequest = {
    name: riskFactorFormValues.basicDetailsStep.name ?? '',
    description: riskFactorFormValues.basicDetailsStep.description ?? '',
    status: 'ACTIVE',
    defaultWeight: riskFactorFormValues.basicDetailsStep.defaultWeight ?? 1,
    baseCurrency: riskFactorFormValues.riskFactorConfigurationStep.baseCurrency,
    defaultRiskScore: getSelectedRiskScore(
      riskFactorFormValues.basicDetailsStep.defaultRiskValue,
      riskClassificationValues,
    ),
    defaultRiskLevel: getSelectedRiskLevel(
      riskFactorFormValues.basicDetailsStep.defaultRiskValue,
      riskClassificationValues,
    ),
    riskLevelLogic: riskFactorFormValues.riskFactorConfigurationStep.riskLevelLogic ?? [],
    logicAggregationVariables:
      riskFactorFormValues.riskFactorConfigurationStep.aggregationVariables ?? [],
    logicEntityVariables: riskFactorFormValues.riskFactorConfigurationStep.entityVariables ?? [],
    type: type === 'consumer' ? 'CONSUMER_USER' : type === 'business' ? 'BUSINESS' : 'TRANSACTION',
    riskFactorId,
  } as RiskFactorsPostRequest;
  if (v2Props) {
    return {
      ...baseRequest,
      parameter: v2Props.parameter,
      dataType: v2Props.item.dataType,
      valueType: v2Props.item.valueType,
      riskLevelAssignmentValues: v2Props.item.riskLevelAssignmentValues,
    } as RiskFactorsPostRequest;
  }
  return baseRequest;
}
