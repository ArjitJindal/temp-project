import { Row, Select, Space, Typography } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { merge } from 'lodash';
import { CURRENCIES_SELECT_OPTIONS } from '@flagright/lib/constants';
import s from './styles.module.less';
import { message } from '@/components/library/Message';
import { removeNil } from '@/utils/json';
import * as Card from '@/components/ui/Card';
import {
  CurrencyCode,
  InternalBusinessUser,
  InternalConsumerUser,
  UserUpdateRequest,
} from '@/apis';
import Label from '@/components/library/Label';
import Money from '@/components/ui/Money';
import Table from '@/components/library/Table';
import { TransactionLimit } from '@/apis/models/TransactionLimit';
import { PAYMENT_METHODS, PaymentMethod } from '@/utils/payments';
import PaymentMethodTag from '@/components/library/Tag/PaymentTypeTag';
import { TransactionLimitsPaymentMethodLimits } from '@/apis/models/TransactionLimitsPaymentMethodLimits';
import Button from '@/components/library/Button';
import { TransactionCountLimit } from '@/apis/models/TransactionCountLimit';
import { TransactionAmountLimit } from '@/apis/models/TransactionAmountLimit';
import { useApi } from '@/api';
import COLORS from '@/components/ui/colors';
import { useHasResources } from '@/utils/user-utils';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { PAYMENT_METHOD } from '@/components/library/Table/standardDataTypes';
import NumberInput from '@/components/library/NumberInput';
import Drawer from '@/components/library/Drawer';

const timeFrames = ['day', 'week', 'month', 'year'];

type EditMode = 'NONE' | 'EDIT' | 'ADD';
interface Props {
  user: InternalBusinessUser | InternalConsumerUser;
}

interface TableItem {
  paymentMethod: PaymentMethod;
  transactionLimit: TransactionLimit;
}

interface PaymentMethodLimitsEditorProps {
  editMode: EditMode;
  selectedPaymentMethod?: PaymentMethod;
  existingPaymentMethods?: PaymentMethod[];
  transactionLimit?: TransactionLimit;
  onSave: (paymentMethod: PaymentMethod, transactionLimit: TransactionLimit) => void;
  onClose: () => void;
}

function getCurrency(transactionLimit: TransactionLimit) {
  let currency: CurrencyCode | undefined = undefined;
  JSON.stringify(transactionLimit, (k, v) => {
    if (k === 'amountCurrency') {
      currency = v;
    }
    return v;
  });
  return currency;
}

function updateCurrency(
  amountLimit: TransactionAmountLimit,
  currency: CurrencyCode,
): TransactionAmountLimit {
  return JSON.parse(
    JSON.stringify(amountLimit, (k, v) => {
      if (k === 'amountCurrency') {
        return currency;
      }
      return v;
    }),
  );
}

