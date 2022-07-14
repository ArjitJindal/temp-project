import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ActionType, ProColumns } from '@ant-design/pro-table';
import { Avatar, Drawer, Tooltip } from 'antd';
import moment from 'moment';
import { ProFormInstance } from '@ant-design/pro-form';
import { Link } from 'react-router-dom';
import { useNavigate, useParams } from 'react-router';
import { ExpandedRulesRowRender } from './components/ExpandedRulesRowRender';
import { TransactionDetails } from './components/TransactionDetails';
import { RuleActionStatus } from './components/RuleActionStatus';
import { FormValues } from './types';
import { currencies } from '@/utils/currencies';
import Table from '@/components/ui/Table';
import { ApiException, TransactionCaseManagement } from '@/apis';
import { useApi } from '@/api';
import { getUserName } from '@/utils/api/users';
import { useUsers } from '@/utils/user-utils';
import { DATE_TIME_FORMAT } from '@/pages/transactions/transactions-list';
import AllowForm from '@/pages/case-management/components/AllowForm';
import {
  AsyncResource,
  failed,
  init,
  isInit,
  isSuccess,
  loading,
  success,
} from '@/utils/asyncResource';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
import PageWrapper from '@/components/PageWrapper';
import { useAnalytics } from '@/utils/segment/context';
import { measure } from '@/utils/time-utils';
import { useI18n } from '@/locales';
import { Feature } from '@/components/AppWrapper/Providers/SettingsProvider';
import '../../components/ui/colors';

