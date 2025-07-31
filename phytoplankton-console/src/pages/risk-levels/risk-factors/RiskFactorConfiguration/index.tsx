import { useMemo, useRef, useState } from 'react';
import { EditOutlined } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router';
import { DEFAULT_RISK_LEVEL } from '@flagright/lib/utils';
import { useAtomValue } from 'jotai';
import s from './style.module.less';
import RiskFactorConfigurationForm, { STEPS } from './RiskFactorConfigurationForm';
import { deserializeRiskItem, RiskFactorConfigurationFormValues } from './utils';
import { riskFactorsEditEnabled } from '@/store/risk-factors';
import Button from '@/components/library/Button';
import { FormRef } from '@/components/library/Form';
import { useHasResources } from '@/utils/user-utils';
import ArrowLeftSLineIcon from '@/components/ui/icons/Remix/system/arrow-left-s-line.react.svg';
import ArrowRightSLineIcon from '@/components/ui/icons/Remix/system/arrow-right-s-line.react.svg';
import {
  RiskEntityType,
  RiskFactor,
  RiskFactorParameter,
  RiskParameterLevelKeyValue,
  RiskScoreValueLevel,
  RiskScoreValueScore,
  RiskLevel,
} from '@/apis';
import { makeUrl } from '@/utils/routing';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { NEW_RISK_FACTOR_ID } from '@/utils/queries/keys';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import {
  DEFAULT_RISK_VALUE,
  ALL_RISK_PARAMETERS,
} from '@/pages/risk-levels/risk-factors/RiskFactorConfiguration/RiskFactorConfigurationForm/RiskFactorConfigurationStep/ParametersTable/const';
import { message } from '@/components/library/Message';
import { getErrorMessage } from '@/utils/lang';
import { useBulkRerunUsersStatus } from '@/utils/batch-rerun-users';
import Tooltip from '@/components/library/Tooltip';

interface Props {
  riskItemType: 'consumer' | 'business' | 'transaction';
  mode: 'CREATE' | 'EDIT' | 'READ' | 'DUPLICATE';
  id?: string;
  riskItem?: RiskFactor;
  onSubmit: (values: RiskFactorConfigurationFormValues, riskItem?: RiskFactor) => void;
  isLoading?: boolean;
  dataKey?: string;
}

interface LocationState {
  prefill?: RiskFactor;
}