const PaymentMethodLimitsEditor: React.FC<PaymentMethodLimitsEditorProps> = ({
  editMode,
  selectedPaymentMethod,
  existingPaymentMethods,
  transactionLimit,
  onSave,
  onClose,
}) => {
  const [updatedPaymentMethod, setUpdatedPaymentMethod] = useState<PaymentMethod | undefined>();
  const [updatedCurrency, setUpdatedCurrency] = useState<CurrencyCode | undefined>();
  const [updatedTransactionCountLimit, setUpdatedTransactionCountLimit] =
    useState<TransactionCountLimit>({});
  const [updatedTransactionAmountLimit, setUpdatedTransactionAmountLimit] =
    useState<TransactionAmountLimit>({});
  const [updatedAverageTransactionAmountLimit, setUpdatedAverageTransactionAmountLimit] =
    useState<TransactionAmountLimit>({});
  const paymentMethod = useMemo(
    () => updatedPaymentMethod || selectedPaymentMethod,
    [selectedPaymentMethod, updatedPaymentMethod],
  );
  const currency = useMemo(
    () => updatedCurrency ?? (transactionLimit && getCurrency(transactionLimit)),
    [updatedCurrency, transactionLimit],
  );
  const transactionCountLimit = useMemo(
    () => merge(transactionLimit?.transactionCountLimit, updatedTransactionCountLimit),
    [transactionLimit?.transactionCountLimit, updatedTransactionCountLimit],
  );
  const transactionAmountLimit = useMemo(
    () => merge(transactionLimit?.transactionAmountLimit, updatedTransactionAmountLimit),
    [transactionLimit?.transactionAmountLimit, updatedTransactionAmountLimit],
  );
  const averageTransactionAmountLimit = useMemo(
    () =>
      merge(transactionLimit?.averageTransactionAmountLimit, updatedAverageTransactionAmountLimit),
    [transactionLimit?.averageTransactionAmountLimit, updatedAverageTransactionAmountLimit],
  );
  const handleSave = useCallback(async () => {
    if (paymentMethod == null) {
      message.warn('Payment method is required');
      return;
    }
    if (currency == null) {
      message.warn('Currency is required');
      return;
    }
    onSave(paymentMethod, {
      transactionCountLimit,
      transactionAmountLimit: updateCurrency(transactionAmountLimit, currency),
      averageTransactionAmountLimit: updateCurrency(averageTransactionAmountLimit, currency),
    });
  }, [
    averageTransactionAmountLimit,
    currency,
    onSave,
    paymentMethod,
    transactionAmountLimit,
    transactionCountLimit,
  ]);
  useEffect(() => {
    if (editMode === 'NONE') {
      setUpdatedCurrency(undefined);
      setUpdatedPaymentMethod(undefined);
      setUpdatedTransactionCountLimit({});
      setUpdatedTransactionAmountLimit({});
      setUpdatedAverageTransactionAmountLimit({});
    }
  }, [editMode]);

  const hasChanges = useMemo(() => {
    return (
      updatedPaymentMethod !== undefined ||
      updatedCurrency !== undefined ||
      Object.keys(updatedTransactionCountLimit).length > 0 ||
      Object.keys(updatedTransactionAmountLimit).length > 0 ||
      Object.keys(updatedAverageTransactionAmountLimit).length > 0
    );
  }, [
    updatedPaymentMethod,
    updatedCurrency,
    updatedTransactionCountLimit,
    updatedTransactionAmountLimit,
    updatedAverageTransactionAmountLimit,
  ]);

  return (
    <Drawer
      title={'Expected transaction limits'}
      drawerMaxWidth="500px"
      isVisible={editMode !== 'NONE'}
      onChangeVisibility={onClose}
      hasChanges={hasChanges}
      footer={
        <Button type="PRIMARY" isDisabled={!paymentMethod} onClick={handleSave}>
          {editMode === 'EDIT' ? 'Save limit' : 'Add limit'}
        </Button>
      }
    >
      {editMode !== 'NONE' ? (
        <div className={s.drawerBody}>
          <Label label="Payment method">
            <Select<PaymentMethod>
              style={{ width: '100%' }}
              value={paymentMethod}
              disabled={editMode === 'EDIT'}
              onChange={(value) => setUpdatedPaymentMethod(value)}
              showSearch={true}
            >
              {PAYMENT_METHODS.filter((option) => !existingPaymentMethods?.includes(option)).map(
                (option, index) => (
                  <Select.Option key={index} value={option}>
                    <PaymentMethodTag paymentMethod={option} />
                  </Select.Option>
                ),
              )}
            </Select>
          </Label>
          <Label label="Currency">
            <Select<CurrencyCode>
              style={{ width: '100%' }}
              value={currency}
              onChange={(value) => setUpdatedCurrency(value)}
              options={CURRENCIES_SELECT_OPTIONS}
              showSearch
            />
          </Label>
          {timeFrames.map((timeFrame, index) => (
            <Label
              key={`count-${timeFrame}-${index}`}
              label={`Max transaction count / ${timeFrame}`}
            >
              <div className={s.numberInput}>
                <NumberInput
                  min={0}
                  allowClear={true}
                  value={transactionCountLimit[timeFrame]}
                  onChange={(newValue) =>
                    setUpdatedTransactionCountLimit((prev) => ({
                      ...prev,
                      [timeFrame]: newValue ? Number(newValue) : null,
                    }))
                  }
                />
              </div>
            </Label>
          ))}
          {timeFrames.map((timeFrame, index) => (
            <Label
              key={`amount-${timeFrame}-${index}`}
              label={`Max transaction amount / ${timeFrame}`}
            >
              <div className={s.numberInput}>
                <NumberInput
                  min={0}
                  allowClear={true}
                  value={transactionAmountLimit[timeFrame]?.amountValue}
                  isDisabled={!currency}
                  onChange={(newValue) => {
                    setUpdatedTransactionAmountLimit((prev) => ({
                      ...prev,
                      [timeFrame]: newValue
                        ? {
                            amountCurrency: currency,
                            amountValue: newValue,
                          }
                        : null,
                    }));
                  }}
                />
              </div>
            </Label>
          ))}
          {timeFrames.map((timeFrame, index) => (
            <Label
              key={`avg-amount-${timeFrame}-${index}`}
              label={`Avg transaction amount / ${timeFrame}`}
            >
              <div className={s.numberInput}>
                <NumberInput
                  min={0}
                  allowClear={true}
                  value={averageTransactionAmountLimit[timeFrame]?.amountValue}
                  isDisabled={!currency}
                  onChange={(newValue) => {
                    setUpdatedAverageTransactionAmountLimit((prev) => ({
                      ...prev,
                      [timeFrame]: newValue
                        ? {
                            amountCurrency: currency,
                            amountValue: Number(newValue),
                          }
                        : null,
                    }));
                  }}
                />
              </div>
            </Label>
          ))}
        </div>
      ) : null}
    </Drawer>
  );
};

