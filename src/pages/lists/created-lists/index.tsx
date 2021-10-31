import React, { useRef, useState } from 'react';
import type { FormInstance } from 'antd';
import { Card, Divider, Alert } from 'antd';
import { PageContainer } from '@ant-design/pro-layout';
import ProForm, { ProFormDigit, ProFormSelect, ProFormText, StepsForm } from '@ant-design/pro-form';
import type { StepDataType } from './data';
import styles from './style.less';

const StepForm: React.FC<Record<string, any>> = () => {
  const [stepData, setStepData] = useState<StepDataType>({
    payAccount: 'ant-design@alipay.com',
    receiverAccount: 'test@example.com',
    receiverName: 'Alex',
    amount: '500',
    receiverMode: 'alipay',
  });
  const [current, setCurrent] = useState(0);
  const formRef = useRef<FormInstance>();

  return (
    <PageContainer content="Custom lists you have created">
      <Card bordered={false}>
        <StepsForm
          current={current}
          onCurrentChange={setCurrent}
          submitter={{
            render: (props, dom) => {
              if (props.step === 2) {
                return null;
              }
              return dom;
            },
          }}
        >
          <StepsForm.StepForm<StepDataType>
            formRef={formRef}
            title="填写转账信息"
            initialValues={stepData}
            onFinish={async (values) => {
              setStepData(values);
              return true;
            }}
          >
            <ProFormSelect
              label="付款账户"
              width="md"
              name="payAccount"
              rules={[{ required: true, message: '请选择付款账户' }]}
              valueEnum={{
                'ant-design@alipay.com': 'ant-design@alipay.com',
              }}
            />

            <ProForm.Group title="收款账户" size={8}>
              <ProFormSelect
                name="receiverMode"
                rules={[{ required: true, message: '请选择付款账户' }]}
                valueEnum={{
                  alipay: '支付宝',
                  bank: '银行账户',
                }}
              />
              <ProFormText
                name="receiverAccount"
                rules={[
                  { required: true, message: '请输入收款人账户' },
                  { type: 'email', message: '账户名应为邮箱格式' },
                ]}
                placeholder="test@example.com"
              />
            </ProForm.Group>
            <ProFormText
              label="收款人姓名"
              width="md"
              name="receiverName"
              rules={[{ required: true, message: '请输入收款人姓名' }]}
              placeholder="请输入收款人姓名"
            />
            <ProFormDigit
              label="转账金额"
              name="amount"
              width="md"
              rules={[
                { required: true, message: '请输入转账金额' },
                {
                  pattern: /^(\d+)((?:\.\d+)?)$/,
                  message: '请输入合法金额数字',
                },
              ]}
              placeholder="请输入金额"
              fieldProps={{
                prefix: '￥',
              }}
            />
          </StepsForm.StepForm>

          <StepsForm.StepForm title="确认转账信息">
            <div className={styles.result}>
              <Alert
                closable
                showIcon
                message="确认转账后，资金将直接打入对方账户，无法退回。"
                style={{ marginBottom: 24 }}
              />
              <Divider style={{ margin: '24px 0' }} />
              <ProFormText.Password
                label="支付密码"
                width="md"
                name="password"
                required={false}
                rules={[{ required: true, message: '需要支付密码才能进行支付' }]}
              />
            </div>
          </StepsForm.StepForm>
        </StepsForm>
        <Divider style={{ margin: '40px 0 24px' }} />
        <div className={styles.desc}>
          <h3>说明</h3>
          <h4>转账到支付宝账户</h4>
          <p>
            如果需要，这里可以放一些关于产品的常见问题说明。如果需要，这里可以放一些关于产品的常见问题说明。如果需要，这里可以放一些关于产品的常见问题说明。
          </p>
          <h4>转账到银行卡</h4>
          <p>
            如果需要，这里可以放一些关于产品的常见问题说明。如果需要，这里可以放一些关于产品的常见问题说明。如果需要，这里可以放一些关于产品的常见问题说明。
          </p>
        </div>
      </Card>
    </PageContainer>
  );
};

export default StepForm;
