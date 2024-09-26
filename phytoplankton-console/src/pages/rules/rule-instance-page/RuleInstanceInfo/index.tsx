import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router';
import { useLocalStorageState } from 'ahooks';
import { useMutation } from '@tanstack/react-query';
import { humanizeAuto, humanizeConstant } from '@flagright/lib/utils/humanize';
import { getRuleInstanceDisplayId, isShadowRule, useUpdateRuleInstance } from '../../utils';
import { canSimulate } from '../../my-rules';
import { RuleStatusSwitch } from '../../components/RuleStatusSwitch';
import s from './styles.module.less';
import { RuleInstanceAnalytics } from './RuleInstanceAnalytics';
import { RuleInstance } from '@/apis';
import * as Card from '@/components/ui/Card';
import PriorityTag from '@/components/library/PriorityTag';
import Button from '@/components/library/Button';
import EditIcon from '@/components/ui/icons/Remix/design/edit-line.react.svg';
import DeleteIcon from '@/components/ui/icons/Remix/system/delete-bin-7-line.react.svg';
import DuplicateIcon from '@/components/ui/icons/Remix/document/file-copy-line.react.svg';
import SimulationIcon from '@/components/ui/icons/Remix/media/rhythm-fill.react.svg';
import * as Form from '@/components/ui/Form';
import RuleHitInsightsTag from '@/components/library/Tag/RuleHitInsightsTag';
import { dayjs, DEFAULT_DATE_TIME_FORMAT } from '@/utils/dayjs';
import RuleQueueTag from '@/components/library/Tag/RuleQueueTag';
import { makeUrl } from '@/utils/routing';
import { useHasPermissions } from '@/utils/user-utils';
import Confirm from '@/components/utils/Confirm';
import { useApi } from '@/api';
import { message } from '@/components/library/Message';
import { getErrorMessage } from '@/utils/lang';
import { getMutationAsyncResource } from '@/utils/queries/mutations/helpers';
import AccountTag from '@/components/AccountTag';
import DirectionLine from '@/components/ui/icons/Remix/map/direction-line.react.svg';
import Tooltip from '@/components/library/Tooltip';

interface Props {
  ruleInstance: RuleInstance;
}

