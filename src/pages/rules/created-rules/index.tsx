import { Drawer, message, Popover, Progress, Switch, Tag, Tooltip } from 'antd';
import type { ProColumns } from '@ant-design/pro-table';
import ProTable from '@ant-design/pro-table';
import { useCallback, useMemo, useState } from 'react';
import _ from 'lodash';
import { getRuleActionColor } from '../utils';
import { RuleInstanceDetails } from './components/RuleInstanceDetails';
import { Rule, RuleInstance } from '@/apis';
import { useApi } from '@/api';
import { RuleImplementation } from '@/apis/models/RuleImplementation';
import PageWrapper from '@/components/PageWrapper';

export default () => {
  const api = useApi();
  const [updatedRuleInstances, setUpdatedRuleInstances] = useState<{ [key: string]: RuleInstance }>(
    {},
  );
  const [showDetail, setShowDetail] = useState<boolean>(false);
  const [currentRow, setCurrentRow] = useState<RuleInstance>();
  const [rules, setRules] = useState<{ [key: string]: Rule }>({});
  const [ruleImplementations, setRuleImplementations] = useState<{
    [key: string]: RuleImplementation;
  }>({});
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
  const columns: ProColumns<RuleInstance>[] = useMemo(
    () => [
      {
        title: 'Rule ID',
        width: 50,
        render: (_, entity) => {
          return (
            <a
              onClick={() => {
                setCurrentRow(entity);
                setShowDetail(true);
              }}
            >
              {entity.ruleId}
            </a>
          );
        },
      },
      {
        title: 'Rule Name',
        width: 150,
        render: (_, ruleInstance) => {
          return (
            <Popover content={rules[ruleInstance.ruleId].description}>
              {rules[ruleInstance.ruleId].name}
            </Popover>
          );
        },
      },
      {
        title: 'Rule Hit Rate',
        width: 100,
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
              />
            </Tooltip>
          );
        },
      },
      {
        title: 'Action',
        align: 'center',
        width: 30,
        render: (_, entity) => {
          const ruleInstance = updatedRuleInstances[entity.id as string] || entity;
          return (
            <span>
              <Tag color={getRuleActionColor(ruleInstance.action)}>{ruleInstance.action}</Tag>
            </span>
          );
        },
      },
      {
        title: 'Created At',
        width: 120,
        dataIndex: 'createdAt',
        valueType: 'dateTime',
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
      },
    ],
    [handleActivationChange, rules, updatedRuleInstances],
  );
  return (
    <PageWrapper
      pageContainerProps={{
        content: 'List of all created rules. Activate/deactivate them in one click',
      }}
    >
      <ProTable<RuleInstance>
        form={{
          labelWrap: true,
        }}
        headerTitle="Rules"
        columns={columns}
        request={async () => {
          const [rules, ruleInstances, ruleImplementations] = await Promise.all([
            api.getRules({}),
            api.getRuleInstances({}),
            api.getRuleImplementations({}),
          ]);
          setRules(_.keyBy(rules, 'id'));
          setRuleImplementations(_.keyBy(ruleImplementations, 'name'));
          return {
            data: ruleInstances,
            success: true,
            total: ruleInstances.length,
          };
        }}
        search={false}
        rowKey="id"
      />

      <Drawer
        width={500}
        visible={showDetail}
        onClose={() => {
          setCurrentRow(undefined);
          setShowDetail(false);
        }}
        closable={false}
      >
        {currentRow?.id && (
          <RuleInstanceDetails
            rule={rules[currentRow.ruleId]}
            ruleParametersSchema={
              ruleImplementations[rules[currentRow.ruleId]?.ruleImplementationName].parametersSchema
            }
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
