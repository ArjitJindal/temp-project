import React, { useState } from 'react';
import { isManualDrsTxId, isNotArsChangeTxId } from '@flagright/lib/utils/risk';
import { ValueItem } from '../../RiskScoreDisplay/types';
import MainPanel from '../../RiskScoreDisplay/MainPanel';
import Id from '../../Id';
import styles from './index.module.less';
import ExpandedRowRenderer from './ExpandedRowRenderer';
import Modal from '@/components/library/Modal';
import { useApi } from '@/api';
import { usePaginatedQuery } from '@/utils/queries/hooks';
import { USER_DRS_VALUES } from '@/utils/queries/keys';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import { AllParams } from '@/components/library/Table/types';
import { DefaultApiGetDrsValuesRequest } from '@/apis/types/ObjectParamAPI';
import QueryResultsTable from '@/components/shared/QueryResultsTable';
import { ExtendedDrsScore } from '@/apis';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import {
  DATE_TIME,
  RISK_LEVEL,
  TRANSACTION_ID,
} from '@/components/library/Table/standardDataTypes';
import { makeUrl } from '@/utils/routing';

interface Props {
  userId: string;
  icon: React.ReactNode;
  isOpen: boolean;
  onCancel: () => void;
  title: string;
  showFormulaBackLink?: boolean;
  value: ValueItem;
  isExternalSource?: boolean;
  riskScoreAlgo: (value: ValueItem) => number;
}

export function isFirstDrs(item: ExtendedDrsScore) {
  return !item.transactionId || item.transactionId === 'FIRST_DRS';
}

export function isLatestDrs(item: ExtendedDrsScore, value: ValueItem) {
  return (
    item.transactionId === value.transactionId &&
    item.createdAt === value.createdAt &&
    item.drsScore === value.score
  );
}

function DynamicRiskHistoryModal(props: Props) {
  const { isOpen, userId, onCancel, icon, title, value, riskScoreAlgo } = props;
  const api = useApi();
  const [params, setParams] = useState<AllParams<Partial<DefaultApiGetDrsValuesRequest>>>({
    ...DEFAULT_PARAMS_STATE,
    pageSize: 10,
  });

  const queryResult = usePaginatedQuery<ExtendedDrsScore>(
    USER_DRS_VALUES(userId, params),
    async (paginationParams) => {
      return await api.getDrsValues({
        userId,
        ...paginationParams,
        ...params,
      });
    },
  );
  const helper = new ColumnHelper<ExtendedDrsScore>();

  const columns = helper.list([
    helper.display({
      id: 'craScore',
      title: 'CRA risk score',
      defaultWidth: 200,
      render: (item) => {
        return <div className={styles.craScore}>{item.drsScore.toFixed(2) ?? '-'}</div>;
      },
    }),
    helper.simple<'derivedRiskLevel'>({
      title: 'CRA risk level',
      key: 'derivedRiskLevel',
      type: RISK_LEVEL,
      defaultWidth: 200,
    }),
    helper.display({
      title: 'Transaction ID',
      id: 'transactionId',
      render: (item) => {
        return item.transactionId && !isNotArsChangeTxId(item.transactionId) ? (
          TRANSACTION_ID().render(item.transactionId)
        ) : (
          <>-</>
        );
      },
      defaultWidth: 200,
    }),
    helper.simple<'arsRiskLevel'>({
      title: 'TRS risk level',
      key: 'arsRiskLevel',
      type: RISK_LEVEL,
      defaultWidth: 200,
    }),
    helper.display({
      title: 'TRS risk score',
      id: 'arsRiskScore',
      render: (item) => {
        return item.arsRiskScore ? <>{item.arsRiskScore.toFixed(2)}</> : <>-</>;
      },
      defaultWidth: 200,
    }),
    helper.simple<'createdAt'>({
      title: 'Timestamp',
      key: 'createdAt',
      type: DATE_TIME,
      sorting: true,
      defaultWidth: 200,
    }),
    helper.display({
      title: 'Action',
      defaultWidth: 200,
      id: 'action',
      render: (item) => {
        if (item.transactionId && !isNotArsChangeTxId(item.transactionId)) {
          return (
            <Id to={makeUrl(`risk-levels/risk-factors/transaction`)}>View TRS risk factors</Id>
          );
        } else if (isManualDrsTxId(item.transactionId ?? '')) {
          return <>(Manual update)</>;
        }
        return <Id to={makeUrl(`risk-levels/risk-factors/consumer`)}>View KRS risk factors</Id>;
      },
    }),
  ]);

  return (
    <Modal onCancel={onCancel} isOpen={isOpen} width="XL" hideFooter title="CRA Score">
      <div className={styles.root}>
        <div className={styles.header}>
          <MainPanel
            icon={icon}
            title={title}
            lastItem={value}
            riskScoreAlgo={riskScoreAlgo}
            sortedItems={[value]}
          />
          <div>
            <div className={styles.DRSHeader}>
              Dynamic aggregate score of your customer based on their KRS and TRS.
            </div>
            <pre>
              <div className={styles.DRSFormula}>CRA[i] = avg (CRA[i-1] + TRS[i] )</div>
              <div className={styles.DRSFormula}>CRA[0] = KRS</div>
              <div className={styles.DRSFormula}>CRA[1] = avg ( KRS + TRS[1] )</div>
              <div className={styles.DRSFormula}>CRA[2] = avg ( CRA[1] + TRS[2] )</div>
            </pre>
          </div>
        </div>
        <QueryResultsTable<ExtendedDrsScore>
          rowKey="createdAt"
          columns={columns}
          tableId="sla-policy-table"
          hideFilters={true}
          params={params}
          pagination
          onChangeParams={setParams}
          queryResults={queryResult}
          isExpandable={(item) => {
            return (
              ((item.content.factorScoreDetails && item.content.factorScoreDetails.length > 0) ||
                (item.content.components && item.content.components.length > 0)) ??
              false
            );
          }}
          renderExpanded={(item) => <ExpandedRowRenderer {...item} />}
          toolsOptions={false}
        />
      </div>
    </Modal>
  );
}

export default DynamicRiskHistoryModal;
