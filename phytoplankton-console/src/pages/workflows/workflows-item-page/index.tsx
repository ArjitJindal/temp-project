import { useNavigate, useParams } from 'react-router';
import { useEffect } from 'react';
import { humanizeAuto } from '@flagright/lib/utils/humanize';
import { deserialize, serialize } from '../serialization';
import s from './index.module.less';
import WorkflowBuilder from '@/components/WorkflowBuilder';
import Breadcrumbs from '@/components/library/Breadcrumbs';
import Button from '@/components/library/Button';
import { notEmpty } from '@/utils/array';
import { makeUrl } from '@/utils/routing';
import { useApi } from '@/api';
import { useWorkflowItem } from '@/hooks/api';
import { parseWorkflowType, WorkflowItem } from '@/hooks/api/workflows';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { isLoading, isSuccess, map, useIsResourceChangedStatus } from '@/utils/asyncResource';
import { useReducerWrapper } from '@/pages/workflows/workflows-item-page/helpers';
import { WorkflowBuilderState } from '@/components/WorkflowBuilder/types';
import { useMutation } from '@/utils/queries/mutations/hooks';
import { message } from '@/components/library/Message';
import { getErrorMessage } from '@/utils/lang';
import { CreateAlertWorkflow } from '@/apis/models/CreateAlertWorkflow';
import { CreateCaseWorkflow } from '@/apis/models/CreateCaseWorkflow';

export default function WorkflowsItemPage() {
  const { type, id } = useParams<'id' | 'type'>() as {
    id: string;
    type: string;
  };

  const workflowType = parseWorkflowType(type);

  const navigate = useNavigate();

  const api = useApi();
  const workflowsQueryResult = useWorkflowItem(workflowType, id);

  // Keep state wrapped in an AsyncResource
  const [state, dispatch] = useReducerWrapper();
  const isResourceChangedStatus = useIsResourceChangedStatus(workflowsQueryResult.data);
  useEffect(() => {
    if (isResourceChangedStatus) {
      dispatch({
        type: 'LOAD_ASYNC_RESOURCE' as const,
        payload: map(workflowsQueryResult.data, (item) => {
          if (item.workflowType !== 'alert' && item.workflowType !== 'case') {
            throw new Error(`Workflow type not supported yet: ${item.workflowType}`);
          }
          return deserialize(item);
        }),
      });
    }
  }, [isResourceChangedStatus, workflowsQueryResult.data, dispatch]);

  const saveWorkflowMutation = useMutation<
    unknown,
    unknown,
    {
      item: WorkflowItem;
      state: WorkflowBuilderState;
    }
  >(
    async ({ item, state }) => {
      if (item.workflowType !== 'alert' && item.workflowType !== 'case') {
        throw new Error(`Workflow type not supported yet: ${item.workflowType}`);
      }
      await api.postWorkflowVersion({
        workflowType: workflowType,
        workflowId: id,
        CreateWorkflowType:
          item.workflowType === 'alert'
            ? {
                alertWorkflow: {
                  ...(item as CreateAlertWorkflow),
                  ...serialize(state),
                },
              }
            : {
                caseWorkflow: {
                  ...(item as CreateCaseWorkflow),
                  ...serialize(state),
                },
              },
      });
    },
    {
      onError: (error) => {
        message.error('Unable to save workflow', {
          details: getErrorMessage(error),
        });
      },
      onSuccess: () => {
        message.success('Workflow saved');
        navigate('/workflows/list');
      },
    },
  );

  return (
    <div className={s.root}>
      <div className={s.header}>
        <div className={s.headerLeft}>
          <Breadcrumbs
            items={[
              { title: 'Workflows', to: '/workflows' },
              { title: 'My workflow', to: '/workflows/list' },
              { title: humanizeAuto(type) },
              { title: `Workflow ${id}`, to: makeUrl('/workflows/:type/item/:id', { type, id }) },
            ].filter(notEmpty)}
          />
        </div>
        <div className={s.headerRight}>
          <Button
            type="SECONDARY"
            onClick={() => {
              navigate('/workflows/list');
            }}
          >
            Cancel
          </Button>
          <Button
            type="PRIMARY"
            isLoading={isLoading(state) || isLoading(saveWorkflowMutation.dataResource)}
            onClick={() => {
              if (!isSuccess(workflowsQueryResult.data)) {
                throw new Error(`Source workflow item is not loaded yet, unable to update it`);
              }
              const item = workflowsQueryResult.data.value;
              if (isSuccess(state)) {
                saveWorkflowMutation.mutate({ item, state: state.value });
              }
            }}
          >
            Publish
          </Button>
        </div>
      </div>
      <div className={s.content}>
        <AsyncResourceRenderer resource={state}>
          {(state) => <WorkflowBuilder workflowType={workflowType} state={[state, dispatch]} />}
        </AsyncResourceRenderer>
      </div>
    </div>
  );
}
