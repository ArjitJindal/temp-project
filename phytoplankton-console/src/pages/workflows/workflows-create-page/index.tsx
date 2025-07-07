import { useNavigate, useParams } from 'react-router';
import { useMemo } from 'react';
import { humanizeAuto } from '@flagright/lib/utils/humanize';
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
import { WorkflowBuilderState } from '@/components/WorkflowBuilder/types';
import { message } from '@/components/library/Message';
import { getErrorMessage } from '@/utils/lang';
import { parseWorkflowType } from '@/utils/api/workflows';

export default function WorkflowsCreatePage() {
  const { type, templateId } = useParams<'type' | 'templateId'>() as {
    type: string;
    templateId: string;
  };

  const workflowType = parseWorkflowType(type);

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

  // Keep state wrapped in an AsyncResource
  const [state, dispatch] = useReducerWrapper(
    success(
      template
        ? deserialize({ ...template.item, enabled: true })
        : { transitions: [], enabled: true },
    ),
  );

  const saveWorkflowMutation = useMutation<
    unknown,
    unknown,
    {
      state: WorkflowBuilderState;
    }
  >(
    async ({ state }) => {
      const serialized = serialize(state);
      await api.createWorkflow({
        workflowType: workflowType,
        CreateWorkflowType:
          workflowType === 'alert'
            ? {
                alertWorkflow: {
                  ...serialized,
                  author: '', // TODO: add author
                  id: 'not_required_for_creation',
                  workflowType: 'alert',
                  version: state.transitions.length, // TODO: add version
                  name: 'not_required_for_creation',
                },
              }
            : {
                caseWorkflow: {
                  ...serialized,
                  author: '', // TODO: add author
                  id: 'not_required_for_creation',
                  workflowType: 'case',
                  version: state.transitions.length, // TODO: add version
                  name: 'not_required_for_creation',
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
              {
                title: `New workflow`,
                to: makeUrl('/workflows/:type/create/:templateId', { type, templateId }),
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
