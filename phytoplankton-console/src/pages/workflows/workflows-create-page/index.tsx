import { useNavigate, useParams } from 'react-router';
import { useMemo } from 'react';
import { humanizeAuto } from '@flagright/lib/utils/humanize';
import { useQueryClient } from '@tanstack/react-query';
import { deserialize, serialize } from '../serialization';
import { useReducerWrapper } from '../workflows-item-page/helpers';
import s from './index.module.less';
import WorkflowBuilder from '@/components/WorkflowBuilder';
import Breadcrumbs from '@/components/library/Breadcrumbs';
import Button from '@/components/library/Button';
import { notEmpty } from '@/utils/array';
import { makeUrl } from '@/utils/routing';
import { useApi } from '@/api';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { isLoading, isSuccess, success } from '@/utils/asyncResource';
import { Template, TEMPLATE_GROUPS } from '@/pages/workflows/workflows-page/workflows-library/data';
import { useMutation } from '@/utils/queries/mutations/hooks';
import { message } from '@/components/library/Message';
import { getErrorMessage } from '@/utils/lang';
import { parseWorkflowType } from '@/utils/api/workflows';
import {
  AlertWorkflowWorkflowTypeEnum,
  AnyWorkflow,
  ApprovalWorkflowWorkflowTypeEnum,
  CaseWorkflowWorkflowTypeEnum,
  CreateWorkflowType,
} from '@/apis';
import { WORKFLOW_BUILDER_STATE_REDUCER as STANDARD_WORKFLOW_BUILDER_STATE_REDUCER } from '@/components/WorkflowBuilder/helpers';
import { WORKFLOW_BUILDER_STATE_REDUCER as APPROVAL_WORKFLOW_BUILDER_STATE_REDUCER } from '@/components/ApprovalWorkflowBuilder/helpers';
import ApprovalWorkflowBuilder from '@/components/ApprovalWorkflowBuilder';
import { WorkflowBuilderState as ApprovalWorkflowBuilderState } from '@/components/ApprovalWorkflowBuilder/types';
import { WorkflowBuilderState } from '@/components/WorkflowBuilder/types';
import PublishModal from '@/pages/workflows/workflows-create-page/PublishModal';
import { WORKFLOWS_LIST } from '@/utils/queries/keys';

export default function WorkflowsCreatePage() {
  const { type, templateId } = useParams<'type' | 'templateId'>() as {
    type: string;
    templateId: string;
  };

  const workflowType = parseWorkflowType(type);

  if (workflowType === 'change-approval') {
    return <ApprovalWorkflowsCreatePage templateId={templateId} workflowType={workflowType} />;
  }

  return <StandardWorkflowCreatePage workflowType={workflowType} templateId={templateId} />;
}

