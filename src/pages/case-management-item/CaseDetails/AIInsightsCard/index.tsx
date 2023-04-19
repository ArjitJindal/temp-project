import React, { useEffect, useState } from 'react';
import cn from 'clsx';
import s from './index.module.less';
import * as Card from '@/components/ui/Card';
import { InternalBusinessUser, MerchantMonitoringSource, MerchantMonitoringSummary } from '@/apis';
import { useApi } from '@/api';
import * as Form from '@/components/ui/Form';
import EarthLineIcon from '@/components/ui/icons/Remix/map/earth-line.react.svg';
import MoneyIcon from '@/components/ui/icons/Remix/finance/money-dollar-box-line.react.svg';
import BriefcaseIcon from '@/components/ui/icons/Remix/business/briefcase-2-line.react.svg';
import UserGroupIcon from '@/components/ui/icons/Remix/user/group-line.react.svg';
import HistoryLine from '@/components/ui/icons/Remix/system/history-line.react.svg';
import RefreshLine from '@/components/ui/icons/Remix/system/refresh-line.react.svg';
import ExternalLinkFill from '@/components/ui/icons/Remix/system/external-link-fill.react.svg';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
import { useQuery } from '@/utils/queries/hooks';
import { MERCHANT_SUMMARY, MERCHANT_SUMMARY_HISTORY } from '@/utils/queries/keys';
import dayjs from '@/utils/dayjs';
import Button from '@/components/library/Button';
import Drawer from '@/components/library/Drawer';
import TextInput from '@/components/library/TextInput';
import { MERCHANT_MONITORING_SOURCES } from '@/apis/models-custom/MerchantMonitoringSource';
interface Props {
  user: InternalBusinessUser;
  updateCollapseState?: (key: string, value: boolean) => void;
  title: string;
  collapsableKey: string;
}
export default function AIInsightsCard(props: Props) {
  const { updateCollapseState, title, collapsableKey, user } = props;
  const api = useApi();

  // Get company name and their website
  const domain = user.legalEntity.contactDetails?.websites
    ? (user.legalEntity?.contactDetails?.websites[0] as string)
    : undefined;
  const name = user.legalEntity.companyGeneralDetails.legalName;

  const [refresh, setRefresh] = useState<boolean>(false);
  const queryResult = useQuery(MERCHANT_SUMMARY(name), () =>
    api.postMerchantSummary({ MerchantMonitoringSummaryRequest: { name, domain, refresh } }),
  );

  useEffect(() => {
    queryResult.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh]);

  return (
    <AsyncResourceRenderer resource={queryResult.data}>
      {(summariesResponse) => (
        <Card.Root header={{ title, collapsableKey }} updateCollapseState={updateCollapseState}>
          <Button
            type="TEXT"
            icon={<RefreshLine />}
            style={{ width: '150px', margin: '20px', marginBottom: '0px' }}
            onClick={() => setRefresh(true)}
          >
            Refresh All
          </Button>
          {summariesResponse.data && (
            <Summaries
              name={name}
              domain={domain as string}
              summaries={summariesResponse.data}
              showHistory={true}
            />
          )}
        </Card.Root>
      )}
    </AsyncResourceRenderer>
  );
}

