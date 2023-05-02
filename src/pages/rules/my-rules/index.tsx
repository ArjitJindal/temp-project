import { Switch, Tooltip } from 'antd';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import _ from 'lodash';
import { DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { useMutation } from '@tanstack/react-query';
import { getRuleInstanceDisplayId } from '../utils';
import s from './style.module.less';
import { RuleInstance } from '@/apis';
import { useApi } from '@/api';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
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
import RuleConfigurationDrawer, { FormValues } from '@/pages/rules/RuleConfigurationDrawer';
import { getErrorMessage } from '@/utils/lang';
import { removeEmpty } from '@/utils/json';
import { useHasPermissions } from '@/utils/user-utils';
import Confirm from '@/components/utils/Confirm';
import Button from '@/components/library/Button';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { BOOLEAN, DATE } from '@/components/library/Table/standardDataTypes';
import { message } from '@/components/library/Message';
import { PageWrapperTableContainer } from '@/components/PageWrapper';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import { useScrollToFocus } from '@/utils/hooks';
import { parseQueryString } from '@/utils/routing';

const DEFAULT_SORTING: SortingParamsItem = ['ruleId', 'ascend'];

const MyRule = () => {
  usePageViewTracker('My Rule Page');
  useScrollToFocus();
  const [ruleReadOnly, setRuleReadOnly] = useState<boolean>(false);
  const isPulseEnabled = useFeatureEnabled('PULSE');
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
  });

  const focusId = useMemo(() => parseQueryString(location.search).focus, []);

  const [deleting, setDeleting] = useState(false);
  const [currentRow, setCurrentRow] = useState<RuleInstance>();
  const { rules } = useRules();
  const handleRuleInstanceUpdate = useCallback(
    async (newRuleInstance: RuleInstance) => {
      const ruleInstanceId = newRuleInstance.id as string;
      setUpdatedRuleInstances((prev) => ({
        ...prev,
        [newRuleInstance.id as string]: newRuleInstance,
      }));
      try {
        await api.putRuleInstancesRuleInstanceId({ ruleInstanceId, RuleInstance: newRuleInstance });
      } catch (e) {
        setUpdatedRuleInstances((prev) => _.omit(prev, [ruleInstanceId]));
        throw e;
      }
    },
    [api],
  );

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
      const hideMessage = message.loading(
        `${activated ? 'Activating' : 'Deactivating'} rule ${ruleInstance.ruleId}...`,
      );
      try {
        await handleRuleInstanceUpdate({
          ...ruleInstance,
          status: activated ? 'ACTIVE' : 'INACTIVE',
        });
        message.success(`${activated ? 'Activated' : 'Deactivated'} rule ${ruleInstance.ruleId}`);
      } catch (e) {
        message.fatal(
          `Failed to ${activated ? 'activate' : 'deactivate'} rule ${ruleInstance.ruleId}`,
          e,
        );
      } finally {
        hideMessage();
      }
    },
    [handleRuleInstanceUpdate],
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
                  onViewRule(entity);
                }}
                id={entity.id ?? ''}
              >
                {ruleId ? getRuleInstanceDisplayId(ruleId, entity.id) : entity.id}
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
              <Tooltip
                title={<>{`Hit: ${ruleInstance.hitCount} / Run: ${ruleInstance.runCount}`}</>}
              >
                {percent?.toFixed(2)}%
              </Tooltip>
            );
          },
        },
      }),
      helper.simple<'casePriority'>({
        key: 'casePriority',
        title: 'Case priority',
      }),
      helper.simple<'createdAt'>({
        key: 'createdAt',
        title: 'Created At',
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
        defaultWidth: 220,
        render: (entity) => {
          return (
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
    rules,
    updatedRuleInstances,
    canWriteRules,
    deleting,
    handleActivationChange,
    handleDeleteRuleInstanceMutation,
    onViewRule,
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

  const rule = (currentRow && rules[currentRow?.ruleId]) ?? null;
  const ruleInstance: RuleInstance | null =
    currentRow && currentRow.id ? updatedRuleInstances[currentRow.id] || currentRow : null;

  const saveInstanceMutation = useMutation<unknown, unknown, FormValues>(
    async (formValues) => {
      if (rule == null) {
        throw new Error(`Rule is not defined`);
      }
      if (ruleInstance == null || ruleInstance?.id == null) {
        throw new Error(`Rule instance is not defined`);
      }
      const { basicDetailsStep, standardFiltersStep, ruleParametersStep } = formValues;
      const { ruleAction, ruleParameters, riskLevelParameters, riskLevelActions } =
        ruleParametersStep;

      const newRuleInstance: RuleInstance = {
        ...ruleInstance,
        ruleId: rule.id as string,
        ruleNameAlias: basicDetailsStep.ruleName,
        ruleDescriptionAlias: basicDetailsStep.ruleDescription,
        filters: standardFiltersStep,
        casePriority: basicDetailsStep.casePriority,
        nature: basicDetailsStep.ruleNature,
        labels: basicDetailsStep.ruleLabels,
        ...(isPulseEnabled
          ? {
              riskLevelParameters: riskLevelParameters
                ? {
                    VERY_HIGH: removeEmpty(riskLevelParameters['VERY_HIGH']),
                    HIGH: removeEmpty(riskLevelParameters['HIGH']),
                    MEDIUM: removeEmpty(riskLevelParameters['MEDIUM']),
                    LOW: removeEmpty(riskLevelParameters['LOW']),
                    VERY_LOW: removeEmpty(riskLevelParameters['VERY_LOW']),
                  }
                : {
                    VERY_HIGH: removeEmpty(ruleParameters),
                    HIGH: removeEmpty(ruleParameters),
                    MEDIUM: removeEmpty(ruleParameters),
                    LOW: removeEmpty(ruleParameters),
                    VERY_LOW: removeEmpty(ruleParameters),
                  },
              riskLevelActions: riskLevelActions
                ? {
                    VERY_HIGH: riskLevelActions['VERY_HIGH'],
                    HIGH: riskLevelActions['HIGH'],
                    MEDIUM: riskLevelActions['MEDIUM'],
                    LOW: riskLevelActions['LOW'],
                    VERY_LOW: riskLevelActions['VERY_LOW'],
                  }
                : ruleAction != null
                ? {
                    VERY_HIGH: ruleAction,
                    HIGH: ruleAction,
                    MEDIUM: ruleAction,
                    LOW: ruleAction,
                    VERY_LOW: ruleAction,
                  }
                : undefined,
            }
          : {
              action: ruleAction ?? ruleInstance.action,
              parameters: removeEmpty(ruleParameters),
            }),
      };
      await handleRuleInstanceUpdate(newRuleInstance);
    },
    {
      onSuccess: () => {
        setShowDetail(false);
        message.success(`Rule saved!`);
      },
      onError: (err) => {
        message.fatal(`Unable to save rule! ${getErrorMessage(err)}`, err);
      },
    },
  );

  return (
    <PageWrapperTableContainer>
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
      <RuleConfigurationDrawer
        rule={rule}
        readOnly={!canWriteRules || ruleReadOnly}
        formInitialValues={
          ruleInstance
            ? {
                basicDetailsStep: {
                  ruleName: ruleInstance.ruleNameAlias,
                  ruleDescription: ruleInstance.ruleDescriptionAlias,
                  ruleNature: ruleInstance.nature,
                  casePriority: ruleInstance.casePriority,
                  ruleLabels: ruleInstance.labels,
                  ruleInstanceId: ruleInstance.id,
                },
                standardFiltersStep: ruleInstance.filters,
                ruleParametersStep: isPulseEnabled
                  ? {
                      riskLevelParameters:
                        ruleInstance.riskLevelParameters ??
                        (ruleInstance.parameters && {
                          VERY_HIGH: ruleInstance.parameters,
                          HIGH: ruleInstance.parameters,
                          MEDIUM: ruleInstance.parameters,
                          LOW: ruleInstance.parameters,
                          VERY_LOW: ruleInstance.parameters,
                        }),
                      riskLevelActions:
                        ruleInstance.riskLevelActions ??
                        (ruleInstance.action && {
                          VERY_HIGH: ruleInstance.action,
                          HIGH: ruleInstance.action,
                          MEDIUM: ruleInstance.action,
                          LOW: ruleInstance.action,
                          VERY_LOW: ruleInstance.action,
                        }),
                    }
                  : {
                      ruleParameters: ruleInstance.parameters,
                      ruleAction: ruleInstance.action,
                    },
              }
            : undefined
        }
        isSubmitting={saveInstanceMutation.isLoading}
        isVisible={showDetail}
        onChangeVisibility={setShowDetail}
        onSubmit={(formValues) => {
          saveInstanceMutation.mutate(formValues);
        }}
        isClickAwayEnabled={ruleReadOnly}
        changeToEditMode={() => {
          setRuleReadOnly(false);
        }}
        type={'EDIT'}
      />
    </PageWrapperTableContainer>
  );
};

export default MyRule;
