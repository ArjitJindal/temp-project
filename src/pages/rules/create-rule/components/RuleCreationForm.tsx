import React, { useRef } from 'react';
import { Button, message } from 'antd';
import {
  ProFormText,
  ProFormTextArea,
  ProFormRadio,
  ProFormInstance,
  DrawerForm,
} from '@ant-design/pro-form';
import { PlusOutlined } from '@ant-design/icons';
import { RULE_ACTION_OPTIONS } from '../../utils';
import { useApi } from '@/api';

export const RuleCreationForm: React.FC = () => {
  const api = useApi();
  const restFormRef = useRef<ProFormInstance>();
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
              name: values.name,
              description: values.description,
              ruleImplementationFilename: values.ruleImplementationFilename,
              defaultAction: values.defaultAction,
              defaultParameters: JSON.parse(values.defaultParameters),
              parametersSchema: JSON.parse(values.parametersSchema),
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
      <ProFormText
        width="xl"
        name="ruleImplementationFilename"
        label="Rule Implementation Filename"
        rules={[
          {
            required: true,
          },
        ]}
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
        name="parametersSchema"
        label="Parameter Schema"
        rules={[
          {
            required: true,
          },
        ]}
        placeholder={`{
    "type": "object",
    "properties": {
        "dummy": {
        "type": "number",
        "title": "Dummay Parameter"
        }
    },
    "required": ["dummy"]
}`}
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
