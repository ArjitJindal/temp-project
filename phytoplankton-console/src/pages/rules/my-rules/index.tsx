import { useCallback, useMemo, useRef, useState } from 'react';
import { EditOutlined, EyeOutlined } from '@ant-design/icons';
import { useMutation } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { capitalizeNameFromEmail } from '@flagright/lib/utils/humanize';
import { getRuleInstanceDisplayId, useRulesResults, useUpdateRuleInstance } from '../utils';
import { RuleStatusSwitch } from '../components/RuleStatusSwitch';
import RuleActionsMenu from '../components/RuleActionsMenu';
import s from './style.module.less';
import Tooltip from '@/components/library/Tooltip';
import { RuleInstance, RuleRunMode } from '@/apis';
import { useApi } from '@/api';
import {
  CommonParams,
  SortingParamsItem,
  TableColumn,
  TableRefType,
} from '@/components/library/Table/types';
import { useRules } from '@/utils/rules';
import { getMutationAsyncResource } from '@/utils/queries/mutations/helpers';
import QueryResultsTable from '@/components/shared/QueryResultsTable';
import { getErrorMessage } from '@/utils/lang';
import { useAuth0User, useHasResources } from '@/utils/user-utils';
import Button from '@/components/library/Button';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { BOOLEAN, DATE, ENUM, PRIORITY } from '@/components/library/Table/standardDataTypes';
import { message } from '@/components/library/Message';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import { useSafeLocalStorageState, useScrollToFocus } from '@/utils/hooks';
import { makeUrl, parseQueryString } from '@/utils/routing';
import RuleHitInsightsTag from '@/components/library/Tag/RuleHitInsightsTag';
import RuleQueueTag from '@/components/library/Tag/RuleQueueTag';
import SegmentedControl, { Item } from '@/components/library/SegmentedControl';
import { formatNumber } from '@/utils/number';

const DEFAULT_SORTING: SortingParamsItem = ['ruleId', 'ascend'];

const RULES_SEGMENTED_CONTROL_ITEMS: Item<RuleRunMode>[] = [
  { value: 'LIVE', label: 'Live rules' },
  { value: 'SHADOW', label: 'Shadow rules' },
];

export function canSimulate(ruleInstance: RuleInstance) {
  return ruleInstance.type === 'TRANSACTION';
}