const Summaries = ({
  name,
  domain,
  summaries,
  showHistory,
}: {
  name: string;
  domain: string;
  summaries: MerchantMonitoringSummary[];
  showHistory: boolean;
}) => {
  const api = useApi();

  const [sourceHistory, setSourceHistory] = useState<MerchantMonitoringSource | undefined>();
  const [scrapedDomain, setScrapeDomain] = useState<string>();
  const [scrapedSummary, setScrapedSummary] = useState<MerchantMonitoringSummary>();
  return (
    <Card.Section>
      <Card.Row justify="evenly" className={s.titleHeader}>
        <Card.Column>
          <h2 className={s.title}>Aggregated user information</h2>
        </Card.Column>

        <Card.Column>
          <Card.Row className={s.titleSearch}>
            <Card.Column>
              <TextInput
                placeholder={'Enter new source URL'}
                value={scrapedDomain}
                onChange={setScrapeDomain}
              />
            </Card.Column>
            <Card.Column>
              <Button
                onClick={() => {
                  api
                    .postMerchantScrape({
                      MerchantMonitoringSummaryRequest: { domain: scrapedDomain },
                    })
                    .then(setScrapedSummary);
                }}
              >
                Request Data
              </Button>
            </Card.Column>
          </Card.Row>
        </Card.Column>
      </Card.Row>

      {showHistory && sourceHistory && (
        <SummaryHistory
          name={name}
          domain={domain}
          source={sourceHistory}
          summaries={summaries}
          isVisible={!!sourceHistory}
          setVisible={setSourceHistory}
        />
      )}
      {/* For now we are just concatting the scraped summary with the others on the frontend but should be done on the backend */}
      {(scrapedSummary ? [scrapedSummary, ...summaries] : summaries).map((summary) => (
        <Card.Section className={s.section}>
          <div className={s.titleSearch}>
            <div style={{ gap: '0rem' }}>
              <h3>
                {summary.source && MERCHANT_MONITORING_SOURCES.includes(summary.source) ? (
                  <img src={`/${summary.source}.png`} width={150} alt={summary.source} />
                ) : (
                  <>{summary.source}</>
                )}
                <a href={summary.source} style={{ marginTop: '15px' }}>
                  <ExternalLinkFill width={15} height={15} />
                </a>
              </h3>

              <p className={s.lastUpdated}>
                Last updated {dayjs.dayjs(summary.updatedAt).fromNow()}
              </p>
            </div>
            <div
              style={{ textAlign: 'left', display: 'flex', height: '40px' }}
              className={s.fileds}
            >
              <Button
                type="TEXT"
                icon={<RefreshLine />}
                onClick={() => setSourceHistory(summary.source)}
                size="MEDIUM"
              >
                Refresh
              </Button>
              {showHistory && (
                <Button
                  type="TETRIARY"
                  icon={<HistoryLine />}
                  onClick={() => setSourceHistory(summary.source)}
                  size="MEDIUM"
                >
                  View history
                </Button>
              )}
            </div>
          </div>
          <div className={s.merchantDetails}>
            <div>
              <div className={cn(s.fields, s.form)}>
                <Form.Layout.Label icon={<BriefcaseIcon />} title={'Business Industry'} />
                {summary.industry ?? '-'}
              </div>

              <div className={cn(s.fields, s.form)}>
                <>
                  <Form.Layout.Label icon={<BriefcaseIcon />} title={'Products Solds'} />
                </>
                <>{summary.products?.join(',') ?? '-'}</>
              </div>

              <div className={cn(s.fields, s.form)}>
                <Form.Layout.Label icon={<EarthLineIcon />} title={'Location'} />

                {summary.location ?? '-'}
              </div>

              <div className={cn(s.fields, s.form)}>
                <Form.Layout.Label icon={<UserGroupIcon />} title={'Company Size'} />

                {summary.employees ?? '-'}
              </div>

              <div className={cn(s.fields, s.form)}>
                <Form.Layout.Label icon={<MoneyIcon />} title={'Annual Revenue'} />
                {summary.revenue ?? '-'}
              </div>
            </div>
            <div className={s.summary}>
              <h3>Summary</h3>
              <Card.Row>{summary.summary}</Card.Row>
            </div>
          </div>
        </Card.Section>
      ))}
    </Card.Section>
  );
};

const SummaryHistory = ({
  source,
  name,
  domain,
  isVisible,
  setVisible,
}: {
  name: string;
  domain: string;
  source: MerchantMonitoringSource;
  isVisible: boolean;
  setVisible: (source: MerchantMonitoringSource | undefined) => void;
  summaries: MerchantMonitoringSummary[];
}) => {
  const api = useApi();
  const queryResult = useQuery(MERCHANT_SUMMARY_HISTORY(name, source), () =>
    api.postMerchantHistory({ MerchantMonitoringSummaryRequest: { name, domain, source } }),
  );
  return (
    <Drawer
      title={'History'}
      isVisible={isVisible}
      onChangeVisibility={() => setVisible(undefined)}
    >
      <AsyncResourceRenderer resource={queryResult.data}>
        {(summariesResp) =>
          summariesResp.data && (
            <Summaries
              name={name}
              domain={domain}
              summaries={summariesResp.data}
              showHistory={false}
            />
          )
        }
      </AsyncResourceRenderer>
    </Drawer>
  );
};
