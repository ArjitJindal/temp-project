import { humanizeAuto } from '@flagright/lib/utils/humanize';
import EditButton from '../../components/EditButton';
import NodeBase, { NodeBaseProps } from '../../components/NodeBase';
import IfTag from '../../../components/IfTag';
import ThenTag from '../../../components/ThenTag';
import s from './index.module.less';

import { useNodeContext } from '@/components/WorkflowBuilder/NodeCanvas/nodeContext';
import { NodeDescription } from '@/components/WorkflowBuilder/NodeCanvas/types';
import Skeleton from '@/components/library/Skeleton';

interface Props
  extends NodeBaseProps<{
    transitionId: string;
    condition: {
      action: string;
    };
    outcome: {
      status: string;
      assignee?: string;
    };
  }> {}

export default function TransitionNode(props: Props) {
  const { data } = props;

  const nodeContextValue = useNodeContext();
  const availableRolesResouces = nodeContextValue.availableRoles;

  const { condition, outcome } = data;
  return (
    <NodeBase
      id={props.id}
      headerLeft={<IfTag size="SMALL" />}
      headerRight={
        <EditButton
          onClick={() => {
            nodeContextValue.onClickNode?.(props as NodeDescription);
          }}
        />
      }
      handles={[
        { position: 'BOTTOM', type: 'SOURCE' },
        { position: 'TOP', type: 'TARGET' },
        { position: 'RIGHT', type: 'SOURCE' },
        { position: 'LEFT', type: 'SOURCE' },
      ]}
    >
      <div className={s.root}>
        <div className={s.content}>
          <div className={s.text}>
            {'Action is '}
            <b>{humanizeAuto(condition.action)}</b>
          </div>
        </div>
        <div className={s.content}>
          <div>
            <ThenTag size={'SMALL'} />
          </div>
          <div className={s.textLine}>
            {'Status is '}
            <b>{humanizeAuto(outcome.status)}</b>
          </div>
          {outcome.assignee && (
            <div className={s.textLine}>
              {'Assignee is '}
              <Skeleton res={availableRolesResouces} text={outcome.assignee}>
                {(roles) => (
                  <b>{roles.find((x) => x.id === outcome.assignee)?.name ?? outcome.assignee}</b>
                )}
              </Skeleton>
            </div>
          )}
        </div>
      </div>
    </NodeBase>
  );
}
