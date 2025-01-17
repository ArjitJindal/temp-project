import React from 'react';
import { useHasPermissions } from '@/utils/user-utils';
import { RiskFactor, RuleInstance } from '@/apis';
import Tooltip from '@/components/library/Tooltip';
import { dayjs } from '@/utils/dayjs';
import Toggle from '@/components/library/Toggle';

interface RuleStatusSwitchProps {
  entity: RuleInstance | RiskFactor;
  type?: 'RULE' | 'RISK_FACTOR';
  onToggle?: (enabled: boolean) => void;
  isDisabled?: boolean;
}

export const RuleStatusSwitch: React.FC<RuleStatusSwitchProps> = (props: RuleStatusSwitchProps) => {
  const canWriteRules = useHasPermissions(['rules:my-rules:write']);
  const { entity, type = 'RULE', onToggle, isDisabled = false } = props;
  const isDeploying = entity.status === 'DEPLOYING';
  const tooltipText = isDeploying
    ? `The ${type === 'RULE' ? 'rule' : 'risk factor'} will be live once deployed`
    : undefined;

  // NOTE: If the rule is just enabled and is deploying, we disable changing the status for 15 minutes
  // to avoid sending too many pre-aggregation tasks repeatedly
  const justDeploying = isDeploying && dayjs().diff(entity.updatedAt, 'minute') < 15;
  return (
    <Tooltip title={tooltipText} placement="top">
      <Toggle
        isLoading={isDeploying}
        isDisabled={!canWriteRules || justDeploying || isDisabled}
        value={entity.status !== 'INACTIVE'}
        onChange={(newValue) => {
          onToggle?.(newValue ?? false);
        }}
      />
    </Tooltip>
  );
};
