import type { Props } from './node_canvas';
import { makeAsyncComponent } from '@/utils/imports';
import { NodeDescription } from '@/components/ApprovalWorkflowBuilder/NodeCanvas/types';

const Component = makeAsyncComponent(() => import('./node_canvas'));

export default Component as unknown as <NodeTypes extends NodeDescription<string, unknown>>(
  props: Props<NodeTypes>,
) => JSX.Element;
