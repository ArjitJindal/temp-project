import React from 'react';
import NodeBase, { NodeBaseProps } from '../../components/NodeBase';
import LogicTag from '../../components/LogicTag';
import EditButton from '../../components/EditButton';
import s from './index.module.less';
import GitMergeLineIcon from '@/components/ui/icons/Remix/development/git-merge-line.react.svg';

import COLORS from '@/components/ui/colors';

interface Props extends NodeBaseProps<{ logic: unknown }> {}

export default function IfNode(props: Props) {
  const { data } = props;
  return (
    <NodeBase
      headerLeft={
        <LogicTag color={COLORS.purple.tint} icon={<GitMergeLineIcon />}>
          If
        </LogicTag>
      }
      headerRight={
        <EditButton
          onClick={() => {
            console.error(`Not implemented yet`);
          }}
        />
      }
      handles={[
        { position: 'BOTTOM', type: 'SOURCE' },
        { position: 'TOP', type: 'TARGET' },
      ]}
    >
      <div className={s.root}>{JSON.stringify(data)}</div>
    </NodeBase>
  );
}
