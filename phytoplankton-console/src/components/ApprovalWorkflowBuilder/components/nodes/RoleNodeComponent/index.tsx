import React from 'react';
import { NodeComponentProps } from '../../../NodeCanvas/node_canvas';
import NodeBase from '../../../NodeCanvas/components/NodeBase';
import s from './index.module.less';
import EditButton from './EditButton';
import { useNodeContext } from '@/components/ApprovalWorkflowBuilder/NodeCanvas/nodeContext';
import { useRoles } from '@/utils/api/auth';
import Skeleton from '@/components/library/Skeleton';
import Tag from '@/components/library/Tag';

export type Data = {
  role: string;
};

type Props = NodeComponentProps<string, Data>;

export default function RoleNodeComponent(props: Props) {
  const nodeContextValue = useNodeContext();
  const { roles } = useRoles();

  return (
    <NodeBase
      {...props}
      handles={[
        {
          position: 'BOTTOM',
          type: 'SOURCE',
        },
        {
          position: 'TOP',
          type: 'TARGET',
        },
      ]}
    >
      <div className={s.root}>
        <div className={s.header}>
          <div className={s.headerLeft}>Role</div>
          <div className={s.headerRight}>
            <EditButton
              onClick={() => {
                nodeContextValue.onClickNode?.({
                  id: props.id,
                  type: 'ROLE',
                  data: props.data,
                });
              }}
            />
          </div>
        </div>
        <div>
          <Skeleton res={roles.data}>
            {(roles) => {
              const role = roles.items.find((role) => role.id === props.data.role);
              return <Tag>{role?.name ?? props.data.role}</Tag>;
            }}
          </Skeleton>
        </div>
      </div>
    </NodeBase>
  );
}
