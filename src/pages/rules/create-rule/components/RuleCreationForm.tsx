import React, { useEffect, useRef, useState } from 'react';
import { Button, message } from 'antd';
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

export const RuleCreationForm: React.FC = () => {
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
      title="Create a New Rule"
      formRef={restFormRef}
      trigger={
        <Button type="primary">
          <PlusOutlined />
          Create
        </Button>
      }
      submitter={{
        searchConfig: {
          resetText: 'Cancel',
          submitText: 'Create',
        },
      }}
      autoFocusFirstInput
      onVisibleChange={() => restFormRef.current?.resetFields()}
      onFinish={async (values) => {
        try {
          await api.postRules({
            Rule: {
              id: values.id,
              type: values.type,
              name: values.name,
              description: values.description,
              ruleImplementationName: values.ruleImplementationName,
              defaultAction: values.defaultAction,
              defaultParameters: JSON.parse(values.defaultParameters),
              // TODO: Implement assigning labels
              labels: [],
            },
          });
          message.success('Rule created!');
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
          },
        ]}
      />
      <ProFormSelect
        width="xl"
        name="type"
        label="Rule Type"
        rules={[
          {
            required: true,
          },
        ]}
        options={[
          { value: 'TRANSACTION', label: 'TRANSACTION' },
          { value: 'USER', label: 'USER' },
        ]}
      />
      <ProFormText
        width="xl"
        name="name"
        label="Rule Name"
        rules={[
          {
            required: true,
          },
        ]}
      />
      <ProFormTextArea
        label="Rule Description"
        name="description"
        width="xl"
        rules={[
          {
            required: true,
          },
        ]}
      />
      <ProFormSelect
        width="xl"
        name="ruleImplementationName"
        label="Rule Implementation Name"
        rules={[
          {
            required: true,
          },
        ]}
        options={ruleImplementations.map((ruleImplementation) => ({
          value: ruleImplementation.name,
          label: ruleImplementation.name,
        }))}
      />
      <ProFormRadio.Group
        name="defaultAction"
        label="Default Rule Action"
        radioType="button"
        options={RULE_ACTION_OPTIONS}
        rules={[
          {
            required: true,
          },
        ]}
      />
      <ProFormTextArea
        width="xl"
        name="defaultParameters"
        label="Default Parameters"
        rules={[
          {
            required: true,
          },
        ]}
        placeholder={`{
    "dummy": 100
}`}
      />
    </DrawerForm>
  );
};
