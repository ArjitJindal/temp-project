/* eslint-disable @typescript-eslint/no-var-requires */
import ProDescriptions from '@ant-design/pro-descriptions';
import { Divider, Tag } from 'antd';
import styles from './TransactionDetails.module.less';
import { Tag as TransactionTag, TransactionCaseManagement } from '@/apis';
import { getUserName } from '@/utils/api/users';
import UserLink from '@/components/UserLink';

interface Props {
  transaction: TransactionCaseManagement;
}

export const TransactionDetails: React.FC<Props> = ({ transaction }) => {
  return (
    <>
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
              {transaction.originUser !== undefined ? (
                <UserLink user={transaction.originUser}>
                  {String(transaction.originUserId)}
                </UserLink>
              ) : (
                String(transaction.originUserId)
              )}
            </ProDescriptions.Item>
            <ProDescriptions.Item label="User Name" valueType="text">
              {getUserName(transaction.originUser)}
            </ProDescriptions.Item>
            <ProDescriptions.Item label="Amount" valueType="text">
              {new Intl.NumberFormat().format(
                transaction.originAmountDetails?.transactionAmount
                  ? transaction.originAmountDetails?.transactionAmount
                  : NaN,
              )}
            </ProDescriptions.Item>
            <ProDescriptions.Item label="Currency" valueType="text">
              {transaction.originAmountDetails?.transactionCurrency}
            </ProDescriptions.Item>
            <ProDescriptions.Item label="Country" valueType="text">
              {transaction.originAmountDetails?.country}
            </ProDescriptions.Item>
            <ProDescriptions.Item
              label="Payment Details"
              valueType="jsonCode"
              className={styles.verticalDetailsItem}
            >
              {JSON.stringify(transaction.originPaymentDetails)}
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
              {transaction.destinationUser !== undefined ? (
                <UserLink user={transaction.destinationUser}>
                  {String(transaction.destinationUserId)}
                </UserLink>
              ) : (
                String(transaction.destinationUserId)
              )}
            </ProDescriptions.Item>
            <ProDescriptions.Item label="User Name" valueType="text">
              {getUserName(transaction.destinationUser)}
            </ProDescriptions.Item>
            <ProDescriptions.Item label="Amount" valueType="text">
              {new Intl.NumberFormat().format(
                transaction.destinationAmountDetails?.transactionAmount
                  ? transaction.destinationAmountDetails?.transactionAmount
                  : NaN,
              )}
            </ProDescriptions.Item>
            <ProDescriptions.Item label="Currency" valueType="text">
              {transaction.destinationAmountDetails?.transactionCurrency}
            </ProDescriptions.Item>
            <ProDescriptions.Item label="Country" valueType="text">
              {transaction.destinationAmountDetails?.country}
            </ProDescriptions.Item>
            <ProDescriptions.Item
              label="Payment Details"
              valueType="jsonCode"
              className={styles.verticalDetailsItem}
            >
              {JSON.stringify(transaction.destinationPaymentDetails)}
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
              <ProDescriptions.Item label="Promotion Code Used" valueType="text">
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
                  {transaction.tags.map((tag: TransactionTag, index) => (
                    <Tag color={'cyan'} key={index}>
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
    </>
  );
};