export const RiskFactorConfiguration = (props: Props) => {
  const { riskItemType, mode, id, riskItem, onSubmit, isLoading, dataKey } = props;
  const isEditEnabled = useAtomValue(riskFactorsEditEnabled);
  const navigate = useNavigate();
  const location = useLocation();
  const canWriteRiskFactors = useHasResources(['write:::risk-scoring/risk-factors/*']);
  const [activeStepKey, setActiveStepKey] = useState(STEPS[0]);
  const activeStepIndex = STEPS.findIndex((key) => key === activeStepKey);
  const formRef = useRef<FormRef<any>>(null);

  const isMutable = useMemo(() => ['CREATE', 'EDIT', 'DUPLICATE'].includes(mode), [mode]);

  const locationState = location.state as LocationState;
  const prefillData = locationState?.prefill;
  const formInitialValues = prefillData
    ? deserializeRiskItem(prefillData)
    : riskItem
    ? deserializeRiskItem(riskItem)
    : undefined;

  const navigateToRiskFactors = () => {
    if (dataKey) {
      navigate(makeUrl(`/risk-levels/risk-factors/simulation`), { replace: true });
    } else {
      navigate(makeUrl(`/risk-levels/risk-factors/:type`, { type: riskItemType }), {
        replace: true,
      });
    }
  };
  const api = useApi();
  const queryResult = useQuery<string | undefined>(NEW_RISK_FACTOR_ID(id), async () => {
    const newRiskId = await api.getNewRiskFactorId({ riskId: id });
    return newRiskId.riskFactorId;
  });

  const [parameter, _setParameter] = useState<RiskFactorParameter>(
    (riskItem?.parameter as RiskFactorParameter) || ('' as RiskFactorParameter),
  );
  const [values, setValues] = useState<RiskParameterLevelKeyValue[]>(
    riskItem?.riskLevelAssignmentValues || [],
  );
  const riskScoringRerun = useBulkRerunUsersStatus();
  const [entity] = useState<RiskEntityType>(riskItem?.type || 'TRANSACTION');
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
      await api.postCreateRiskFactor({
        RiskFactorsPostRequest: {
          parameter: parameter as RiskFactorParameter,
          type: riskLevelTableItem.entity,
          status: 'ACTIVE',
          name: riskItem?.name || '',
          description: riskItem?.description || '',
          baseCurrency: riskItem?.baseCurrency,
          riskLevelAssignmentValues: settings.values,
          defaultRiskLevel: (settings.defaultValue.type === 'RISK_LEVEL'
            ? settings.defaultValue.value
            : DEFAULT_RISK_LEVEL) as RiskLevel,
          defaultWeight: settings.weight,
          logicAggregationVariables: [],
          logicEntityVariables: [],
          riskLevelLogic: [],
          isDerived: riskLevelTableItem.isDerived || false,
          riskFactorId: riskItem?.id,
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
            <Tooltip
              title={
                !canWriteRiskFactors
                  ? "You don't have permission to create risk factors."
                  : riskScoringRerun.data.isAnyJobRunning
                  ? 'Bulk rerun risk scoring is currently running. Please wait until it finishes.'
                  : undefined
              }
              placement="top"
            >
              <span>
                <Button
                  htmlType="submit"
                  isLoading={isLoading}
                  isDisabled={!canWriteRiskFactors || riskScoringRerun.data.isAnyJobRunning}
                  onClick={() => {
                    if (!formRef?.current?.validate()) {
                      formRef?.current?.submit(); // To show errors
                      return;
                    }
                    formRef?.current?.submit();
                  }}
                  requiredResources={['write:::risk-scoring/risk-factors/*']}
                  testName="drawer-create-save-button"
                >
                  Create
                </Button>
              </span>
            </Tooltip>
          </>
        )}
        {canWriteRiskFactors && (mode === 'EDIT' || mode === 'DUPLICATE') && (
          <>
            <Tooltip
              title={
                !canWriteRiskFactors
                  ? "You don't have permission to save risk factors."
                  : riskScoringRerun.data.isAnyJobRunning
                  ? 'Bulk rerun risk scoring is currently running. Please wait until it finishes.'
                  : undefined
              }
              placement="top"
            >
              <span>
                <Button
                  htmlType="submit"
                  isLoading={isLoading}
                  isDisabled={!canWriteRiskFactors || riskScoringRerun.data.isAnyJobRunning}
                  onClick={() => {
                    if (!formRef?.current?.validate()) {
                      formRef?.current?.submit(); // To show errors
                      return;
                    }
                    formRef?.current?.submit();
                  }}
                  requiredResources={['write:::risk-scoring/risk-factors/*']}
                  testName="drawer-create-save-button"
                >
                  Save
                </Button>
              </span>
            </Tooltip>
          </>
        )}
        {canWriteRiskFactors && mode === 'READ' && (
          <Tooltip
            title={
              riskScoringRerun.data.isAnyJobRunning
                ? 'Bulk rerun risk scoring is currently running. Please wait until it finishes.'
                : !isEditEnabled
                ? 'You need to enable risk factors editing to create a new risk factor.'
                : undefined
            }
            placement="top"
          >
            <Button
              type="SECONDARY"
              isDisabled={!isEditEnabled || riskScoringRerun.data.isAnyJobRunning}
              onClick={() => {
                if (dataKey) {
                  navigate(
                    makeUrl(`/risk-levels/risk-factors/simulation-mode/:key/:type/:id/edit`, {
                      type: riskItemType,
                      key: dataKey,
                      id,
                    }),
                    { replace: true },
                  );
                } else {
                  navigate(
                    makeUrl(`/risk-levels/risk-factors/:type/:id/edit`, {
                      type: riskItemType,
                      id,
                    }),
                    { replace: true },
                  );
                }
              }}
              icon={<EditOutlined />}
              requiredResources={['write:::risk-scoring/risk-factors/*']}
            >
              Edit
            </Button>
          </Tooltip>
        )}
      </div>
    </>
  );
};