function TableList() {
  const { id: transactionId } = useParams<'id'>();
  const [users] = useUsers();
  const actionRef = useRef<ActionType>();
  const formRef = useRef<ProFormInstance<FormValues>>();
  const [currentItem, setCurrentItem] = useState<AsyncResource<TransactionCaseManagement>>(init());
  const [updatedTransactions, setUpdatedTransactions] = useState<{
    [key: string]: TransactionCaseManagement;
  }>({});
  const handleTransactionUpdate = useCallback(async (newTransaction: TransactionCaseManagement) => {
    const transactionId = newTransaction.transactionId as string;
    setUpdatedTransactions((prev) => ({
      ...prev,
      [transactionId]: newTransaction,
    }));
  }, []);
  const api = useApi();

  const currentTransactionId = isSuccess(currentItem) ? currentItem.value.transactionId : null;
  useEffect(() => {
    if (transactionId == null || transactionId === 'all') {
      setCurrentItem(init());
      return function () {};
    }
    if (currentTransactionId === transactionId) {
      return function () {};
    }
    setCurrentItem(loading());
    let isCanceled = false;
    api
      .getTransaction({
        transactionId,
      })
      .then((transaction) => {
        if (isCanceled) {
          return;
        }
        setCurrentItem(success(transaction));
      })
      .catch((e) => {
        if (isCanceled) {
          return;
        }
        // todo: i18n
        let message = 'Unknown error';
        if (e instanceof ApiException && e.code === 404) {
          message = `Unable to find transaction by id "${transactionId}"`;
        } else if (e instanceof Error && e.message) {
          message = e.message;
        }
        setCurrentItem(failed(message));
      });
    return () => {
      isCanceled = true;
    };
  }, [currentTransactionId, transactionId, api]);

  const reloadTable = useCallback(() => {
    actionRef.current?.reload();
  }, []);

  const analytics = useAnalytics();

  // todo: i18n
  const columns: ProColumns<TransactionCaseManagement>[] = useMemo(
    () => [
      {
        title: 'Transaction ID',
        dataIndex: 'transactionId',
        width: 130,
        copyable: true,
        ellipsis: true,
        render: (dom, entity) => {
          // todo: fix style
          return (
            <Link
              to={`/case-management/${entity.transactionId}`}
              onClick={() => {
                setCurrentItem(success(entity));
              }}
              style={{ color: '@fr-colors-brandBlue' }}
              replace
            >
              {entity.transactionId}
            </Link>
          );
        },
      },
      {
        title: 'Transaction Type',
        dataIndex: 'type',
        width: 150,
        ellipsis: true,
      },
      {
        title: 'Timestamp',
        width: 130,
        ellipsis: true,
        dataIndex: 'timestamp',
        valueType: 'dateTimeRange',
        sorter: true,
        render: (_, transaction) => {
          return moment(transaction.timestamp).format(DATE_TIME_FORMAT);
        },
      },
      {
        title: 'Rules hit',
        width: 100,
        ellipsis: true,
        hideInSearch: true,
        dataIndex: 'ruleHitCount',
        sorter: true,
        render: (_, transaction) => {
          return `${transaction.executedRules.filter((rule) => rule.ruleHit).length} rule(s)`;
        },
      },
      {
        title: 'Origin User ID',
        width: 120,
        dataIndex: 'originUserId',
        render: (dom, entity) => {
          return entity.originUserId;
        },
      },
      {
        title: 'Origin User Name',
        width: 120,
        render: (dom, entity) => {
          return getUserName(entity.originUser);
        },
      },
      {
        title: 'Origin Method',
        width: 100,
        hideInSearch: true,
        render: (dom, entity) => {
          return entity.originPaymentDetails?.method;
        },
      },
      {
        title: 'Origin Amount',
        dataIndex: 'originAmountDetails.transactionAmount',
        hideInSearch: true,
        sorter: true,
        width: 120,
        render: (dom, entity) => {
          if (entity.originAmountDetails?.transactionAmount !== undefined) {
            return new Intl.NumberFormat().format(entity.originAmountDetails?.transactionAmount);
          } else {
            return entity.originAmountDetails?.transactionAmount;
          }
        },
      },
      {
        title: 'Origin Currency',
        hideInSearch: true,
        width: 80,
        render: (dom, entity) => {
          return entity.originAmountDetails?.transactionCurrency;
        },
      },
      {
        title: 'Origin Country',
        hideInSearch: true,
        width: 80,
        render: (dom, entity) => {
          return entity.originAmountDetails?.country;
        },
      },
      {
        title: 'Destination User ID',
        dataIndex: 'destinationUserId',
        width: 150,
        render: (dom, entity) => {
          return entity.destinationUserId;
        },
      },
      {
        title: 'Destination User Name',
        width: 180,
        render: (dom, entity) => {
          return getUserName(entity.destinationUser);
        },
      },
      {
        title: 'Destination Method',
        width: 120,
        hideInSearch: true,
        render: (dom, entity) => {
          return entity.destinationPaymentDetails?.method;
        },
      },
      {
        title: 'Destination Amount',
        width: 120,
        dataIndex: 'destnationAmountDetails.transactionAmount',
        hideInSearch: true,
        sorter: true,
        render: (dom, entity) => {
          if (entity.destinationAmountDetails?.transactionAmount !== undefined) {
            return new Intl.NumberFormat().format(
              entity.destinationAmountDetails?.transactionAmount,
            );
          } else {
            return entity.destinationAmountDetails?.transactionAmount;
          }
        },
      },
      {
        title: 'Destination Currency',
        width: 100,
        hideInSearch: true,
        render: (dom, entity) => {
          return entity.destinationAmountDetails?.transactionCurrency;
        },
      },
      {
        title: 'Destination Country',
        width: 100,
        hideInSearch: true,
        render: (dom, entity) => {
          return entity.destinationAmountDetails?.country;
        },
      },
      {
        title: 'Status',
        sorter: true,
        hideInSearch: true,
        width: 120,
        render: (dom, entity) => {
          const transaction = updatedTransactions[entity.transactionId as string] || entity;
          return <RuleActionStatus ruleAction={transaction.status} />;
        },
      },
      {
        title: 'Operations',
        hideInSearch: true,
        sorter: true,
        width: 120,
        render: (dom, entity) => {
          return <AllowForm transactionId={entity.transactionId as string} onSaved={reloadTable} />;
        },
      },
      {
        title: 'Assignees',
        hideInSearch: true,
        width: 100,
        ellipsis: true,
        render: (dom, entity) => {
          const transaction = updatedTransactions[entity.transactionId as string] || entity;
          return (
            <Avatar.Group maxCount={3}>
              {transaction.assignments?.map((assignment) => (
                <Tooltip
                  key={assignment.assigneeUserId}
                  title={users[assignment.assigneeUserId]?.name}
                >
                  <Avatar size="small" src={users[assignment.assigneeUserId]?.picture} />
                </Tooltip>
              ))}
            </Avatar.Group>
          );
        },
      },
      {
        title: 'Rules Hit',
        dataIndex: 'rulesHitFilter',
        hideInTable: true,
        width: 120,
        valueType: 'select',
        request: async () => {
          const rules = await api.getRules();
          return rules.map((rule) => ({
            value: rule.id,
            label: `${rule.name} (${rule.id})`,
          }));
        },
        fieldProps: {
          allowClear: true,
          mode: 'multiple',
        },
      },
      {
        title: 'Rules Executed',
        dataIndex: 'rulesExecutedFilter',
        hideInTable: true,
        width: 120,
        valueType: 'select',
        request: async () => {
          const rules = await api.getRules();
          return rules.map((rule) => ({
            value: rule.id,
            label: `${rule.name} (${rule.id})`,
          }));
        },
        fieldProps: {
          allowClear: true,
          mode: 'multiple',
        },
      },
      {
        title: 'Origin Currencies',
        dataIndex: 'originCurrenciesFilter',
        hideInTable: true,
        width: 120,
        valueType: 'select',
        fieldProps: {
          options: currencies,
          allowClear: true,
          mode: 'multiple',
        },
      },
      {
        title: 'Destination Currencies',
        dataIndex: 'destinationCurrenciesFilter',
        hideInTable: true,
        width: 120,
        valueType: 'select',
        fieldProps: {
          options: currencies,
          allowClear: true,
          mode: 'multiple',
        },
      },
    ],
    [api, reloadTable, updatedTransactions, users],
  );
  const [isLoading, setLoading] = useState(false);
  const i18n = useI18n();
  const navigate = useNavigate();

  return (
    <PageWrapper title={i18n('menu.case-management')}>
      <Table<TransactionCaseManagement>
        form={{
          labelWrap: true,
        }}
        onLoadingChange={(isLoading) => {
          setLoading(isLoading === true);
        }}
        actionRef={actionRef}
        formRef={formRef}
        rowKey="transactionId"
        search={{
          labelWidth: 120,
        }}
        scroll={{ x: 1300 }}
        expandable={{ expandedRowRender: ExpandedRulesRowRender }}
        request={async (params, sorter) => {
          const {
            pageSize,
            current,
            timestamp,
            transactionId,
            rulesHitFilter,
            rulesExecutedFilter,
            originCurrenciesFilter,
            destinationCurrenciesFilter,
            originUserId,
            destinationUserId,
            type,
          } = params;
          const [sortField, sortOrder] = Object.entries(sorter)[0] ?? [];
          const [response, time] = await measure(() =>
            api.getTransactionsList({
              limit: pageSize!,
              skip: (current! - 1) * pageSize!,
              afterTimestamp: timestamp ? moment(timestamp[0]).valueOf() : 0,
              beforeTimestamp: timestamp ? moment(timestamp[1]).valueOf() : Date.now(),
              filterId: transactionId,
              filterRulesHit: rulesHitFilter,
              filterRulesExecuted: rulesExecutedFilter,
              filterOutStatus: 'ALLOW',
              filterOriginCurrencies: originCurrenciesFilter,
              filterDestinationCurrencies: destinationCurrenciesFilter,
              filterOriginUserId: originUserId,
              filterDestinationUserId: destinationUserId,
              transactionType: type,
              sortField: sortField ?? undefined,
              sortOrder: sortOrder ?? undefined,
            }),
          );
          analytics.event({
            title: 'Table Loaded',
            time,
          });
          return {
            data: response.data,
            success: true,
            total: response.total,
          };
        }}
        columns={columns}
        columnsState={{
          persistenceType: 'localStorage',
          persistenceKey: 'case-management-list',
        }}
      />
      <Feature name="SLACK_ALERTS">
        <>
          <h3>Alerting:</h3>
          <a
            href="https://slack.com/oauth/v2/authorize?scope=&amp;user_scope=&amp;redirect_uri=https%3A%2F%2Fflagright.com&amp;client_id=2800969986821.3612821223619"
            style={{
              alignItems: 'center',
              color: '#fff',
              backgroundColor: '#4A154B',
              border: '0',
              borderRadius: '44px',
              display: 'inline-flex',
              fontFamily: 'Lato, sans-serif',
              fontSize: '10px',
              fontWeight: '600',
              height: '38px',
              justifyContent: 'center',
              textDecoration: 'none',
              width: '124px',
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              style={{ height: '16px', width: '16px', marginRight: '12px' }}
              viewBox="0 0 122.8 122.8"
            >
              <path
                d="M25.8 77.6c0 7.1-5.8 12.9-12.9 12.9S0 84.7 0 77.6s5.8-12.9 12.9-12.9h12.9v12.9zm6.5 0c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9v32.3c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V77.6z"
                fill="#e01e5a"
              ></path>
              <path
                d="M45.2 25.8c-7.1 0-12.9-5.8-12.9-12.9S38.1 0 45.2 0s12.9 5.8 12.9 12.9v12.9H45.2zm0 6.5c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H12.9C5.8 58.1 0 52.3 0 45.2s5.8-12.9 12.9-12.9h32.3z"
                fill="#36c5f0"
              ></path>
              <path
                d="M97 45.2c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9-5.8 12.9-12.9 12.9H97V45.2zm-6.5 0c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V12.9C64.7 5.8 70.5 0 77.6 0s12.9 5.8 12.9 12.9v32.3z"
                fill="#2eb67d"
              ></path>
              <path
                d="M77.6 97c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9-12.9-5.8-12.9-12.9V97h12.9zm0-6.5c-7.1 0-12.9-5.8-12.9-12.9s5.8-12.9 12.9-12.9h32.3c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H77.6z"
                fill="#ecb22e"
              ></path>
            </svg>
            Add to Slack
          </a>
        </>
      </Feature>
      <Drawer
        width={700}
        visible={!isInit(currentItem)}
        onClose={() => {
          navigate('/case-management/all', { replace: true });
        }}
        closable={false}
      >
        <AsyncResourceRenderer resource={currentItem}>
          {(transaction) => (
            <TransactionDetails
              transaction={
                (transaction.transactionId
                  ? updatedTransactions[transaction.transactionId]
                  : null) ?? transaction
              }
              onTransactionUpdate={handleTransactionUpdate}
            />
          )}
        </AsyncResourceRenderer>
      </Drawer>
    </PageWrapper>
  );
}

export default TableList;
