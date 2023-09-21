import { Tag } from 'antd';
import React from 'react';
import { LoadingOutlined } from '@ant-design/icons';
import Tooltip from '../library/Tooltip';
import { useRuleQueue } from './util';

interface Props {
  queueId?: string;
}

export const RuleQueueTag: React.FC<Props> = ({ queueId }) => {
  const [ruleQueue, isLoading] = useRuleQueue(queueId);
  return (
    <Tag>
      {isLoading ? (
        <LoadingOutlined />
      ) : (
        <Tooltip title={ruleQueue?.description || 'No description'}>
          {ruleQueue?.name || 'default'}
        </Tooltip>
      )}
    </Tag>
  );
};
