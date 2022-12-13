import { Drawer, message, Popover, Progress, Switch, Tooltip } from 'antd';
import { useCallback, useMemo, useState } from 'react';
import _ from 'lodash';
import { RuleParametersTable } from '../create-rule/components/RuleParametersTable';
import { getRuleInstanceDisplayId } from '../utils';
import { RuleInstanceDetails } from './components/RuleInstanceDetails';
import { dayjs, DEFAULT_DATE_TIME_FORMAT } from '@/utils/dayjs';
import { RuleInstance } from '@/apis';
import { useApi } from '@/api';
import PageWrapper from '@/components/PageWrapper';
import { RuleActionTag } from '@/components/rules/RuleActionTag';
import { useI18n } from '@/locales';
import { useFeature } from '@/components/AppWrapper/Providers/SettingsProvider';
import { TableColumn } from '@/components/ui/Table/types';
import { useRules } from '@/utils/rules';
import { usePaginatedQuery } from '@/utils/queries/hooks';
import { GET_RULE_INSTANCES } from '@/utils/queries/keys';
import QueryResultsTable from '@/components/common/QueryResultsTable';

const MyRule = () => {
  const isPulseEnabled = useFeature('PULSE');
  const api = useApi();
  const [updatedRuleInstances, setUpdatedRuleInstances] = useState<{ [key: string]: RuleInstance }>(
    {},
  );
  const [showDetail, setShowDetail] = useState<boolean>(false);
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
        title: 'Rule Case Creation Type',
        width: 100,
        dataIndex: 'caseCreationType',
      },
      {
        title: 'Rule Case Priority',
        width: 50,
        dataIndex: 'casePriority',
      },
    ];
    return [
      {
        title: 'Rule ID',
        width: 50,
        sorter: (a, b) => parseInt(a.ruleId.split('-')[1]) - parseInt(b.ruleId.split('-')[1]),
        exportData: (row) => row.ruleId,
        render: (_, entity) => {
          return (
            <a
              onClick={() => {
                setCurrentRow(entity);
                setShowDetail(true);
              }}
            >
              {getRuleInstanceDisplayId(entity.ruleId, entity.id)}
            </a>
          );
        },
      },
      {
        title: 'Rule Name',
        width: 150,
        sorter: (a, b) => rules[a.ruleId].name.localeCompare(rules[b.ruleId].name),
        exportData: (row) => rules[row.ruleId].name,
        render: (_, entity) => {
          const ruleInstance = updatedRuleInstances[entity.id as string] || entity;
          return (
            <Popover content={rules[ruleInstance.ruleId]?.description}>
              {ruleInstance.ruleNameAlias || rules[ruleInstance.ruleId]?.name}
            </Popover>
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
          return (
            <Tooltip title={<>{`Hit: ${ruleInstance.hitCount} / Run: ${ruleInstance.runCount}`}</>}>
              <Progress
                percent={
                  ruleInstance.hitCount && ruleInstance.runCount
                    ? (ruleInstance.hitCount / ruleInstance.runCount) * 100
                    : 0
                }
                format={(percent) => `${percent?.toFixed(2)}%`}
                status={ruleInstance.status === 'ACTIVE' ? 'active' : 'normal'}
                style={{ paddingRight: 20 }}
              />
            </Tooltip>
          );
        },
      },
      {
        title: 'Parameter',
        width: 250,
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
        title: 'Action',
        align: 'center',
        width: 30,
        sorter: (a, b) => a.action.localeCompare(b.action),
        render: (_, entity) => {
          const ruleInstance = updatedRuleInstances[entity.id as string] || entity;
          return (
            <span>
              <RuleActionTag ruleAction={ruleInstance.action} />
            </span>
          );
        },
        exportData: (row) => row.action,
      },
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
              checked={ruleInstance.status === 'ACTIVE'}
              onChange={(checked) => handleActivationChange(ruleInstance, checked)}
            />
          );
        },
        exportData: (row) => row.status === 'ACTIVE',
      },
    ];
  }, [handleActivationChange, rules, updatedRuleInstances, isPulseEnabled]);

  const rulesResult = usePaginatedQuery(GET_RULE_INSTANCES(), async () => {
    const ruleInstances = await api.getRuleInstances();
    return {
      items: ruleInstances,
      total: ruleInstances.length,
    };
  });
  const i18n = useI18n();
  // todo: i18n
  return (
    <PageWrapper
      title={i18n('menu.rules.my-rules')}
      description="List of all your rules. Activate/deactivate them in one click"
    >
      <QueryResultsTable<RuleInstance>
        form={{
          labelWrap: true,
        }}
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

      <Drawer
        width={700}
        visible={showDetail}
        onClose={() => {
          setCurrentRow(undefined);
          setShowDetail(false);
        }}
        closable={false}
      >
        {Object.keys(rules).length && currentRow?.id && (
          <RuleInstanceDetails
            rule={rules[currentRow.ruleId]}
            ruleParametersSchema={rules[currentRow.ruleId].parametersSchema}
            ruleInstance={updatedRuleInstances[currentRow.id] || currentRow}
            onRuleInstanceUpdate={handleRuleInstanceUpdate}
            onRuleInstanceDeleted={() => {
              setCurrentRow(undefined);
              setShowDetail(false);
            }}
          />
        )}
      </Drawer>
    </PageWrapper>
  );
};

export default MyRule;
