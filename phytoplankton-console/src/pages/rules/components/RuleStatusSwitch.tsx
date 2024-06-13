import { Switch } from 'antd';
import cn from 'clsx';
import React from 'react';
import s from './style.module.less';
import { useHasPermissions } from '@/utils/user-utils';
import { RuleInstance } from '@/apis';
import Tooltip from '@/components/library/Tooltip';
import { dayjs } from '@/utils/dayjs';

interface RuleStatusSwitchProps {
  ruleInstance: RuleInstance;
  onToggle?: (enabled: boolean) => void;
}

export const RuleStatusSwitch: React.FC<RuleStatusSwitchProps> = (props: RuleStatusSwitchProps) => {
  const canWriteRules = useHasPermissions(['rules:my-rules:write']);
  const { ruleInstance, onToggle } = props;
  const isDeploying = ruleInstance.status === 'DEPLOYING';
  const tooltipText = isDeploying ? 'The rule will be live once deployed' : undefined;

  // NOTE: If the rule is just enabled and is deploying, we disable changing the status for 15 minutes
  // to avoid sending too many pre-aggregation tasks repeatedly
  const justDeploying = isDeploying && dayjs().diff(ruleInstance.updatedAt, 'minute') < 15;
  return (
    <Tooltip title={tooltipText} placement="top">
      <Switch
        className={cn(isDeploying && s.deploying)}
        disabled={!canWriteRules || justDeploying}
        checked={ruleInstance.status !== 'INACTIVE'}
        onChange={onToggle}
      />
    </Tooltip>
  );
};
