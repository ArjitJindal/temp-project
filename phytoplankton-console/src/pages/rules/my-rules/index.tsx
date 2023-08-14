import { Switch, Tooltip } from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import _ from 'lodash';
import { DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { useMutation } from '@tanstack/react-query';
import { getRuleInstanceDisplayId, useUpdateRuleInstance } from '../utils';
import s from './style.module.less';
import { RuleInstance } from '@/apis';
import { useApi } from '@/api';
import {
  CommonParams,
  SortingParamsItem,
  TableColumn,
  TableRefType,
} from '@/components/library/Table/types';
import { useRules } from '@/utils/rules';
import { getMutationAsyncResource, usePaginatedQuery } from '@/utils/queries/hooks';
import { GET_RULE_INSTANCES } from '@/utils/queries/keys';
import QueryResultsTable from '@/components/common/QueryResultsTable';
import { useApiTime, usePageViewTracker } from '@/utils/tracker';
import RuleConfigurationDrawer, {
  RuleConfigurationSimulationDrawer,
} from '@/pages/rules/RuleConfigurationDrawer';
import { getErrorMessage } from '@/utils/lang';
import { useHasPermissions } from '@/utils/user-utils';
import Confirm from '@/components/utils/Confirm';
import Button from '@/components/library/Button';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { BOOLEAN, DATE } from '@/components/library/Table/standardDataTypes';
import { message } from '@/components/library/Message';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import { useScrollToFocus } from '@/utils/hooks';
import { parseQueryString } from '@/utils/routing';
import { RuleHitInsightsTag } from '@/components/ui/RuleHitInsightsTag';

const DEFAULT_SORTING: SortingParamsItem = ['ruleId', 'ascend'];

const MyRule = (props: { simulationMode?: boolean }) => {
  usePageViewTracker('My Rule Page');
  useScrollToFocus();
  const [ruleReadOnly, setRuleReadOnly] = useState<boolean>(false);
  const api = useApi();
  const canWriteRules = useHasPermissions(['rules:my-rules:write']);
  const [updatedRuleInstances, setUpdatedRuleInstances] = useState<{ [key: string]: RuleInstance }>(
    {},
  );
  const actionRef = useRef<TableRefType>(null);
  const reloadTable = useCallback(() => {
    actionRef.current?.reload();
  }, []);

  const [showDetail, setShowDetail] = useState<boolean>(false);

  const onViewRule = useCallback((entity) => {
    setCurrentRow(entity);
    setShowDetail(true);
    setRuleReadOnly(true);
  }, []);

  const onEditRule = useCallback((entity) => {
    setCurrentRow(entity);
    setShowDetail(true);
    setRuleReadOnly(false);
  }, []);

  useEffect(() => {
    if (!showDetail) {
      setRuleReadOnly(false);
    }
  }, [showDetail]);

  const [params, setParams] = useState<CommonParams>({
    ...DEFAULT_PARAMS_STATE,
    sort: [DEFAULT_SORTING],
    pagination: false,
  });

  const focusId = useMemo(() => parseQueryString(location.search).focus, []);

  const [deleting, setDeleting] = useState(false);
  const [currentRow, setCurrentRow] = useState<RuleInstance>();
  const { rules } = useRules();
  const handleRuleInstanceUpdate = useCallback(async (newRuleInstance: RuleInstance) => {
    setUpdatedRuleInstances((prev) => ({
      ...prev,
      [newRuleInstance.id as string]: newRuleInstance,
    }));
  }, []);
  const updateRuleInstanceMutation = useUpdateRuleInstance(handleRuleInstanceUpdate);

  const handleDeleteRuleInstanceMutation = useMutation<void, Error, string>(
    async (ruleInstanceId) => await api.deleteRuleInstancesRuleInstanceId({ ruleInstanceId }),
    {
      onSuccess: () => {
        message.success('Rule deleted');
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

  const columns: TableColumn<RuleInstance>[] = useMemo((): TableColumn<RuleInstance>[] => {
    const helper = new ColumnHelper<RuleInstance>();

    return helper.list([
      helper.simple<'ruleId'>({
        title: 'ID',
        key: 'ruleId',
        sorting: true,
        type: {
          render: (ruleId, { item: entity }) => {
            return (
              <a
                onClick={() => {
                  if (props.simulationMode) {
                    onEditRule(entity);
                  } else {
                    onViewRule(entity);
                  }
                }}
                id={entity.id ?? ''}
              >
                {getRuleInstanceDisplayId(ruleId, entity.id)}
              </a>
            );
          },
        },
      }),
      helper.simple<'ruleNameAlias'>({
        title: 'Name',
        key: 'ruleNameAlias',
        type: {
          render: (_, { item: entity }) => {
            const ruleInstance = updatedRuleInstances[entity.id as string] || entity;
            return (
              <span style={{ fontSize: '14px' }}>
                {ruleInstance.ruleNameAlias || rules[ruleInstance.ruleId]?.name}
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
            return `${(row.hitCount / row.runCount) * 100}%`;
          }
          return '0%';
        },
        sorting: true,
        type: {
          render: (_value, { item: ruleInstance }) => {
            const percent =
              ruleInstance.hitCount && ruleInstance.runCount
                ? (ruleInstance.hitCount / ruleInstance.runCount) * 100
                : 0;
            return (
              <>
                <Tooltip
                  title={<>{`Hit: ${ruleInstance.hitCount} / Run: ${ruleInstance.runCount}`}</>}
                >
                  {percent?.toFixed(2)}%
                </Tooltip>

                <RuleHitInsightsTag percentage={percent} runs={ruleInstance.runCount} />
              </>
            );
          },
        },
      }),
      helper.simple<'casePriority'>({
        key: 'casePriority',
        title: 'Rule severity',
      }),
      helper.simple<'createdAt'>({
        key: 'createdAt',
        title: 'Created at',
        type: DATE,
        sorting: 'desc',
      }),
      helper.derived<boolean>({
        id: 'status',
        title: 'Status',
        value: (row) => row.status === 'ACTIVE',
        defaultWidth: 70,
        type: {
          ...BOOLEAN,
          render: (_, { item: entity }) => {
            const ruleInstance = updatedRuleInstances[entity.id as string] || entity;
            return (
              <Switch
                disabled={!canWriteRules}
                checked={ruleInstance.status === 'ACTIVE'}
                onChange={(checked) => handleActivationChange(ruleInstance, checked)}
              />
            );
          },
        },
      }),
      helper.display({
        id: 'actions',
        title: 'Action',
        defaultSticky: 'RIGHT',
        defaultWidth: 250,
        enableResizing: false,
        render: (entity) => {
          return props.simulationMode ? (
            <Button
              analyticsName="Select"
              size="MEDIUM"
              type="PRIMARY"
              onClick={() => onEditRule(entity)}
            >
              New simulation
            </Button>
          ) : (
            <div className={s.actionIconsContainer}>
              <Button
                onClick={() => {
                  if (canWriteRules && !deleting) {
                    onEditRule(entity);
                  }
                }}
                icon={<EditOutlined />}
                size="MEDIUM"
                type="SECONDARY"
                isDisabled={!canWriteRules}
                isLoading={deleting}
              >
                Edit
              </Button>
              <Confirm
                title={`Are you sure you want to delete this ${entity.ruleId} ${entity.id} rule?`}
                text="Please confirm that you want to delete this rule. This action cannot be undone."
                onConfirm={() => {
                  if (canWriteRules && entity.id) {
                    setDeleting(true);
                    handleDeleteRuleInstanceMutation.mutate(entity.id);
                  }
                }}
                res={getMutationAsyncResource(handleDeleteRuleInstanceMutation)}
              >
                {({ onClick }) => (
                  <Button
                    onClick={onClick}
                    icon={<DeleteOutlined />}
                    size="SMALL"
                    type="TETRIARY"
                    isDisabled={!canWriteRules}
                    isLoading={deleting}
                  >
                    Delete
                  </Button>
                )}
              </Confirm>
            </div>
          );
        },
      }),
    ]);
  }, [
    onViewRule,
    updatedRuleInstances,
    rules,
    canWriteRules,
    handleActivationChange,
    props.simulationMode,
    deleting,
    handleDeleteRuleInstanceMutation,
    onEditRule,
  ]);
  const measure = useApiTime();
  const rulesResult = usePaginatedQuery(GET_RULE_INSTANCES(params), async () => {
    const ruleInstances = await measure(() => api.getRuleInstances(), 'Get Rule Instances');
    if (focusId) {
      const ruleInstance = ruleInstances.find((r) => r.id === focusId);
      if (ruleInstance) {
        onViewRule(ruleInstance);
      }
    }

    const result = [...ruleInstances];
    if (params.sort.length > 0) {
      const [key, order] = params.sort[0];
      result.sort((a, b) => {
        let result = 0;
        if (key === 'ruleId') {
          result = parseInt(a.ruleId.split('-')[1]) - parseInt(b.ruleId.split('-')[1]);
        } else if (key === 'hitCount') {
          result =
            (a.hitCount && a.runCount ? a.hitCount / a.runCount : 0) -
            (b.hitCount && b.runCount ? b.hitCount / b.runCount : 0);
        } else if (key === 'createdAt') {
          result =
            a.createdAt !== undefined && b.createdAt !== undefined ? a.createdAt - b.createdAt : -1;
        }
        result *= order === 'descend' ? -1 : 1;
        return result;
      });
    }

    return {
      items: result,
      total: result.length,
    };
  });

  const rule = currentRow && rules[currentRow?.ruleId];
  const ruleInstance: RuleInstance | undefined =
    currentRow && currentRow.id ? updatedRuleInstances[currentRow.id] || currentRow : undefined;

  return (
    <>
      <QueryResultsTable<RuleInstance>
        tableId="my-rules-table"
        innerRef={actionRef}
        columns={columns}
        queryResults={rulesResult}
        pagination={false}
        fitHeight={true}
        rowKey="id"
        defaultSorting={DEFAULT_SORTING}
        params={params}
        onChangeParams={setParams}
      />
      {props.simulationMode ? (
        <RuleConfigurationSimulationDrawer
          rule={rule}
          ruleInstance={ruleInstance!}
          isVisible={showDetail}
          onChangeVisibility={setShowDetail}
          onRuleInstanceUpdated={(ruleInstance) => {
            handleRuleInstanceUpdate(ruleInstance);
            setShowDetail(false);
          }}
        />
      ) : (
        <RuleConfigurationDrawer
          rule={rule}
          readOnly={!canWriteRules || ruleReadOnly}
          ruleInstance={ruleInstance}
          isVisible={showDetail}
          onChangeVisibility={setShowDetail}
          onRuleInstanceUpdated={(ruleInstance) => {
            handleRuleInstanceUpdate(ruleInstance);
            setShowDetail(false);
          }}
          isClickAwayEnabled={ruleReadOnly}
          onChangeToEditMode={() => {
            setRuleReadOnly(false);
          }}
          type={'EDIT'}
        />
      )}
    </>
  );
};

export default MyRule;