export const RuleInstanceInfo = (props: Props) => {
  const { ruleInstance: _ruleInstance } = props;
  const [ruleInstance, setRuleInstance] = useState(_ruleInstance);
  const handleRuleInstanceUpdate = useCallback(async (ruleInstance: RuleInstance) => {
    const ruleInstanceId = ruleInstance.id;
    if (!ruleInstanceId) {
      message.fatal('Rule instance ID is not set');
      return;
    }
    setRuleInstance((prev) => ({ ...prev, [ruleInstanceId]: ruleInstance }));
  }, []);
  const percent =
    ruleInstance.hitCount && ruleInstance.runCount
      ? (ruleInstance.hitCount / ruleInstance.runCount) * 100
      : 0;
  const navigate = useNavigate();
  const canWriteRules = useHasPermissions(['rules:my-rules:write']);
  const api = useApi();
  const [isSimulationModeEnabled, setIsSimulationModeEnabled] = useLocalStorageState(
    'SIMULATION_RULES',
    false,
  );

  const onEditRule = useCallback(
    (entity) => {
      if (isSimulationModeEnabled) {
        setIsSimulationModeEnabled(false);
      }
      navigate(
        makeUrl('/rules/my-rules/:id/:mode', {
          id: entity.id,
          mode: 'edit',
        }),
      );
    },
    [navigate, isSimulationModeEnabled, setIsSimulationModeEnabled],
  );

  const onDuplicateRule = useCallback(
    (entity) => {
      if (isSimulationModeEnabled) {
        setIsSimulationModeEnabled(false);
      }
      navigate(
        makeUrl('/rules/my-rules/:id/:mode', {
          id: entity.id,
          mode: 'duplicate',
        }),
      );
    },
    [navigate, isSimulationModeEnabled, setIsSimulationModeEnabled],
  );

  const onSimulateRule = useCallback(
    (entity) => {
      if (!isSimulationModeEnabled) {
        setIsSimulationModeEnabled(true);
      }
      navigate(
        makeUrl('/rules/my-rules/:id/:mode', {
          id: entity.id,
          mode: 'edit',
        }),
      );
    },
    [navigate, isSimulationModeEnabled, setIsSimulationModeEnabled],
  );
  const handleDeleteRuleInstanceMutation = useMutation<void, Error, string>(
    async (ruleInstanceId) => await api.deleteRuleInstancesRuleInstanceId({ ruleInstanceId }),
    {
      onSuccess: () => {
        message.success('Rule deleted');
        navigate('/rules/my-rules');
      },
      onError: (e) => {
        message.fatal(`Failed to delete rule: ${getErrorMessage(e)}`, e);
      },
    },
  );

  const updateRuleInstanceMutation = useUpdateRuleInstance(handleRuleInstanceUpdate);

  const formatDate = (timestamp?: number): string => {
    return dayjs(timestamp).format(DEFAULT_DATE_TIME_FORMAT);
  };

  const handleActivationChange = useCallback(
    async (ruleInstance: RuleInstance, activated: boolean) => {
      updateRuleInstanceMutation.mutate({
        ...ruleInstance,
        status: activated ? 'ACTIVE' : 'INACTIVE',
      });
    },
    [updateRuleInstanceMutation],
  );

  return (
    <div className={s.root} data-cy="rule-instance-info-root">
      <Card.Root noBorder>
        <Card.Section className={s.card}>
          <div className={s.leftContent}>
            <div className={s.header}>
              <PriorityTag priority={ruleInstance.casePriority} />
              <span>{ruleInstance.id}</span>
              <span>{ruleInstance.ruleNameAlias}</span>
            </div>
            <div className={s.description}>{ruleInstance.ruleDescriptionAlias}</div>
          </div>
          <RuleStatusSwitch
            entity={ruleInstance}
            type="RULE"
            onToggle={(checked) => handleActivationChange(ruleInstance, checked)}
          />
        </Card.Section>
      </Card.Root>
      <Card.Root noBorder>
        <Card.Section className={s.card}>
          <div className={s.info}>
            <Form.Layout.Label title={'Rule type'}>
              {humanizeAuto(ruleInstance.type)}
            </Form.Layout.Label>
            <Form.Layout.Label title={'Hit rate'}>
              <Tooltip
                title={<>{`Hit: ${ruleInstance.hitCount} / Run: ${ruleInstance.runCount}`}</>}
              >
                {(percent ?? 0.0)?.toFixed(2)}%
              </Tooltip>
              <RuleHitInsightsTag percentage={percent} runs={ruleInstance.runCount} />
            </Form.Layout.Label>
            <Form.Layout.Label title={'Rule nature'}>{ruleInstance.nature}</Form.Layout.Label>
            <Form.Layout.Label title={'Alert created for'}>
              {(ruleInstance.alertConfig?.alertCreatedFor ?? ['-'])
                .map((val) => humanizeConstant(val))
                .join(', ')}
            </Form.Layout.Label>
            <Form.Layout.Label title={'Created by'}>
              {ruleInstance.createdBy ? (
                <AccountTag key={ruleInstance.createdBy} accountId={ruleInstance.createdBy} />
              ) : (
                '-'
              )}
            </Form.Layout.Label>
            <Form.Layout.Label title={'Created on'}>
              {formatDate(ruleInstance.createdAt)}
            </Form.Layout.Label>
            <Form.Layout.Label title={'Last updated'}>
              {formatDate(ruleInstance.updatedAt)}
            </Form.Layout.Label>
            <Form.Layout.Label title={'Queue'}>
              <RuleQueueTag queueId={ruleInstance.queueId} />
            </Form.Layout.Label>
            <Form.Layout.Label title={'Execution start date'}>
              {formatDate(ruleInstance.createdAt)}
            </Form.Layout.Label>
          </div>
          <div className={s.separator}></div>
          <div className={s.actionButtons}>
            {isShadowRule(ruleInstance) && (
              <Confirm
                title="Change to live rule"
                text="Are you sure you want to change this rule to a live rule?"
                onConfirm={() => {
                  if (canWriteRules && ruleInstance.id) {
                    updateRuleInstanceMutation.mutate({
                      ...ruleInstance,
                      ruleRunMode: 'LIVE',
                    });
                  }
                }}
              >
                {({ onClick }) => (
                  <Button
                    type="PRIMARY"
                    onClick={onClick}
                    isDisabled={!canWriteRules}
                    testName="rule-instance-convert-to-live-button"
                  >
                    Change to live rule
                  </Button>
                )}
              </Confirm>
            )}
            <Button
              type="SECONDARY"
              icon={<EditIcon />}
              onClick={() => onEditRule(ruleInstance)}
              isDisabled={!canWriteRules}
              testName="rule-instance-page-edit-rule-button"
            >
              Edit rule
            </Button>
            <Button
              type="TETRIARY"
              icon={<SimulationIcon />}
              onClick={() => onSimulateRule(ruleInstance)}
              isDisabled={!canSimulate(ruleInstance)}
              testName="rule-instance-page-simulate-rule-button"
            >
              Simulate rule
            </Button>
            <Button
              type="TETRIARY"
              icon={<DuplicateIcon />}
              onClick={() => onDuplicateRule(ruleInstance)}
              isDisabled={!canWriteRules}
            >
              Duplicate rule
            </Button>
            {ruleInstance.ruleRunMode === 'LIVE' && (
              <Confirm
                title="Change to shadow rule"
                text="Are you sure you want to change this rule to a shadow rule?"
                onConfirm={() => {
                  if (canWriteRules && ruleInstance.id) {
                    updateRuleInstanceMutation.mutate({
                      ...ruleInstance,
                      ruleRunMode: 'SHADOW',
                    });
                  }
                }}
              >
                {({ onClick }) => (
                  <Button
                    type="TETRIARY"
                    onClick={onClick}
                    isDisabled={!canWriteRules}
                    testName="rule-instance-convert-to-shadow-button"
                    icon={<DirectionLine />}
                  >
                    Change to shadow rule
                  </Button>
                )}
              </Confirm>
            )}
            <Confirm
              title={`Are you sure you want to delete this ${getRuleInstanceDisplayId(
                ruleInstance.ruleId,
                ruleInstance.id,
              )} rule?`}
              text="Please confirm that you want to delete this rule. This action cannot be undone."
              onConfirm={() => {
                if (canWriteRules && ruleInstance.id) {
                  handleDeleteRuleInstanceMutation.mutate(ruleInstance.id);
                }
              }}
              res={getMutationAsyncResource(handleDeleteRuleInstanceMutation)}
            >
              {({ onClick }) => (
                <Button
                  icon={<DeleteIcon />}
                  type="TETRIARY"
                  isDanger
                  onClick={onClick}
                  isDisabled={!canWriteRules}
                  testName="rule-instance-page-delete-rule-button"
                >
                  Delete rule
                </Button>
              )}
            </Confirm>
          </div>
        </Card.Section>
      </Card.Root>

      {/* TODO: Support USER_ONGOING_SCREENING type */}
      {ruleInstance.type !== 'USER_ONGOING_SCREENING' && (
        <RuleInstanceAnalytics ruleInstance={ruleInstance} />
      )}
    </div>
  );
};
