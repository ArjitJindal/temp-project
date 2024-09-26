import { useMemo, useRef, useState } from 'react';
import { EditOutlined } from '@ant-design/icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { getSelectedRiskLevel, getSelectedRiskScore } from '../utils';
import s from './style.module.less';
import RiskFactorConfigurationForm, {
  RiskFactorConfigurationFormValues,
  STEPS,
} from './RiskFactorConfigurationForm';
import Button from '@/components/library/Button';
import { FormRef } from '@/components/library/Form';
import { useHasPermissions } from '@/utils/user-utils';
import ArrowLeftSLineIcon from '@/components/ui/icons/Remix/system/arrow-left-s-line.react.svg';
import ArrowRightSLineIcon from '@/components/ui/icons/Remix/system/arrow-right-s-line.react.svg';
import { useApi } from '@/api';
import { RiskClassificationScore, RiskFactor, RiskFactorsPostRequest } from '@/apis';
import { message } from '@/components/library/Message';
import { RISK_FACTORS_V8 } from '@/utils/queries/keys';
import { makeUrl } from '@/utils/routing';
import { useRiskClassificationScores } from '@/utils/risk-levels';
import { getOr } from '@/utils/asyncResource';

interface Props {
  riskItemType: 'consumer' | 'business' | 'transaction';
  mode: 'CREATE' | 'EDIT' | 'READ';
  id?: string;
  riskItem?: RiskFactor;
}

export const RiskFactorConfiguration = (props: Props) => {
  const { riskItemType, mode, id, riskItem } = props;
  const riskClassificationQuery = useRiskClassificationScores();
  const riskClassificationValues = getOr(riskClassificationQuery, []);
  const navigate = useNavigate();
  const canWriteRiskFactors = useHasPermissions(['risk-scoring:risk-factors:write']);
  const [activeStepKey, setActiveStepKey] = useState(STEPS[0]);
  const activeStepIndex = STEPS.findIndex((key) => key === activeStepKey);
  const formRef = useRef<FormRef<any>>(null);
  const isMutable = useMemo(() => ['CREATE', 'EDIT'].includes(mode), [mode]);
  const api = useApi();
  const queryClient = useQueryClient();
  const formInitialValues = riskItem ? deserializeRiskItem(riskItem) : undefined;
  const updateRiskFactorMutation = useMutation(
    async (riskFactorFormValues: RiskFactorConfigurationFormValues) => {
      if (!riskItem || !id) {
        throw new Error('Risk item is missing');
      }
      return api.putRiskFactors({
        riskFactorId: id,
        RiskFactorsUpdateRequest: {
          ...serializeRiskItem(riskFactorFormValues, riskItemType, riskClassificationValues),
          status: riskItem.status,
        },
      });
    },
    {
      onSuccess: async (newRiskFactor) => {
        navigateToRiskFactors();
        await queryClient.invalidateQueries(RISK_FACTORS_V8(riskItemType));
        message.success(`Risk factor updated - ${newRiskFactor.id}`);
      },
      onError: async (err) => {
        message.fatal(`Unable to update the risk factor - Some parameters are missing`, err);
      },
    },
  );
  const createRiskFactorMutation = useMutation(
    async (riskFactorFormValues: RiskFactorConfigurationFormValues) => {
      return api.postCreateRiskFactor({
        RiskFactorsPostRequest: serializeRiskItem(
          riskFactorFormValues,
          riskItemType,
          riskClassificationValues,
        ),
      });
    },
    {
      onSuccess: async (newRiskFactor) => {
        navigateToRiskFactors();
        await queryClient.invalidateQueries(RISK_FACTORS_V8(riskItemType));
        message.success(`Risk factor created - ${newRiskFactor.id}`);
      },
      onError: async (err) => {
        message.fatal(`Unable to create the risk factor - Some parameters are missing`, err);
      },
    },
  );
  const handleSubmit = (formValues: RiskFactorConfigurationFormValues) => {
    if (mode === 'EDIT' && riskItem) {
      updateRiskFactorMutation.mutate(formValues);
    } else if (mode === 'CREATE') {
      createRiskFactorMutation.mutate(formValues);
    }
  };
  const navigateToRiskFactors = () => {
    navigate(makeUrl(`/risk-levels/risk-factors/:type`, { type: riskItemType }));
  };
  return (
    <>
      <RiskFactorConfigurationForm
        ref={formRef}
        activeStepKey={activeStepKey}
        readonly={!canWriteRiskFactors || mode === 'READ'}
        onActiveStepChange={setActiveStepKey}
        onSubmit={handleSubmit}
        id={id}
        type={riskItemType}
        formInitialValues={formInitialValues}
      />
      <div className={s.footerButtons}>
        {(!canWriteRiskFactors || mode === 'EDIT') && (
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
        {(mode === 'EDIT' || activeStepIndex !== STEPS.length - 1) && (
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
              isLoading={createRiskFactorMutation.isLoading}
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
        {canWriteRiskFactors && mode === 'EDIT' && (
          <Button
            htmlType="submit"
            isLoading={updateRiskFactorMutation.isLoading}
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
              navigate(
                makeUrl(`/risk-levels/risk-factors/:type/:id/edit`, {
                  type: riskItemType,
                  id,
                }),
              );
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

function deserializeRiskItem(riskItem: RiskFactor): RiskFactorConfigurationFormValues {
  return {
    basicDetailsStep: {
      name: riskItem.name,
      description: riskItem.description,
      defaultWeight: riskItem.defaultWeight,
      defaultRiskValue: riskItem.defaultRiskScore ?? 'HIGH',
    },
    riskFactorConfigurationStep: {
      baseCurrency: riskItem.baseCurrency,
      aggregationVariables: riskItem.logicAggregationVariables,
      riskLevelLogic: riskItem.riskLevelLogic,
      entityVariables: riskItem.logicEntityVariables,
    },
  };
}

function serializeRiskItem(
  riskFactorFormValues: RiskFactorConfigurationFormValues,
  type: 'consumer' | 'business' | 'transaction',
  riskClassificationValues: RiskClassificationScore[],
): RiskFactorsPostRequest {
  return {
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
    riskLevelLogic: riskFactorFormValues.riskFactorConfigurationStep.riskLevelLogic ?? {},
    logicAggregationVariables:
      riskFactorFormValues.riskFactorConfigurationStep.aggregationVariables ?? [],
    logicEntityVariables: riskFactorFormValues.riskFactorConfigurationStep.entityVariables ?? [],
    type: type === 'consumer' ? 'CONSUMER_USER' : type === 'business' ? 'BUSINESS' : 'TRANSACTION',
  };
}