function StandardWorkflowCreatePage(props: {
  templateId: string;
  workflowType: CaseWorkflowWorkflowTypeEnum | AlertWorkflowWorkflowTypeEnum;
}) {
  const { templateId, workflowType } = props;
  const template = useMemo((): Template | null => {
    if (templateId === 'custom') {
      return null;
    }
    const templateGroup = TEMPLATE_GROUPS.find((x) => x.type === workflowType);
    if (templateGroup == null) {
      throw new Error(`Template group of type ${workflowType} not found`);
    }
    const template = templateGroup.templates.find((t) => t.id === templateId);
    if (template == null) {
      throw new Error(`Template ${templateId} of type ${workflowType} not found`);
    }
    return template;
  }, [workflowType, templateId]);

  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const api = useApi();

  // Keep state wrapped in an AsyncResource
  const [state, dispatch] = useReducerWrapper(
    STANDARD_WORKFLOW_BUILDER_STATE_REDUCER,
    success(
      template && template.item.workflowType === workflowType
        ? deserialize({ ...template.item, enabled: true })
        : { transitions: [], enabled: true },
    ),
  );

  const saveWorkflowMutation = useMutation<
    AnyWorkflow,
    unknown,
    {
      state: WorkflowBuilderState;
    }
  >(
    async ({ state }) => {
      const serialized = serialize(state);
      return await api.createWorkflow({
        workflowType: workflowType,
        CreateWorkflowType:
          workflowType === 'alert'
            ? {
                alertWorkflow: {
                  ...serialized,
                  name: 'not_required_for_creation',
                  description: 'not_required_for_creation',
                  enabled: true,
                },
              }
            : {
                caseWorkflow: {
                  ...serialized,
                  name: 'not_required_for_creation',
                  description: 'not_required_for_creation',
                  enabled: true,
                  autoClose: false, // todo: fill
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
      onSuccess: async (result) => {
        message.success(`Workflow ${result.id} created successfully.`, {
          link: makeUrl('/workflows/:type/item/:id', { type: workflowType, id: result.id }),
          details: 'To use it, assign it in a user settings',
          position: 'bottom-right',
        });
        navigate('/workflows/list');
        await queryClient.invalidateQueries(WORKFLOWS_LIST({}));
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
                title: `New workflow`,
                to: makeUrl('/workflows/:type/create/:templateId', {
                  type: workflowType,
                  templateId,
                }),
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
              if (isSuccess(state)) {
                saveWorkflowMutation.mutate({ state: state.value });
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

function ApprovalWorkflowsCreatePage(props: {
  templateId: string;
  workflowType: ApprovalWorkflowWorkflowTypeEnum;
}) {
  const { workflowType, templateId } = props;

  const template = useMemo((): Template | null => {
    if (templateId === 'custom') {
      return null;
    }
    const templateGroup = TEMPLATE_GROUPS.find((x) => x.type === workflowType);
    if (templateGroup == null) {
      throw new Error(`Template group of type ${workflowType} not found`);
    }
    const template = templateGroup.templates.find((t) => t.id === templateId);
    if (template == null) {
      throw new Error(`Template ${templateId} of type ${workflowType} not found`);
    }
    return template;
  }, [workflowType, templateId]);

  const navigate = useNavigate();

  const api = useApi();
  const queryClient = useQueryClient();

  // Keep state wrapped in an AsyncResource
  const [state, dispatch] = useReducerWrapper(
    APPROVAL_WORKFLOW_BUILDER_STATE_REDUCER,
    success({
      roles:
        template != null && template.item.workflowType === 'change-approval'
          ? template.item.approvalChain
          : [],
    }),
  );

  const saveWorkflowMutation = useMutation<
    AnyWorkflow,
    unknown,
    {
      name: string;
      description: string;
      state: ApprovalWorkflowBuilderState;
    }
  >(
    async ({ name, description, state }) => {
      const workflowPayload = {
        name: name,
        description: description,
        enabled: true,
        approvalChain: state.roles,
      };
      const payload: CreateWorkflowType = {};
      if (workflowType === 'change-approval') {
        payload.approvalWorkflow = workflowPayload;
      }
      return await api.createWorkflow({
        workflowType: workflowType,
        CreateWorkflowType: payload,
      });
    },
    {
      onError: (error) => {
        message.error('Unable to save workflow', {
          details: getErrorMessage(error),
        });
      },
      onSuccess: async (result) => {
        message.success(`Workflow ${result.id} created successfully.`, {
          link: makeUrl('/workflows/:type/item/:id', { type: workflowType, id: result.id }),
          details: 'To use it, assign it in a user settings',
          position: 'bottom-right',
        });
        navigate('/workflows/list');
        await queryClient.invalidateQueries(WORKFLOWS_LIST({}));
      },
    },
  );

  const disabledTooltip: string | undefined = useMemo(() => {
    if (!isSuccess(state)) {
      return undefined;
    }
    if (state.value.roles.length === 0) {
      return 'Workflow should have at least one role defined';
    }

    return undefined;
  }, [state]);

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
                title: `New workflow`,
                to: makeUrl('/workflows/:type/create/:templateId', {
                  type: workflowType,
                  templateId,
                }),
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
          <PublishModal
            initialValues={
              template != null
                ? {
                    name: template.item.name,
                    description: template.item.description ?? '',
                  }
                : undefined
            }
            progressRes={saveWorkflowMutation.dataResource}
            onConfirm={async (formValues) => {
              if (isSuccess(state)) {
                await saveWorkflowMutation.mutateAsync({
                  name: formValues.name,
                  description: formValues.description,
                  state: state.value,
                });
              }
            }}
          >
            {({ onOpenModal }) => (
              <Button
                type="PRIMARY"
                disabledTooltip={disabledTooltip}
                isDisabled={disabledTooltip != null}
                isLoading={isLoading(state) || isLoading(saveWorkflowMutation.dataResource)}
                onClick={onOpenModal}
              >
                Publish
              </Button>
            )}
          </PublishModal>
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
