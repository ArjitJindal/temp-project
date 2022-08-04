import React, { useEffect, useRef, useState } from 'react';
import { message } from 'antd';
import {
  ProFormText,
  ProFormTextArea,
  ProFormRadio,
  ProFormInstance,
  DrawerForm,
  ProFormSelect,
} from '@ant-design/pro-form';
import { PlusOutlined } from '@ant-design/icons';
import { RULE_ACTION_OPTIONS } from '../../utils';
import { useApi } from '@/api';
import { RuleImplementation } from '@/apis/models/RuleImplementation';
import { Rule } from '@/apis';
import Button from '@/components/ui/Button';

interface RuleCreationFormProps {
  rule?: Rule;
}

export const RuleCreationForm: React.FC<RuleCreationFormProps> = ({ rule, children }) => {
  const api = useApi();
  const restFormRef = useRef<ProFormInstance>();
  const [ruleImplementations, setRuleImplementations] = useState<RuleImplementation[]>([]);
  useEffect(() => {
    api
      .getRuleImplementations({})
      .then((ruleImplementations) => setRuleImplementations(ruleImplementations));
  }, [api]);
  return (
    <DrawerForm
      title={rule ? 'Update Rule' : 'Create a New Rule'}
      formRef={restFormRef}
      trigger={
        children ? (
          <div>{children}</div>
        ) : (
          <Button analyticsName="Create" type="primary">
            <PlusOutlined />
            Create
          </Button>
        )
      }
      submitter={{
        searchConfig: {
          resetText: 'Cancel',
          submitText: rule ? 'Save' : 'Create',
        },
        render: (props, defaultDoms) => {
          return [
            ...defaultDoms,
            rule && (
              <Button
                analyticsName="Delete"
                key="delete"
                onClick={async () => {
                  await api.deleteRulesRuleId({ ruleId: rule.id });
                  message.success('Rule deleted');
                }}
                danger
              >
                Delete
              </Button>
            ),
          ];
        },
      }}
      autoFocusFirstInput
      onVisibleChange={() => restFormRef.current?.resetFields()}
      onFinish={async (values) => {
        try {
          const newRule = {
            ...(rule ?? {}),
            id: values.id,
            type: values.type,
            name: values.name,
            description: values.description,
            ruleImplementationName: values.ruleImplementationName,
            defaultAction: values.defaultAction,
            defaultParameters: JSON.parse(values.defaultParameters),
            tenantIds: values.tenantIds && values.tenantIds.split(','),
            // TODO: Implement assigning labels
            labels: rule?.labels || [],
          };
          if (rule) {
            await api.putRuleRuleId({
              ruleId: rule.id,
              Rule: newRule,
            });
            message.success('Rule updated');
          } else {
            await api.postRules({
              Rule: newRule,
            });
            message.success('Rule created');
          }
          restFormRef.current?.resetFields();
          return true;
        } catch (e) {
          const error = e instanceof Response ? (await e.json())?.message : e;
          message.error(`Failed to create rule - ${error}`, 10);
          return false;
        }
      }}
    >
      <ProFormText
        width="xl"
        name="id"
        label="Rule ID"
        rules={[
          {
            required: true,
            message: 'Please enter Rule ID',
          },
        ]}
        initialValue={rule?.id}
        disabled={rule !== undefined}
      />
      <ProFormSelect
        width="xl"
        name="type"
        label="Rule Type"
        rules={[
          {
            required: true,
            message: 'Please enter Rule Type',
          },
        ]}
        options={[
          { value: 'TRANSACTION', label: 'TRANSACTION' },
          { value: 'USER', label: 'USER' },
        ]}
        initialValue={rule?.type}
      />
      <ProFormText
        width="xl"
        name="name"
        label="Rule Name"
        rules={[
          {
            required: true,
            message: 'Please enter Rule Name',
          },
        ]}
        initialValue={rule?.name}
      />
      <ProFormTextArea
        label="Rule Description"
        name="description"
        width="xl"
        rules={[
          {
            required: true,
            message: 'Please enter Rule Description',
          },
        ]}
        initialValue={rule?.description}
      />
      <ProFormSelect
        width="xl"
        name="ruleImplementationName"
        showSearch={true}
        label="Rule Implementation Name"
        rules={[
          {
            required: true,
            message: 'Please enter Rule Implementation Name',
          },
        ]}
        options={ruleImplementations.map((ruleImplementation) => ({
          value: ruleImplementation.name,
          label: ruleImplementation.name,
        }))}
        initialValue={rule?.ruleImplementationName}
      />
      <ProFormRadio.Group
        name="defaultAction"
        label="Default Rule Action"
        radioType="button"
        options={RULE_ACTION_OPTIONS}
        rules={[
          {
            required: true,
            message: 'Please enter Default Rule Action',
          },
        ]}
        initialValue={rule?.defaultAction}
      />
      <ProFormTextArea
        width="xl"
        name="defaultParameters"
        label="Default Parameters"
        rules={[
          {
            required: true,
            message: 'Please enter Default Parameters',
          },
        ]}
        placeholder={`{
    "dummy": 100
}`}
        initialValue={JSON.stringify(rule?.defaultParameters)}
      />
      <ProFormText
        width="xl"
        name="tenantIds"
        label="Tenant IDs"
        initialValue={rule?.tenantIds?.join(',')}
      />
    </DrawerForm>
  );
};
