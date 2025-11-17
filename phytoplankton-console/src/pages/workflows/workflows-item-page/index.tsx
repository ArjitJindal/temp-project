import { useNavigate, useParams } from 'react-router';
import { useEffect, useMemo } from 'react';
import { humanizeAuto } from '@flagright/lib/utils/humanize';
import { useQueryClient } from '@tanstack/react-query';
import { deserialize, serialize } from '../serialization';
import s from './index.module.less';
import WorkflowBuilder from '@/components/WorkflowBuilder';
import Breadcrumbs from '@/components/library/Breadcrumbs';
import Button from '@/components/library/Button';
import { notEmpty } from '@/utils/array';
import { makeUrl } from '@/utils/routing';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { WORKFLOWS_ITEM } from '@/utils/queries/keys';
import { parseWorkflowType, WorkflowItem } from '@/utils/api/workflows';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { isLoading, isSuccess, map, useIsResourceChangedStatus } from '@/utils/asyncResource';
import { useReducerWrapper } from '@/pages/workflows/workflows-item-page/helpers';
import { WorkflowBuilderState as StandardWorkflowBuilderState } from '@/components/WorkflowBuilder/types';
import { useMutation } from '@/utils/queries/mutations/hooks';
import { message } from '@/components/library/Message';
import { getErrorMessage, isEqual } from '@/utils/lang';
import { CreateAlertWorkflow } from '@/apis/models/CreateAlertWorkflow';
import { CreateCaseWorkflow } from '@/apis/models/CreateCaseWorkflow';
import {
  AlertWorkflowWorkflowTypeEnum,
  ApprovalWorkflow,
  ApprovalWorkflowWorkflowTypeEnum,
  CaseWorkflowWorkflowTypeEnum,
  CreateWorkflowType,
} from '@/apis';
import { WORKFLOW_BUILDER_STATE_REDUCER as STANDARD_WORKFLOW_BUILDER_STATE_REDUCER } from '@/components/WorkflowBuilder/helpers';
import { WORKFLOW_BUILDER_STATE_REDUCER as APPROVAL_WORKFLOW_BUILDER_STATE_REDUCER } from '@/components/ApprovalWorkflowBuilder/helpers';
import ApprovalWorkflowBuilder from '@/components/ApprovalWorkflowBuilder';
import { WorkflowBuilderState as ApprovalWorkflowBuilderState } from '@/components/ApprovalWorkflowBuilder/types';

export default function WorkflowsItemPage() {
  const { type, id } = useParams<'id' | 'type'>() as {
    id: string;
    type: string;
  };

  const workflowType = parseWorkflowType(type);

  if (workflowType === 'alert' || workflowType === 'case') {
    return <StandardWorkflowsItemPage id={id} workflowType={workflowType} />;
  }

  return <ApprovalWorkflowsItemPage id={id} workflowType={workflowType} />;
}

function StandardWorkflowsItemPage(props: {
  id: string;
  workflowType: CaseWorkflowWorkflowTypeEnum | AlertWorkflowWorkflowTypeEnum;
}) {
  const { id, workflowType } = props;
  const navigate = useNavigate();

  const api = useApi();
  const workflowsQueryResult = useQuery(
    WORKFLOWS_ITEM(workflowType, id),
    async (): Promise<WorkflowItem> => {
      return await api.getWorkflowById({
        workflowType: workflowType,
        workflowId: id,
      });
    },
  );

  // Keep state wrapped in an AsyncResource
  const [state, dispatch] = useReducerWrapper(STANDARD_WORKFLOW_BUILDER_STATE_REDUCER);
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
      state: StandardWorkflowBuilderState;
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
              { title: humanizeAuto(workflowType) },
              {
                title: id,
                to: makeUrl('/workflows/:type/item/:id', { type: workflowType, id }),
              },
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

function ApprovalWorkflowsItemPage(props: {
  id: string;
  workflowType: ApprovalWorkflowWorkflowTypeEnum; // Unified approval workflow type
}) {
  const { id, workflowType } = props;
  const navigate = useNavigate();

  const api = useApi();
  const queryClient = useQueryClient();
  const workflowsQueryResult = useQuery(
    WORKFLOWS_ITEM(workflowType, id),
    async (): Promise<ApprovalWorkflow> => {
      // Support unified approval workflow type
      return await api.getWorkflowById({
        workflowType: workflowType,
        workflowId: id,
      });
    },
  );

  // Keep state wrapped in an AsyncResource
  const [state, dispatch] = useReducerWrapper(APPROVAL_WORKFLOW_BUILDER_STATE_REDUCER);
  const isResourceChangedStatus = useIsResourceChangedStatus(workflowsQueryResult.data);
  useEffect(() => {
    if (isResourceChangedStatus) {
      dispatch({
        type: 'LOAD_ASYNC_RESOURCE' as const,
        payload: map(workflowsQueryResult.data, (item) => {
          return {
            roles: item.approvalChain,
          };
        }),
      });
    }
  }, [isResourceChangedStatus, workflowsQueryResult.data, dispatch]);

  const saveWorkflowMutation = useMutation<
    unknown,
    unknown,
    {
      item: WorkflowItem;
      state: ApprovalWorkflowBuilderState;
    }
  >(
    async ({ item, state }) => {
      const changes: CreateWorkflowType = {};
      if (item.workflowType === 'change-approval') {
        changes.approvalWorkflow = {
          ...item,
          description: item.description ?? '',
          approvalChain: state.roles,
        };
      } else {
        throw new Error(`Workflow type not supported yet: ${item.workflowType}`);
      }
      await api.postWorkflowVersion({
        workflowType: workflowType,
        workflowId: id,
        CreateWorkflowType: changes,
      });
    },
    {
      onError: (error) => {
        message.error('Unable to save workflow', {
          details: getErrorMessage(error),
        });
      },
      onSuccess: async () => {
        message.success('Workflow saved');
        navigate('/workflows/list');
        await queryClient.invalidateQueries(WORKFLOWS_ITEM(workflowType, id));
      },
    },
  );

  const disabledTooltip: string | undefined = useMemo(() => {
    if (!isSuccess(state) || !isSuccess(workflowsQueryResult.data)) {
      return undefined;
    }

    if (isEqual(state.value.roles, workflowsQueryResult.data.value.approvalChain)) {
      return 'There are not changes to publish';
    }

    if (state.value.roles.length === 0) {
      return 'Workflow should have at least one role defined';
    }

    return undefined;
  }, [state, workflowsQueryResult.data]);

  return (
    <div className={s.root}>
      <div className={s.header}>
        <div className={s.headerLeft}>
          <Breadcrumbs
            items={[
              { title: 'Workflows', to: '/workflows' },
              { title: 'My workflow', to: '/workflows/list' },
              { title: humanizeAuto(workflowType) },
              {
                title: id,
                to: makeUrl('/workflows/:type/item/:id', { type: workflowType, id }),
              },
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
            disabledTooltip={disabledTooltip}
            isDisabled={disabledTooltip != null}
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
          {(state) => <ApprovalWorkflowBuilder state={[state, dispatch]} />}
        </AsyncResourceRenderer>
      </div>
    </div>
  );
}
