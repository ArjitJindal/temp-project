import { Card, message } from 'antd';
import ProForm, { ProFormSelect, ProFormText, ProFormTextArea } from '@ant-design/pro-form';
import { useRequest } from 'umi';
import type { FC } from 'react';
import { PageContainer } from '@ant-design/pro-layout';
import { fakeSubmitForm } from './service';

const RequestNew: FC<Record<string, any>> = () => {
  const { run } = useRequest(fakeSubmitForm, {
    manual: true,
    onSuccess: () => {
      message.success('Request successfully sent');
    },
  });

  const onFinish = async (values: Record<string, any>) => {
    run(values);
  };

  return (
    <PageContainer content="Can't find a rule to suit your use case? Request a new rule and we will create one for you.">
      <Card bordered={false}>
        <ProForm
          hideRequiredMark
          style={{ margin: 'auto', marginTop: 8, maxWidth: 600 }}
          name="basic"
          layout="vertical"
          initialValues={{ public: '1' }}
          onFinish={onFinish}
        >
          <ProFormText
            width="md"
            label="Title"
            name="title"
            rules={[
              {
                required: true,
                message: 'Please enter a title',
              },
            ]}
            placeholder="Title of your new rule request"
          />
          <ProFormText
            width="xl"
            label="Rule Name"
            name="ruleName"
            rules={[
              {
                required: true,
                message: 'Please enter a rule name',
              },
            ]}
            placeholder="Name of the new rule"
          />

          <ProFormTextArea
            label="Rule Description"
            name="ruleDescription"
            width="xl"
            rules={[
              {
                required: true,
                message: 'Please enter a rule description',
              },
            ]}
            placeholder="Brief description of the new rule"
          />

          <ProFormTextArea
            label="Additional Rule Details"
            name="ruleDetails"
            width="xl"
            rules={[
              {
                required: true,
                message: 'Please enter additional rule details',
              },
            ]}
            placeholder="Details of the new rule you need - thresholds, action type, use case etc"
          />

          <ProFormSelect
            label={<span>Priority </span>}
            tooltip="P1 - very high Priority. P4 lowest Priority"
            width="md"
            name="priority"
            rules={[
              {
                required: true,
                message: 'Please enter Priority',
              },
            ]}
            fieldProps={{
              style: {
                margin: '8px 0',
              },
            }}
            options={[
              {
                value: '1',
                label: 'P1',
              },
              {
                value: '2',
                label: 'P2',
              },
              {
                value: '3',
                label: 'P3',
              },

              {
                value: '4',
                label: 'P4',
              },
            ]}
          />
        </ProForm>
      </Card>
    </PageContainer>
  );
};

export default RequestNew;
