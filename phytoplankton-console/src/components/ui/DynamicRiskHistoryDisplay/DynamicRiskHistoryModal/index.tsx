import React, { useState } from 'react';
import { isManualDrsTxId, isNotArsChangeTxId } from '@flagright/lib/utils/risk';
import { firstLetterUpper } from '@flagright/lib/utils/humanize';
import { v4 as uuidv4 } from 'uuid';
import { ValueItem } from '../../RiskScoreDisplay/types';
import MainPanel from '../../RiskScoreDisplay/MainPanel';
import Id from '../../Id';
import styles from './index.module.less';
import ExpandedRowRenderer from './ExpandedRowRenderer';
import Modal from '@/components/library/Modal';
import { useApi } from '@/api';
import { usePaginatedQuery, useQuery } from '@/utils/queries/hooks';
import { RISK_FACTORS_V8, USER_DRS_VALUES } from '@/utils/queries/keys';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import { AllParams } from '@/components/library/Table/types';
import { DefaultApiGetDrsValuesRequest } from '@/apis/types/ObjectParamAPI';
import QueryResultsTable from '@/components/shared/QueryResultsTable';
import { ExtendedDrsScore, InternalBusinessUser, InternalConsumerUser, RiskFactor } from '@/apis';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import {
  DATE_TIME,
  RISK_LEVEL,
  TRANSACTION_ID,
} from '@/components/library/Table/standardDataTypes';
import { makeUrl } from '@/utils/routing';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import { RiskScore, RiskScores } from '@/pages/users-item/Header/HeaderMenu';
import { message } from '@/components/library/Message';
import {
  drsTableHeaders,
  getUserDrsReportTables,
  getUserWidgetTable,
} from '@/pages/users-item/UserReport';
import DownloadAsPDF from '@/components/DownloadAsPdf/DownloadAsPDF';
import { ExportDataRow } from '@/utils/data-export';
import { downloadAsCSV } from '@/utils/csv';
import { isSuccess } from '@/utils/asyncResource';
import { useUserDetails } from '@/utils/api/users';
import { useRiskClassificationScores } from '@/utils/risk-levels';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';

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

interface ExtendedDrsScoreWithRowId extends ExtendedDrsScore {
  rowId: string;
}

export function isFirstDrs(item: ExtendedDrsScoreWithRowId) {
  return !item.transactionId || item.transactionId === 'FIRST_DRS';
}

