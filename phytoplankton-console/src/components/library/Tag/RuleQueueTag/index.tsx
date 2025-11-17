import React from 'react';
import { LoadingOutlined } from '@ant-design/icons';
import Tooltip from '@/components/library/Tooltip';
import Tag from '@/components/library/Tag';
import { useRuleQueue } from '@/utils/api/rules';

interface Props {
  queueId?: string;
}

const RuleQueueTag: React.FC<Props> = ({ queueId }) => {
  const { ruleQueue, isLoading } = useRuleQueue(queueId ?? '');
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