interface PaymentMethodLimitsTableProps {
  user: InternalBusinessUser | InternalConsumerUser;
  editMode: EditMode;
  onEditModeChange: (editMode: EditMode) => void;
}

const PaymentMethodLimitsTable: React.FC<PaymentMethodLimitsTableProps> = ({
  user,
  editMode,
  onEditModeChange,
}) => {
  const api = useApi();
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>();
  const [paymentMethodLimits, setPaymentMethodLimits] =
    useState<TransactionLimitsPaymentMethodLimits>(
      user.transactionLimits?.paymentMethodLimits ?? {},
    );
  const hasUserOveviewWritePermissions = useHasResources(['write:::users/user-overview/*']);
  const handleSavePaymentMethodLimits = useCallback(
    async (
      paymentMethod: PaymentMethod,
      newPaymentMethodTransactionLimit: TransactionLimit | null,
    ) => {
      const hideMessage = message.loading(`Saving...`);
      try {
        const params: { userId: string; UserUpdateRequest: UserUpdateRequest } = {
          userId: user.userId,
          UserUpdateRequest: {
            transactionLimits: {
              paymentMethodLimits: removeNil({
                ...paymentMethodLimits,
                [paymentMethod]: newPaymentMethodTransactionLimit,
              }),
            },
          },
        };
        await (user.type === 'CONSUMER'
          ? api.postConsumerUsersUserId(params)
          : api.postBusinessUsersUserId(params));

        message.success('Transaction limits saved successfully');
        setPaymentMethodLimits({
          ...paymentMethodLimits,
          [paymentMethod]: newPaymentMethodTransactionLimit,
        });
        onEditModeChange('NONE');
      } catch (e) {
        message.fatal('Failed to save', e);
      } finally {
        hideMessage();
      }
    },
    [api, onEditModeChange, paymentMethodLimits, user.type, user.userId],
  );

  const tableItems = Object.entries(paymentMethodLimits)
    .filter((entry) => entry[1])
    .map((entry) => ({
      paymentMethod: entry[0] as PaymentMethod,
      transactionLimit: entry[1],
    }));

  const helper = new ColumnHelper<TableItem>();
  return (
    <>
      <Table<TableItem>
        sizingMode="FULL_WIDTH"
        rowKey="paymentMethod"
        pagination={false}
        externalHeader={true}
        data={{
          items: tableItems,
        }}
        hideFilters={true}
        columns={[
          helper.simple({
            title: 'Payment method',
            key: 'paymentMethod',
            type: PAYMENT_METHOD,
          }),
          helper.simple({
            title: 'Max transaction count',
            id: 'maxTransactionCount',
            key: 'transactionLimit',
            type: {
              render: (transactionLimit) => {
                return (
                  <Space direction="vertical">
                    {Object.entries(transactionLimit?.transactionCountLimit || {})
                      .filter((entry) => entry[1])
                      .map((entry) => `${entry[1]} / ${entry[0]}`)}
                  </Space>
                );
              },
            },
          }),
          helper.simple({
            title: 'Max transaction amount',
            id: 'maxTransactionAmount',
            key: 'transactionLimit',
            type: {
              render: (transactionLimit) => {
                return (
                  <Space direction="vertical">
                    {Object.entries(transactionLimit?.transactionAmountLimit || {})
                      .filter((entry) => entry[1])
                      .map((entry, index) => (
                        <Space key={index}>
                          <Money amount={entry[1]} /> / {entry[0]}
                        </Space>
                      ))}
                  </Space>
                );
              },
            },
          }),
          helper.simple({
            title: 'Avg transaction amount',
            key: 'transactionLimit',
            id: 'avgTransactionAmount',
            type: {
              render: (transactionLimit) => {
                return (
                  <Space direction="vertical">
                    {Object.entries(transactionLimit?.averageTransactionAmountLimit || {})
                      .filter((entry) => entry[1])
                      .map((entry, index) => (
                        <Space key={index}>
                          <Money amount={entry[1]} /> / {entry[0]}
                        </Space>
                      ))}
                  </Space>
                );
              },
            },
          }),
          helper.display({
            title: 'Actions',
            render: (row) => {
              return (
                <Space>
                  <EditOutlined
                    onClick={() => {
                      onEditModeChange('EDIT');
                      setSelectedPaymentMethod(row.paymentMethod);
                    }}
                    disabled={!hasUserOveviewWritePermissions}
                  />
                  <DeleteOutlined
                    onClick={async () => {
                      await handleSavePaymentMethodLimits(row.paymentMethod, null);
                    }}
                    disabled={!hasUserOveviewWritePermissions}
                  />
                </Space>
              );
            },
          }),
        ]}
      />

      <PaymentMethodLimitsEditor
        editMode={editMode}
        selectedPaymentMethod={selectedPaymentMethod}
        existingPaymentMethods={
          Object.entries(paymentMethodLimits)
            .filter((entry) => entry[1])
            .map((entry) => entry[0]) as PaymentMethod[]
        }
        transactionLimit={selectedPaymentMethod && paymentMethodLimits[selectedPaymentMethod]}
        onSave={handleSavePaymentMethodLimits}
        onClose={() => {
          onEditModeChange('NONE');
          setSelectedPaymentMethod(undefined);
        }}
      />
    </>
  );
};