const MyRule = (props: { simulationMode?: boolean }) => {
  useScrollToFocus();
  const api = useApi();
  const auth0User = useAuth0User();
  const canWriteRules = useHasResources(['write:::rules/my-rules/*']);
  const [updatedRuleInstances, setUpdatedRuleInstances] = useState<{ [key: string]: RuleInstance }>(
    {},
  );
  const [ruleMode, setRuleMode] = useSafeLocalStorageState<RuleRunMode>('ruleMode', 'LIVE');
  const actionRef = useRef<TableRefType>(null);
  const reloadTable = useCallback(() => {
    actionRef.current?.reload();
  }, []);

  const navigate = useNavigate();

  const onViewRule = useCallback(
    (entity) => {
      navigate(
        makeUrl('/rules/my-rules/:id', {
          id: entity.id,
        }),
      );
    },
    [navigate],
  );

  const onEditRule = useCallback(
    (entity) => {
      navigate(
        makeUrl('/rules/my-rules/:id/:mode', {
          id: entity.id,
          mode: 'edit',
        }),
      );
    },
    [navigate],
  );

  const onDuplicateRule = useCallback(
    (entity) => {
      navigate(
        makeUrl('/rules/my-rules/:id/:mode', {
          id: entity.id,
          mode: 'duplicate',
        }),
      );
    },
    [navigate],
  );

  const onPreviewRule = useCallback(
    (entity) => {
      navigate(
        makeUrl('/rules/my-rules/:id/:mode', {
          id: entity.id,
          mode: 'read',
        }),
      );
    },
    [navigate],
  );

  const [params, setParams] = useState<CommonParams>({
    ...DEFAULT_PARAMS_STATE,
    sort: [DEFAULT_SORTING],
    pagination: false,
  });
  const handleChangeParams = useCallback((newParams: CommonParams) => {
    setParams(newParams);
    setUpdatedRuleInstances({});
  }, []);
  const handleReload = useCallback(() => {
    setUpdatedRuleInstances({});
  }, []);

  const focusId = useMemo(() => parseQueryString(location.search).focus, []);

  const [deleting, setDeleting] = useState(false);
  const { rules } = useRules();
  const handleRuleInstanceUpdate = useCallback(async (newRuleInstance: RuleInstance) => {
    const newRuleInstanceId = newRuleInstance.id;
    if (!newRuleInstanceId) {
      message.fatal('Rule instance ID is not set');
      return;
    }
    setUpdatedRuleInstances((prev) => ({ ...prev, [newRuleInstanceId]: newRuleInstance }));
  }, []);
  const updateRuleInstanceMutation = useUpdateRuleInstance(handleRuleInstanceUpdate);

  const handleDeleteRuleInstanceMutation = useMutation<string, Error, string>(
    async (ruleInstanceId) => {
      await api.deleteRuleInstancesRuleInstanceId({ ruleInstanceId });
      return ruleInstanceId;
    },
    {
      onSuccess: (ruleInstanceId) => {
        message.success('Rule deleted successfully', {
          details: `${capitalizeNameFromEmail(
            auth0User?.name || '',
          )} deleted the rule ${ruleInstanceId}`,
        });
        reloadTable();
        setDeleting(false);
      },
      onError: (e) => {
        message.fatal(`Failed to delete rule: ${getErrorMessage(e)}`, e);
        setDeleting(false);
      },
    },
  );

  const handleActivationChange = useCallback(
    async (ruleInstance: RuleInstance, activated: boolean) => {
      updateRuleInstanceMutation.mutate({
        ...ruleInstance,
        status: activated ? 'ACTIVE' : 'INACTIVE',
      });
    },
    [updateRuleInstanceMutation],
  );

  const getRuleTags = (rule: RuleInstance): string[] => {
    const tags: string[] = [];
    const hitCount = rule.hitCount;
    const hitRate = rule.runCount ? ((hitCount ?? 0) / rule.runCount) * 100 : 0;
    if (hitRate === 0) {
      tags.push('Rule not run');
    } else if (hitRate > 10) {
      tags.push('High hit rate');
    }
    return tags;
  };

  const columns: TableColumn<RuleInstance>[] = useMemo((): TableColumn<RuleInstance>[] => {
    const helper = new ColumnHelper<RuleInstance>();

    return helper.list([
      helper.simple<'casePriority'>({
        key: 'casePriority',
        title: '',
        disableColumnShuffling: true,
        type: PRIORITY,
        defaultWidth: 40,
        enableResizing: false,
        headerTitle: 'Priority',
      }),
      helper.simple<'ruleId'>({
        title: 'ID',
        key: 'ruleId',
        sorting: true,
        type: {
          render: (ruleId, { item: entity }) => {
            return (
              <Link to={makeUrl('/rules/my-rules/:id', { id: entity.id })}>
                {getRuleInstanceDisplayId(ruleId, entity.id)}
              </Link>
            );
          },
        },
      }),
      helper.simple<'id'>({
        title: 'Rule instance ID',
        key: 'id',
        hideInTable: true,
        exporting: true,
      }),
      helper.simple<'type'>({
        title: 'Rule type',
        key: 'type',
        type: ENUM,
        sorting: true,
      }),
      helper.simple<'ruleNameAlias'>({
        title: 'Name',
        key: 'ruleNameAlias',
        type: {
          render: (_, { item: entity }) => {
            if (!entity.id) {
              return <></>;
            }
            const ruleInstance = updatedRuleInstances[entity.id] || entity;
            return (
              <span style={{ fontSize: '14px' }}>
                {ruleInstance.ruleNameAlias || rules[ruleInstance.ruleId ?? '']?.name}
              </span>
            );
          },
        },
      }),
      helper.simple<'ruleDescriptionAlias'>({
        title: 'Description',
        key: 'ruleDescriptionAlias',
      }),
      helper.simple<'nature'>({
        title: 'Nature',
        key: 'nature',
        defaultVisibility: false,
      }),
      helper.derived<string>({
        id: 'hitCount',
        title: 'Hit rate',
        value: (row) => {
          if (row.hitCount && row.runCount) {
            return `${((row.hitCount / row.runCount) * 100).toFixed(2)}%`;
          }
          return '0%';
        },
        sorting: true,
        type: {
          render: (_value, { item: ruleInstance }) => {
            const displayHitCount = formatNumber(ruleInstance.hitCount ?? 0);
            const displayRunCount = formatNumber(ruleInstance.runCount ?? 0);
            const percent =
              ruleInstance.hitCount && ruleInstance.runCount
                ? (ruleInstance.hitCount / ruleInstance.runCount) * 100
                : 0;
            return (
              <>
                <div className={s.tag}>
                  <Tooltip title={<>{`Hit: ${displayHitCount} / Run: ${displayRunCount}`}</>}>
                    {(percent ?? 0.0)?.toFixed(2)}%
                  </Tooltip>
                  {percent > 10 && (
                    <RuleHitInsightsTag percentage={percent} runs={ruleInstance.runCount} />
                  )}
                </div>
              </>
            );
          },
        },
      }),
      helper.simple<'queueId'>({
        title: 'Queue',
        key: 'queueId',
        sorting: true,
        type: {
          render: (queueId) => {
            return <RuleQueueTag queueId={queueId} />;
          },
          stringify: (queueId) => queueId ?? 'default',
        },
      }),
      helper.simple<'ruleExecutionMode'>({
        title: 'Execution mode',
        key: 'ruleExecutionMode',
        defaultVisibility: true,
        sorting: true,
        type: {
          render: (ruleExecutionMode) => {
            const text = ruleExecutionMode === 'SYNC' ? 'Real time' : 'Post processing';
            return <span>{text}</span>;
          },
          stringify: (ruleExecutionMode) => {
            return ruleExecutionMode === 'SYNC' ? 'Real time' : 'Post processing';
          },
        },
      }),
      helper.simple<'createdAt'>({
        key: 'createdAt',
        title: 'Created at',
        type: DATE,
        sorting: 'desc',
      }),
      helper.simple<'updatedAt'>({
        key: 'updatedAt',
        title: 'Updated at',
        sorting: true,
        type: DATE,
      }),
      helper.derived<string>({
        title: 'Tags',
        value: (entity): string => getRuleTags(entity).join(),
        hideInTable: true,
        exporting: true,
      }),
      helper.derived<boolean>({
        id: 'enabled',
        title: 'Enabled',
        defaultSticky: 'RIGHT',
        value: (row) => row.status === 'ACTIVE',
        defaultWidth: 70,
        type: {
          ...BOOLEAN,
          render: (_, { item: entity }) => {
            if (!entity.id) {
              return <></>;
            }
            const ruleInstance = updatedRuleInstances[entity.id] || entity;
            return (
              <RuleStatusSwitch
                entity={ruleInstance}
                type="RULE"
                onToggle={(checked) => handleActivationChange(ruleInstance, checked)}
              />
            );
          },
        },
      }),
      helper.display({
        id: 'actions',
        title: 'Action',
        defaultSticky: 'RIGHT',
        defaultWidth: 150,
        enableResizing: false,
        render: (entity) => {
          return props.simulationMode ? (
            <Button
              analyticsName="Select"
              size="MEDIUM"
              type="PRIMARY"
              onClick={() => onEditRule(entity)}
              isDisabled={!canSimulate(entity)}
            >
              Simulate
            </Button>
          ) : (
            <div className={s.actionIconsContainer}>
              <EyeOutlined
                className={s.actionIcons}
                onClick={() => {
                  if (!deleting) {
                    onPreviewRule(entity);
                  }
                }}
                disabled={deleting}
                data-cy="rule-preview-button"
              />
              {canWriteRules && (
                <Tooltip
                  title={
                    entity.status === 'DEPLOYING'
                      ? 'Editing will be available once the rule is deployed'
                      : undefined
                  }
                  placement="top"
                >
                  <EditOutlined
                    className={s.actionIcons}
                    onClick={() => {
                      if (canWriteRules && !deleting && entity.status !== 'DEPLOYING') {
                        onEditRule(entity);
                      }
                    }}
                    data-cy="rule-edit-button"
                    style={{
                      cursor:
                        !canWriteRules || deleting || entity.status === 'DEPLOYING'
                          ? 'not-allowed'
                          : 'pointer',
                    }}
                  />
                </Tooltip>
              )}
              {canWriteRules && (
                <RuleActionsMenu
                  ruleInstance={entity}
                  onDuplicate={onDuplicateRule}
                  onDelete={(id) => {
                    if (id && canWriteRules) {
                      setDeleting(true);
                      handleDeleteRuleInstanceMutation.mutate(id);
                    }
                  }}
                  res={getMutationAsyncResource(handleDeleteRuleInstanceMutation)}
                  deleting={deleting}
                  canWriteRules={canWriteRules}
                />
              )}
            </div>
          );
        },
      }),
    ]);
  }, [
    props.simulationMode,
    onEditRule,
    updatedRuleInstances,
    rules,
    canWriteRules,
    handleActivationChange,
    deleting,
    handleDeleteRuleInstanceMutation,
    onDuplicateRule,
    onPreviewRule,
  ]);

  const rulesResult = useRulesResults({
    params,
    ruleMode,
    focusId,
    onViewRule,
  });

  return (
    <>
      <SegmentedControl<RuleRunMode>
        active={ruleMode}
        onChange={setRuleMode}
        items={RULES_SEGMENTED_CONTROL_ITEMS}
      />
      <QueryResultsTable<RuleInstance>
        tableId="my-rules-table"
        innerRef={actionRef}
        columns={columns}
        queryResults={rulesResult}
        pagination={false}
        fitHeight={true}
        externalHeader={true}
        rowKey="id"
        defaultSorting={DEFAULT_SORTING}
        params={params}
        onChangeParams={handleChangeParams}
        onReload={handleReload}
      />
    </>
  );
};

export default MyRule;
