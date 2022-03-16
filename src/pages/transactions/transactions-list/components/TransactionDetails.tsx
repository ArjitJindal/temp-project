import ProDescriptions from '@ant-design/pro-descriptions';
import { Divider, Tag } from 'antd';
import styles from './TransactionDetails.less';
import { TransactionWithRulesResult, Tag as TransactionTag } from '@/apis';

interface Props {
  transaction: TransactionWithRulesResult;
}

export const TransactionDetails: React.FC<Props> = ({ transaction }) => {
  return (
    <ProDescriptions size="small" column={1} colon={false}>
      <ProDescriptions.Item label={<b>Transaction ID:</b>} valueType="text">
        {transaction.transactionId}
      </ProDescriptions.Item>
      <ProDescriptions.Item label={<b>Timestamp:</b>} valueType="dateTime">
        {transaction.timestamp}
      </ProDescriptions.Item>
      <ProDescriptions.Item
        label={
          <Divider orientation="left" orientationMargin="0">
            Sender
          </Divider>
        }
        className={styles.verticalDetailsItem}
      >
        <ProDescriptions size="small" column={1}>
          <ProDescriptions.Item label="User ID" valueType="text">
            {transaction.senderUserId}
          </ProDescriptions.Item>
          <ProDescriptions.Item label="Amount" valueType="text">
            {transaction.sendingAmountDetails?.transactionAmount}
          </ProDescriptions.Item>
          <ProDescriptions.Item label="Currency" valueType="text">
            {transaction.sendingAmountDetails?.transactionCurrency}
          </ProDescriptions.Item>
          <ProDescriptions.Item label="Country" valueType="text">
            {transaction.sendingAmountDetails?.country}
          </ProDescriptions.Item>
          <ProDescriptions.Item
            label="Payment Details"
            valueType="jsonCode"
            className={styles.verticalDetailsItem}
          >
            {JSON.stringify(transaction.senderPaymentDetails)}
          </ProDescriptions.Item>
        </ProDescriptions>
      </ProDescriptions.Item>
      <ProDescriptions.Item
        label={
          <Divider orientation="left" orientationMargin="0">
            Receiver
          </Divider>
        }
        className={styles.verticalDetailsItem}
      >
        <ProDescriptions size="small" column={1}>
          <ProDescriptions.Item label="User ID" valueType="text">
            {transaction.receiverUserId}
          </ProDescriptions.Item>
          <ProDescriptions.Item label="Amount" valueType="text">
            {transaction.receivingAmountDetails?.transactionAmount}
          </ProDescriptions.Item>
          <ProDescriptions.Item label="Currency" valueType="text">
            {transaction.receivingAmountDetails?.transactionCurrency}
          </ProDescriptions.Item>
          <ProDescriptions.Item label="Country" valueType="text">
            {transaction.receivingAmountDetails?.country}
          </ProDescriptions.Item>
          <ProDescriptions.Item
            label="Payment Details"
            valueType="jsonCode"
            className={styles.verticalDetailsItem}
          >
            {JSON.stringify(transaction.receiverPaymentDetails)}
          </ProDescriptions.Item>
        </ProDescriptions>
      </ProDescriptions.Item>
      <ProDescriptions.Item
        label={
          <Divider orientation="left" orientationMargin="0">
            Metadata
          </Divider>
        }
        className={styles.verticalDetailsItem}
      >
        <ProDescriptions size="small" column={1}>
          {transaction.productType && (
            <ProDescriptions.Item label="Product Type" valueType="text">
              {transaction.productType}
            </ProDescriptions.Item>
          )}
          {transaction.promotionCodeUsed !== undefined && (
            <ProDescriptions.Item label="Promotino Code Used" valueType="text">
              {String(transaction.promotionCodeUsed)}
            </ProDescriptions.Item>
          )}
          {transaction.reference && (
            <ProDescriptions.Item label="Reference" valueType="text">
              {transaction.reference}
            </ProDescriptions.Item>
          )}
          {transaction.deviceData && (
            <ProDescriptions.Item
              label="Device Data"
              valueType="jsonCode"
              className={styles.verticalDetailsItem}
            >
              {JSON.stringify(transaction.deviceData)}
            </ProDescriptions.Item>
          )}
          {transaction.tags && transaction.tags.length > 0 && (
            <ProDescriptions.Item label="Tags">
              <span>
                {transaction.tags.map((tag: TransactionTag) => (
                  <Tag color={'cyan'}>
                    <span>
                      {tag.key}: <span style={{ fontWeight: 700 }}>{tag.value}</span>
                    </span>
                  </Tag>
                ))}
              </span>
            </ProDescriptions.Item>
          )}
        </ProDescriptions>
      </ProDescriptions.Item>
    </ProDescriptions>
  );
};
