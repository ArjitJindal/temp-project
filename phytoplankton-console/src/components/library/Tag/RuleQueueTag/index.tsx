import React from 'react';
import { LoadingOutlined } from '@ant-design/icons';
import { useRuleQueue } from '../../../rules/util';
import Tooltip from '@/components/library/Tooltip';
import Tag from '@/components/library/Tag';

interface Props {
  queueId?: string;
}

const RuleQueueTag: React.FC<Props> = ({ queueId }) => {
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

export default RuleQueueTag;