export function isLatestDrs(item: ExtendedDrsScoreWithRowId, value: ValueItem) {
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
  const settings = useSettings();
  const consoleUser = useUserDetails(userId);
  const riskClassificationValues = useRiskClassificationScores();
  const queryResult = usePaginatedQuery<ExtendedDrsScoreWithRowId>(
    USER_DRS_VALUES(userId, params),
    async (paginationParams) => {
      const result = await api.getDrsValues({
        userId,
        ...params,
        ...paginationParams,
      });
      return {
        ...result,
        items: result.items.map((item) => ({ ...item, rowId: uuidv4() })),
      };
    },
  );
  const factorMapResult = useQuery(RISK_FACTORS_V8('ALL'), async () => {
    const data = await api.getAllRiskFactors({ includeV2: true });
    return data.reduce((acc, item) => {
      acc[item.id] = item;
      return acc;
    }, {} as Record<string, RiskFactor>);
  });

  const handleDrsReportDownload = async (
    user: InternalBusinessUser | InternalConsumerUser,
    riskScores: RiskScores,
    format: 'csv' | 'pdf',
    factorMap: Record<string, RiskFactor>,
    exportConfig?: {
      pageSize: number;
      page: number;
      exportSinglePage: boolean;
    },
  ) => {
    const hideMessage = message.loading('Downloading report...');

    try {
      const drsData = await getUserDrsReportTables(queryResult, exportConfig, factorMap);
      if (format === 'pdf') {
        await DownloadAsPDF({
          fileName: `user-${user.userId}-CRA-report.pdf`,
          tableOptions: [
            getUserWidgetTable(user, riskScores, settings, riskClassificationValues),
            ...drsData,
          ],
          reportTitle: `${firstLetterUpper(settings.userAlias)} CRA report`,
        });
      } else {
        // converting pdf table to csv table
        const tableData =
          drsData[0].tableOptions.body
            ?.map((row): ExportDataRow => {
              if (row && Array.isArray(row)) {
                return row.map((cell) => ({ value: cell.content }));
              }
              return [];
            })
            .filter((row) => row.length > 0) ?? [];
        await downloadAsCSV({
          headers: drsTableHeaders,
          rows: tableData,
        });
      }
      message.success('Report downloaded successfully');
    } catch (err) {
      message.fatal('Unable to complete the download!', err);
    } finally {
      hideMessage && hideMessage();
    }
  };
  const helper = new ColumnHelper<ExtendedDrsScoreWithRowId>();

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
            <Id
              onClick={() => {
                localStorage.removeItem('SIMULATION_CUSTOM_RISK_FACTORS');
              }}
              to={makeUrl(`risk-levels/risk-factors/transaction`)}
            >
              View TRS risk factors
            </Id>
          );
        } else if (isManualDrsTxId(item.transactionId ?? '')) {
          return <>(Manual update)</>;
        }
        return (
          <Id
            onClick={() => {
              localStorage.removeItem('SIMULATION_CUSTOM_RISK_FACTORS');
            }}
            to={makeUrl(`risk-levels/risk-factors/consumer`)}
          >
            View KRS risk factors
          </Id>
        );
      },
    }),
  ]);

  return (
    <Modal
      onCancel={onCancel}
      isOpen={isOpen}
      width="XL"
      hideFooter
      title="Customer Risk Assessment (CRA) score"
    >
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
            {settings?.riskScoringAlgorithm?.type === 'FORMULA_CUSTOM' &&
            settings?.riskScoringAlgorithm?.krsWeight &&
            settings?.riskScoringAlgorithm?.avgArsWeight ? (
              <CustomRiskScoreFormula
                w1={settings.riskScoringAlgorithm.krsWeight}
                w2={settings.riskScoringAlgorithm.avgArsWeight}
              />
            ) : settings?.riskScoringAlgorithm?.type === 'FORMULA_LEGACY_MOVING_AVG' ? (
              <MovingAverageRiskScoreFormula />
            ) : (
              <DefaultRiskScoreFormula />
            )}
          </div>
        </div>
        <AsyncResourceRenderer resource={factorMapResult.data}>
          {(factorMap) => {
            return (
              <QueryResultsTable<ExtendedDrsScoreWithRowId>
                rowKey="rowId"
                columns={columns}
                tableId="cra-history-table"
                hideFilters={true}
                params={params}
                pagination
                onChangeParams={setParams}
                queryResults={queryResult}
                isExpandable={(item) => {
                  return (
                    ((item.content.factorScoreDetails &&
                      item.content.factorScoreDetails.length > 0) ||
                      (item.content.components && item.content.components.length > 0)) ??
                    false
                  );
                }}
                renderExpanded={(item) => <ExpandedRowRenderer {...item} />}
                toolsOptions={{
                  download: isSuccess(consoleUser.data) ? true : false,
                  supportedDownloadFormats: ['csv', 'pdf'],
                  downloadCallback: (
                    format: 'csv' | 'pdf',
                    exportConfig?: {
                      pageSize: number;
                      page: number;
                      exportSinglePage: boolean;
                    },
                  ) => {
                    if (isSuccess(consoleUser.data)) {
                      const userDrsScore = consoleUser.data.value.drsScore;
                      const userKrsScore = consoleUser.data.value.krsScore;
                      const drsRiskScore: RiskScore | null = userDrsScore
                        ? {
                            score: userDrsScore?.drsScore ?? 0,
                            riskLevel: userDrsScore?.derivedRiskLevel,
                            createdAt: userDrsScore?.createdAt ?? 0,
                            components: userDrsScore?.components,
                            manualRiskLevel: userDrsScore?.manualRiskLevel,
                          }
                        : null;

                      const kycRiskScore: RiskScore | null = userKrsScore
                        ? {
                            score: userKrsScore?.krsScore ?? 0,
                            riskLevel: userKrsScore?.riskLevel,
                            createdAt: userKrsScore?.createdAt ?? 0,
                            components: userKrsScore?.components,
                            manualRiskLevel: userKrsScore?.manualRiskLevel ?? undefined,
                          }
                        : null;
                      handleDrsReportDownload(
                        consoleUser.data.value,
                        {
                          drsRiskScore,
                          kycRiskScore,
                        },
                        format,
                        factorMap,
                        exportConfig,
                      );
                    }
                  },
                }}
              />
            );
          }}
        </AsyncResourceRenderer>
      </div>
    </Modal>
  );
}

const DefaultRiskScoreFormula = () => {
  return (
    <pre>
      <div className={styles.DRSFormula}>CRA[i] = avg(KRS + avg(TRS[1...i]))</div>
      <div className={styles.DRSFormula}>CRA[0] = KRS</div>
      <div className={styles.DRSFormula}>CRA[1] = avg(KRS + TRS[1])</div>
      <div className={styles.DRSFormula}>CRA[2] = avg(KRS + avg(TRS[1...2]))</div>
    </pre>
  );
};

const MovingAverageRiskScoreFormula = () => {
  return (
    <pre>
      <div className={styles.DRSFormula}>CRA[i] = avg(CRA[i-1] + avg(TRS[i...1]))</div>
      <div className={styles.DRSFormula}>CRA[0] = KRS</div>
      <div className={styles.DRSFormula}>CRA[1] = avg(KRS + TRS[1])</div>
      <div className={styles.DRSFormula}>CRA[2] = avg(CRA[1] + avg(TRS[1...2]))</div>
    </pre>
  );
};

const CustomRiskScoreFormula = (props: { w1: number; w2: number }) => {
  const { w1, w2 } = props;
  return (
    <pre>
      <div
        className={styles.DRSFormula}
      >{`CRA[i] = (${w1} X KRS) + (${w2} X avg(TRS[i...1]))`}</div>
      <div className={styles.DRSFormula}>CRA[0] = KRS</div>
      <div className={styles.DRSFormula}>{`CRA[1] = (${w1} X KRS) + (${w2} X TRS[1])`}</div>
      <div
        className={styles.DRSFormula}
      >{`CRA[2] = (${w1} X KRS) + (${w2} X avg(TRS[1...2]))`}</div>
    </pre>
  );
};

export default DynamicRiskHistoryModal;
