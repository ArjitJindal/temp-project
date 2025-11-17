import React from 'react';
import { useNodeContext } from '../../../NodeCanvas/nodeContext';
import { NodeComponentProps } from '../../../NodeCanvas/node_canvas';
import Handle from '../../../NodeCanvas/components/Handle';
import s from './index.module.less';
import AddLineIcon from '@/components/ui/icons/Remix/system/add-line.react.svg';

export type Data = {
  isDisabled: boolean;
  afterRole: string | null;
};

type Props = NodeComponentProps<string, Data>;

export default function NewBranchButtonNode(props: Props) {
  const { data } = props;
  const nodeContextValue = useNodeContext();
  return (
    <button
      className={s.root}
      disabled={data?.isDisabled}
      onClick={() => {
        nodeContextValue.onClickNode?.({
          id: props.id,
          type: props.type,
          data: props.data,
        });
      }}
    >
      <Handle type={'TARGET'} position={'TOP'} nodeId={props.id} />
      <div className={s.icon}>
        <AddLineIcon />
      </div>
      {data?.text}
    </button>
  );
}
