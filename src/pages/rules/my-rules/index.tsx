import { message, Switch, Tooltip } from 'antd';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import _ from 'lodash';
import { DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { useMutation } from '@tanstack/react-query';
import cn from 'clsx';
import { RuleParametersTable } from '../RulesTable/RuleParametersTable';
import { getRuleInstanceDisplayId } from '../utils';
import s from './style.module.less';
import { dayjs, DEFAULT_DATE_TIME_FORMAT } from '@/utils/dayjs';
import { RuleInstance } from '@/apis';
import { useApi } from '@/api';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import { TableColumn } from '@/components/ui/Table/types';
import { useRules } from '@/utils/rules';
import { getMutationAsyncResource, usePaginatedQuery } from '@/utils/queries/hooks';
import { GET_RULE_INSTANCES } from '@/utils/queries/keys';
import QueryResultsTable from '@/components/common/QueryResultsTable';
import { TableActionType } from '@/components/ui/Table';
import { useApiTime, usePageViewTracker } from '@/utils/tracker';
import RuleConfigurationDrawer, { FormValues } from '@/pages/rules/RuleConfigurationDrawer';
import { getErrorMessage } from '@/utils/lang';
import { removeEmpty } from '@/utils/json';
import { useHasPermissions } from '@/utils/user-utils';
import Confirm from '@/components/utils/Confirm';

const MyRule = () => {
  usePageViewTracker('My Rule Page');
  const isPulseEnabled = useFeatureEnabled('PULSE');
  const api = useApi();
  const canWriteRules = useHasPermissions(['rules:my-rules:write']);
  const [updatedRuleInstances, setUpdatedRuleInstances] = useState<{ [key: string]: RuleInstance }>(
    {},
  );
  const actionRef = useRef<TableActionType>(null);
  const reloadTable = useCallback(() => {
    actionRef.current?.reload();
  }, []);

  const [showDetail, setShowDetail] = useState<boolean>(false);
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
        message.error(`Failed to delete rule: ${getErrorMessage(e)}`);
        setDeleting(false);
      },
    },
  );

  const handleActivationChange = useCallback(
    async (ruleInstance: RuleInstance, activated: boolean) => {
      const hideMessage = message.loading(
        `${activated ? 'Activating' : 'Deactivating'} rule ${ruleInstance.ruleId}...`,
        0,
      );
      try {
        await handleRuleInstanceUpdate({
          ...ruleInstance,
          status: activated ? 'ACTIVE' : 'INACTIVE',
        });
        message.success(`${activated ? 'Activated' : 'Deactivated'} rule ${ruleInstance.ruleId}`);
      } catch (e) {
        message.error(
          `Failed to ${activated ? 'activate' : 'deactivate'} rule ${ruleInstance.ruleId}`,
        );
      } finally {
        hideMessage();
      }
    },
    [handleRuleInstanceUpdate],
  );
  const columns: TableColumn<RuleInstance>[] = useMemo(() => {
    const caseCreationHeaders: TableColumn<RuleInstance>[] = [
      {
        title: 'Rule Priority',
        width: 50,
        dataIndex: 'casePriority',
      },
    ];
    return [
      {
        title: 'Rule ID',
        width: 200,
        sorter: (a, b) => parseInt(a.ruleId.split('-')[1]) - parseInt(b.ruleId.split('-')[1]),
        exportData: (row) => row.ruleId,
        render: (_, entity) => {
          const ruleInstance = updatedRuleInstances[entity.id as string] || entity;
          return (
            <>
              <a
                onClick={() => {
                  setCurrentRow(entity);
                  setShowDetail(true);
                }}
              >
                {getRuleInstanceDisplayId(entity.ruleId, entity.id)}
              </a>
              <br />
              <span style={{ fontSize: '12px' }}>
                {ruleInstance.ruleNameAlias || rules[ruleInstance.ruleId]?.name}
              </span>
            </>
          );
        },
      },
      {
        title: 'Rule Description',
        width: 300,
        sorter: (a, b) => rules[a.ruleId].name.localeCompare(rules[b.ruleId].name),
        exportData: (row) => rules[row.ruleId].name,
        render: (_, entity) => {
          const ruleInstance = updatedRuleInstances[entity.id as string] || entity;
          return (
            <> {ruleInstance.ruleDescriptionAlias || rules[ruleInstance.ruleId]?.description}</>
          );
        },
      },
      {
        title: 'Rule Hit Rate',
        width: 100,
        sorter: (a, b) =>
          (a.hitCount && a.runCount ? a.hitCount / a.runCount : 0) -
          (b.hitCount && b.runCount ? b.hitCount / b.runCount : 0),
        exportData: (row) => {
          if (row.hitCount && row.runCount) {
            return `${(row.hitCount / row.runCount) * 100}%`;
          }
          return '0%';
        },
        render: (_, ruleInstance) => {
          const percent =
            ruleInstance.hitCount && ruleInstance.runCount
              ? (ruleInstance.hitCount / ruleInstance.runCount) * 100
              : 0;
          return (
            <Tooltip title={<>{`Hit: ${ruleInstance.hitCount} / Run: ${ruleInstance.runCount}`}</>}>
              {percent?.toFixed(2)}%
            </Tooltip>
          );
        },
      },
      {
        title: 'Parameter',
        width: 300,
        render: (_, ruleInstance) => {
          return isPulseEnabled ? (
            <a
              onClick={() => {
                setCurrentRow(ruleInstance);
                setShowDetail(true);
              }}
            >
              Show risk level parameters
            </a>
          ) : (
            <RuleParametersTable
              parameters={ruleInstance.parameters}
              schema={rules[ruleInstance.ruleId]?.parametersSchema}
            />
          );
        },
        exportData: (row) => {
          return JSON.stringify(row.parameters);
        },
      },
      ...caseCreationHeaders,
      {
        title: 'Created At',
        width: 120,
        sorter: (a, b) =>
          a.createdAt !== undefined && b.createdAt !== undefined ? a.createdAt - b.createdAt : -1,
        defaultSortOrder: 'descend',
        dataIndex: 'createdAt',
        valueType: 'dateTime',
        exportData: (row) => dayjs(row.createdAt).format(DEFAULT_DATE_TIME_FORMAT),
      },
      {
        title: 'Activated',
        width: 30,
        align: 'center',
        dataIndex: 'status',
        key: 'status',
        render: (_, entity) => {
          const ruleInstance = updatedRuleInstances[entity.id as string] || entity;
          return (
            <Switch
              disabled={!canWriteRules}
              checked={ruleInstance.status === 'ACTIVE'}
              onChange={(checked) => handleActivationChange(ruleInstance, checked)}
            />
          );
        },
        exportData: (row) => row.status === 'ACTIVE',
      },
      {
        title: 'Actions',
        width: 30,
        align: 'center',
        render: (_, entity) => {
          return (
            <>
              <a
                className={cn(s.actionIcons, { [s.disabledAction]: !canWriteRules })}
                onClick={() => {
                  if (canWriteRules && !deleting) {
                    setCurrentRow(entity);
                    setShowDetail(true);
                  }
                }}
              >
                <EditOutlined />
              </a>
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
                  <a
                    className={cn(s.actionIcons, { [s.disabledAction]: !canWriteRules })}
                    onClick={onClick}
                  >
                    <DeleteOutlined />
                  </a>
                )}
              </Confirm>
            </>
          );
        },
      },
    ];
  }, [
    rules,
    updatedRuleInstances,
    canWriteRules,
    deleting,
    isPulseEnabled,
    handleActivationChange,
    handleDeleteRuleInstanceMutation,
  ]);
  const measure = useApiTime();
  const rulesResult = usePaginatedQuery(GET_RULE_INSTANCES(), async () => {
    const ruleInstances = await measure(() => api.getRuleInstances(), 'Get Rule Instances');
    return {
      items: ruleInstances,
      total: ruleInstances.length,
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
        console.error(err);
        message.error(`Unable to save rule! ${getErrorMessage(err)}`);
      },
    },
  );

  return (
    <>
      <QueryResultsTable<RuleInstance>
        form={{
          labelWrap: true,
        }}
        actionRef={actionRef}
        columns={columns}
        queryResults={rulesResult}
        pagination={false}
        search={false}
        scroll={{ x: 1000 }}
        rowKey="id"
        columnsState={{
          persistenceType: 'localStorage',
          persistenceKey: 'my-rules-table',
        }}
      />
      <RuleConfigurationDrawer
        rule={rule}
        readOnly={!canWriteRules}
        formInitialValues={
          ruleInstance
            ? {
                basicDetailsStep: {
                  ruleName: ruleInstance.ruleNameAlias,
                  ruleDescription: ruleInstance.ruleDescriptionAlias,
                  ruleNature: ruleInstance.nature,
                  casePriority: ruleInstance.casePriority,
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
      />
    </>
  );
};

export default MyRule;