export default function ExpectedTransactionLimits(props: Props) {
  const { user } = props;
  const [editMode, setEditMode] = useState<EditMode>('NONE');
  return (
    <>
      <Card.Section>
        <Typography.Title level={4}>On all transactions</Typography.Title>
        <Card.Row border={false}>
          <Card.Column>
            <Label label={'Daily'}>
              <Money amount={user.transactionLimits?.maximumDailyTransactionLimit} />
            </Label>
          </Card.Column>
          <Card.Column>
            <Label label={'Weekly'}>
              <Money amount={user.transactionLimits?.maximumWeeklyTransactionLimit} />
            </Label>
          </Card.Column>
          <Card.Column>
            <Label label={'Monthly'}>
              <Money amount={user.transactionLimits?.maximumMonthlyTransactionLimit} />
            </Label>
          </Card.Column>
          <Card.Column>
            <Label label={'Quarterly'}>
              <Money amount={user.transactionLimits?.maximumQuarterlyTransactionLimit} />
            </Label>
          </Card.Column>
          <Card.Column>
            <Label label={'Yearly'}>
              <Money amount={user.transactionLimits?.maximumYearlyTransactionLimit} />
            </Label>
          </Card.Column>
          <Card.Column>
            <Label label={'Maximum'}>
              <Money amount={user.transactionLimits?.maximumTransactionLimit} />
            </Label>
          </Card.Column>
        </Card.Row>
        {/* </Card.Row> */}
      </Card.Section>
      <Card.Section>
        <Typography.Title level={4}>
          <Row align="middle">
            On payment method
            <Button
              type="TEXT"
              icon={<PlusOutlined />}
              style={{
                color: COLORS.brandBlue.base,
              }}
              onClick={() => setEditMode('ADD')}
            >
              Add
            </Button>
          </Row>
        </Typography.Title>
        <PaymentMethodLimitsTable user={user} editMode={editMode} onEditModeChange={setEditMode} />
      </Card.Section>
    </>
  );
}
