import { useNavigate, useParams } from 'react-router';
import { useEffect, useMemo, useState } from 'react';
import { useAtom } from 'jotai';
import { Feature, useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import { notEmpty } from '@/utils/array';
import { makeUrl } from '@/utils/routing';
import { useRiskFactor, useRiskFactorPendingProposal } from '@/hooks/api/risk-factors';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { useRiskClassificationScores } from '@/utils/risk-levels';
import { RiskClassificationScore, RiskFactor, RiskFactorParameter } from '@/apis';
import { BreadCrumbsWrapper } from '@/components/BreadCrumbsWrapper';
import { useSafeLocalStorageState } from '@/utils/hooks';
import {
  AsyncResource,
  getOr,
  isFailed,
  isLoading,
  isSuccess,
  map,
  success,
} from '@/utils/asyncResource';
import ConfirmModal from '@/components/utils/Confirm/ConfirmModal';
import { useCreateMutation } from '@/pages/risk-levels/risk-factors/RiskItem/helpers';
import {
  riskFactorsAtom,
  riskFactorsEditEnabled,
  SimulationLocalStorageKey,
} from '@/store/risk-factors';
import {
  RiskFactorsTypeMap,
  scopeToRiskEntityType,
} from '@/pages/risk-levels/risk-factors/RiskFactorsTable/utils';
import { RiskFactorConfiguration } from '@/pages/risk-levels/risk-factors/RiskFactorConfiguration';
import {
  RiskFactorConfigurationFormValues,
  serializeRiskItem,
} from '@/pages/risk-levels/risk-factors/RiskFactorConfiguration/utils';

export default function () {
  const isSimulationMode = window.localStorage.getItem('SIMULATION_CUSTOM_RISK_FACTORS') === 'true';
  const params = useParams();
  const type = params.type || 'consumer';
  const mode = window.location.pathname.endsWith('/create')
    ? 'create'
    : window.location.pathname.endsWith('/edit')
    ? 'edit'
    : window.location.pathname.endsWith('/duplicate')
    ? 'duplicate'
    : 'read';

  const id = params.id;
  const key = params.key;

  return (
    <Feature name="RISK_SCORING" fallback={'Not enabled'}>
      <BreadCrumbsWrapper
        simulationStorageKey={'SIMULATION_CUSTOM_RISK_FACTORS'}
        nonSimulationDefaultUrl="/risk-levels/risk-factors/"
        simulationDefaultUrl="/risk-levels/risk-factors/simulation"
        simulationHistoryUrl="/risk-levels/risk-factors/simulation-history"
        breadcrumbs={[
          {
            title: 'Risk Factors',
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
          mode === 'create' && {
            title: 'Create',
            to: isSimulationMode
              ? makeUrl(`/risk-levels/risk-factors/:key/:type/:mode`, {
                  key: 'simulation-mode',
                  type,
                  mode,
                })
              : makeUrl(`/risk-levels/risk-factors/:type/:mode`, {
                  type,
                  mode,
                }),
          },
          id && {
            title: id,
          },
          (mode === 'read' || mode === 'edit' || mode === 'duplicate') &&
            id && {
              title: mode === 'read' ? 'View' : mode === 'edit' ? 'Edit' : 'duplicate',
              to: isSimulationMode
                ? makeUrl(`/risk-levels/risk-factors/:type/:id/:mode`, {
                    type: 'simulation-mode',
                    id,
                    mode,
                  })
                : makeUrl(`/risk-levels/risk-factors/:type/:id/:mode`, {
                    type,
                    id,
                    mode,
                  }),
            },
        ].filter(notEmpty)}
      >
        <RiskItem
          type={type as 'consumer' | 'business' | 'transaction'}
          mode={mode}
          id={id}
          dataKey={key}
          isSimulationMode={isSimulationMode}
        />
      </BreadCrumbsWrapper>
    </Feature>
  );
}

interface Props {
  type: 'consumer' | 'business' | 'transaction';
  mode: string;
  id?: string;
  isSimulationMode?: boolean;
  dataKey?: string;
}

const RiskItem = (props: Props) => {
  const { type, mode, id, isSimulationMode, dataKey } = props;
  const navigate = useNavigate();

  useEffect(() => {
    if (isSimulationMode) {
      const handleBackButton = (event) => {
        event.preventDefault();
        navigate('/risk-levels/risk-factors/simulation', { replace: true });
      };

      window.history.pushState(null, '', window.location.pathname);
      window.addEventListener('popstate', handleBackButton);

      return () => {
        window.removeEventListener('popstate', handleBackButton);
      };
    }
  }, [isSimulationMode, navigate]);

  const navigateToRiskFactors = () => {
    if (isSimulationMode) {
      navigate('/risk-levels/risk-factors/simulation', { replace: true });
    } else {
      navigate(makeUrl(`/risk-levels/risk-factors/${type}`), { replace: true });
    }
  };
  const riskClassificationValues = useRiskClassificationScores();
  if (isSimulationMode) {
    return (
      <SimulationRiskItemForm
        dataKey={dataKey}
        type={type}
        id={id}
        riskClassificationValues={riskClassificationValues}
        navigateToRiskFactors={navigateToRiskFactors}
        mode={mode}
      />
    );
  }
  return (
    <RiskItemForm
      type={type}
      id={id}
      riskClassificationValues={riskClassificationValues}
      mode={mode}
    />
  );
};

interface SimulationRiskItemFormProps {
  type: 'consumer' | 'business' | 'transaction';
  id?: string;
  riskClassificationValues: RiskClassificationScore[];
  navigateToRiskFactors: () => void;
  mode: string;
  dataKey?: string;
}

function SimulationRiskItemForm(props: SimulationRiskItemFormProps) {
  const { type, mode, id, riskClassificationValues, navigateToRiskFactors, dataKey } = props;
  const [riskFactorsMap, setRiskFactorsMap] = useSafeLocalStorageState<RiskFactorsTypeMap>(
    `${SimulationLocalStorageKey}-${dataKey}`,
    {
      CONSUMER_USER: [],
      BUSINESS: [],
      TRANSACTION: [],
    },
  );
  const riskFactor = id
    ? riskFactorsMap[scopeToRiskEntityType(type)]?.find((riskFactor) => riskFactor.id === id)
    : undefined;

  // Don't wait for data if we're creating a new risk factor
  if (mode === 'create') {
    return (
      <RiskFactorConfiguration
        riskItemType={type}
        onSubmit={(formValues) => {
          const riskFactorCount = Object.values(riskFactorsMap ?? {}).flatMap(
            (riskFactors) => riskFactors,
          ).length;
          setRiskFactorsMap((prev) => {
            const newRiskFactorsMap: RiskFactorsTypeMap = {
              CONSUMER_USER: [...(prev?.CONSUMER_USER ?? [])],
              BUSINESS: [...(prev?.BUSINESS ?? [])],
              TRANSACTION: [...(prev?.TRANSACTION ?? [])],
            };
            newRiskFactorsMap[scopeToRiskEntityType(type)].push({
              ...serializeRiskItem(formValues, type, riskClassificationValues),
              id: `RF-${riskFactorCount.toString().padStart(3, '0')}`,
              status: 'ACTIVE',
            });
            return newRiskFactorsMap;
          });
          navigateToRiskFactors();
        }}
        mode={'CREATE'}
        dataKey={dataKey}
        isLoading={false}
      />
    );
  }

  return (
    <RiskFactorConfiguration
      riskItemType={type}
      onSubmit={(formValues, riskItem) => {
        if (mode === 'create') {
          const riskFactorCount = Object.values(riskFactorsMap ?? {}).flatMap(
            (riskFactors) => riskFactors,
          ).length;
          setRiskFactorsMap((prev) => {
            const newRiskFactorsMap: RiskFactorsTypeMap = {
              CONSUMER_USER: [...(prev?.CONSUMER_USER ?? [])],
              BUSINESS: [...(prev?.BUSINESS ?? [])],
              TRANSACTION: [...(prev?.TRANSACTION ?? [])],
            };
            newRiskFactorsMap[scopeToRiskEntityType(type)].push({
              ...serializeRiskItem(formValues, type, riskClassificationValues),
              id: `RF-${riskFactorCount.toString().padStart(3, '0')}`,
              status: 'ACTIVE',
            });
            return newRiskFactorsMap;
          });
          navigateToRiskFactors();
        } else if (mode === 'edit' && riskItem) {
          setRiskFactorsMap((prev) => {
            const newRiskFactorsMap: RiskFactorsTypeMap = {
              CONSUMER_USER: [...(prev?.CONSUMER_USER ?? [])],
              BUSINESS: [...(prev?.BUSINESS ?? [])],
              TRANSACTION: [...(prev?.TRANSACTION ?? [])],
            };
            newRiskFactorsMap[scopeToRiskEntityType(type)] = newRiskFactorsMap[
              scopeToRiskEntityType(type)
            ].map((riskFactor) => {
              if (riskFactor.id === id) {
                return {
                  ...riskFactor,
                  ...serializeRiskItem(formValues, type, riskClassificationValues),
                  status: riskItem.status,
                };
              }
              return riskFactor;
            });
            return newRiskFactorsMap;
          });
          navigateToRiskFactors();
        }
      }}
      mode={mode.toUpperCase() as 'CREATE' | 'EDIT' | 'READ' | 'DUPLICATE'}
      id={id}
      dataKey={dataKey}
      riskItem={riskFactor}
      isLoading={false}
    />
  );
}

interface RiskItemFormProps {
  type: 'consumer' | 'business' | 'transaction';
  id?: string;
  riskClassificationValues: RiskClassificationScore[];
  mode: string;
}

function RiskItemForm(props: RiskItemFormProps) {
  const { type, id, mode } = props;
  // api not needed here after hooks refactor
  const isApprovalWorkflowsEnabled = useFeatureEnabled('APPROVAL_WORKFLOWS');

  const itemQueryResult = useRiskFactor(type, id);
  const [isRiskFactorsEditEnabled, setRiskFactorsEditEnabled] = useAtom(riskFactorsEditEnabled);
  const [riskFactors, setRiskFactors] = useAtom(riskFactorsAtom);
  const itemRes = useMemo((): AsyncResource<RiskFactor | null> => {
    if (id) {
      const byId = riskFactors.getById(id);
      if (byId != null) {
        return success(byId || null);
      }
    }
    return itemQueryResult.data;
  }, [id, itemQueryResult.data, riskFactors]);

  const navigateToRiskFactor = () => {
    navigate(
      makeUrl(`/risk-levels/risk-factors/:type`, {
        type,
      }),
    );
  };

  const pendingProposalsQueryResult = useRiskFactorPendingProposal(id ?? '', {
    enabled: isApprovalWorkflowsEnabled,
  });

  const itemOrProposalRes: AsyncResource<RiskFactor | null> = useMemo(() => {
    if (id == null) {
      return success(null);
    }
    if (isLoading(itemRes)) {
      return itemRes;
    }
    if (!isApprovalWorkflowsEnabled) {
      return itemRes;
    }
    if (isFailed(pendingProposalsQueryResult.data)) {
      return itemRes;
    }
    if (isFailed(itemRes)) {
      return map(pendingProposalsQueryResult.data, (proposal) => {
        if (proposal == null) {
          throw new Error(`Unable to find a risk factor or related proposal by id`);
        }
        return proposal.riskFactor;
      });
    }
    return itemRes;
  }, [id, isApprovalWorkflowsEnabled, itemRes, pendingProposalsQueryResult.data]);

  // A hack to redirect v2-version risk factor to table view, required for redirect from notification link
  const navigate = useNavigate();
  {
    const item = getOr(itemQueryResult.data, null);
    const isV2RiskFactor = item && item?.parameter != null;
    let hasPendingApproval = false;
    if (isApprovalWorkflowsEnabled) {
      if (isLoading(pendingProposalsQueryResult.data)) {
        hasPendingApproval = true;
      }
      if (isSuccess(pendingProposalsQueryResult.data)) {
        hasPendingApproval = pendingProposalsQueryResult.data != null;
      }
    }

    useEffect(() => {
      if (isV2RiskFactor && !hasPendingApproval) {
        navigate(
          makeUrl(`/risk-levels/risk-factors/:type`, {
            type,
          }) + `#${id}`,
          {
            replace: true,
          },
        );
      }
    }, [id, isV2RiskFactor, hasPendingApproval, navigate, type]);
  }

  const createRiskFactorMutation = useCreateMutation(type, id ?? null);

  const [showConfirmationModal, setShowConfirmationModal] = useState<{
    formValues: RiskFactorConfigurationFormValues;
    riskItem?: RiskFactor;
  } | null>(null);

  const handleConfirm = (params: {
    comment?: string;
    formValues: RiskFactorConfigurationFormValues;
    riskItem?: RiskFactor;
  }) => {
    let formValues: RiskFactorConfigurationFormValues;
    let riskItem: RiskFactor | undefined;
    if (isApprovalWorkflowsEnabled && mode === 'create') {
      if (showConfirmationModal == null) {
        return;
      }
      formValues = showConfirmationModal.formValues;
      riskItem = showConfirmationModal.riskItem;
    } else {
      formValues = params.formValues;
      riskItem = params.riskItem;
    }
    const comment = params.comment;

    if (mode === 'edit') {
      if (id == null) {
        throw new Error(`ID must be defined for editing`);
      }
      const serialized = serializeRiskItem(formValues, type, props.riskClassificationValues);
      setRiskFactors({
        id,
        ...serialized,
      });
      if (!isRiskFactorsEditEnabled) {
        setRiskFactorsEditEnabled(true);
      }
      navigateToRiskFactor();
    } else if (mode === 'create' || mode === 'duplicate') {
      if (mode === 'duplicate' && riskItem) {
        if (riskItem.parameter) {
          if (!formValues.v2Props) {
            formValues.v2Props = {
              parameter: riskItem.parameter as RiskFactorParameter,
              item: {
                ...riskItem,
                name: formValues.basicDetailsStep.name || '',
                description: formValues.basicDetailsStep.description || '',
              },
            };
          }
        }
      }

      if (mode !== 'duplicate' && formValues.riskFactorConfigurationStep) {
        delete (formValues.riskFactorConfigurationStep as any).riskFactorId;
      }
      createRiskFactorMutation.mutate({
        riskFactorFormValues: formValues,
        comment,
      });
    }
  };

  const handleSubmit = (formValues: RiskFactorConfigurationFormValues, riskItem?: RiskFactor) => {
    if (isApprovalWorkflowsEnabled && mode === 'create') {
      setShowConfirmationModal({ formValues, riskItem });
    } else {
      handleConfirm({ formValues, riskItem });
    }
  };

  const confirmationModal = (
    <ConfirmModal
      title={mode === 'create' ? 'Create risk factor' : 'Update risk factor'}
      text={'Please, provide a comment for you update'}
      isVisible={showConfirmationModal != null}
      commentRequired={true}
      onConfirm={(confirmFormValues) => {
        if (showConfirmationModal) {
          handleConfirm({ ...showConfirmationModal, ...confirmFormValues });
        }
      }}
      onCancel={() => {
        setShowConfirmationModal(null);
      }}
    />
  );

  if (mode === 'create') {
    return (
      <>
        <RiskFactorConfiguration
          riskItemType={type}
          onSubmit={handleSubmit}
          mode={'CREATE'}
          isLoading={isLoading(createRiskFactorMutation.dataResource)}
        />
        {confirmationModal}
      </>
    );
  }

  return (
    <>
      <AsyncResourceRenderer resource={itemOrProposalRes}>
        {(data) => {
          return (
            <RiskFactorConfiguration
              riskItemType={type}
              onSubmit={handleSubmit}
              mode={mode.toUpperCase() as 'CREATE' | 'EDIT' | 'READ' | 'DUPLICATE'}
              id={id}
              riskItem={data || undefined}
            />
          );
        }}
      </AsyncResourceRenderer>
      {confirmationModal}
    </>
  );
}
