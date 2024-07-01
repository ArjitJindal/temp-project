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
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { useQuery } from '@/utils/queries/hooks';
import { MERCHANT_SUMMARY, MERCHANT_SUMMARY_HISTORY } from '@/utils/queries/keys';
import dayjs from '@/utils/dayjs';
import Button from '@/components/library/Button';
import Drawer from '@/components/library/Drawer';
import TextInput from '@/components/library/TextInput';
import { message } from '@/components/library/Message';

function getValidUrl(url?: string): string | null {
  if (!url) {
    return null;
  }
  try {
    return new URL(url).href ?? null;
  } catch {
    return null;
  }
}

interface Props {
  user: InternalBusinessUser;
  title?: string;
}

export default function AIInsightsCard(props: Props) {
  const { title, user } = props;
  const api = useApi();

  const [refresh, setRefresh] = useState<boolean>(false);
  const [source, setSource] = useState<MerchantMonitoringSource | undefined>();
  const queryResult = useQuery(MERCHANT_SUMMARY(props.user.userId), () =>
    api
      .postMerchantSummary({
        MerchantMonitoringSummaryRequest: { userId: user.userId, source, refresh },
      })
      .finally(() => setRefresh(false)),
  );

  useEffect(() => {
    if (refresh) {
      queryResult.refetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh]);

  return (
    <Card.Root header={title != null ? { title } : undefined}>
      <AsyncResourceRenderer resource={queryResult.data}>
        {(summariesResponse) =>
          summariesResponse.data && (
            <Summaries
              userId={user.userId}
              summaries={summariesResponse.data}
              showHistory={true}
              onRefresh={(source: MerchantMonitoringSource | undefined) => {
                setRefresh(true);
                setSource(source);
              }}
            />
          )
        }
      </AsyncResourceRenderer>
    </Card.Root>
  );
}

const Summaries = ({
  userId,
  summaries,
  showHistory,
  onRefresh,
}: {
  userId: string;
  summaries: MerchantMonitoringSummary[];
  showHistory: boolean;
  onRefresh?: (source: MerchantMonitoringSource | undefined) => void;
}) => {
  const api = useApi();
  const [sourceHistory, setSourceHistory] = useState<MerchantMonitoringSource | undefined>();
  const [scrapedDomain, setScrapeDomain] = useState<string>();
  const [scrapedSummary, setScrapedSummary] = useState<MerchantMonitoringSummary>();
  const [scraping, setScraping] = useState<boolean>(false);
  const requestData = () => {
    const url = getValidUrl(scrapedDomain);
    if (!url) {
      return;
    }
    setScraping(true);
    api
      .postMerchantScrape({
        MerchantMonitoringScrapeRequest: { userId, url },
      })
      .then(setScrapedSummary)
      .catch(() => message.error(`Unable to crawl ${scrapedDomain}`))
      .finally(() => setScraping(false));
  };
  return (
    <Card.Section>
      {showHistory && (
        <Card.Row>
          <div className={s.titleHeader}>
            <TextInput
              placeholder={'Enter new source URL'}
              value={scrapedDomain}
              onChange={setScrapeDomain}
            />
            <Button
              type="PRIMARY"
              isLoading={scraping}
              onClick={requestData}
              isDisabled={!getValidUrl(scrapedDomain)}
            >
              Request data
            </Button>
            <Button
              style={{ marginLeft: 'auto', width: '122px' }}
              type="SECONDARY"
              icon={<RefreshLine />}
              onClick={onRefresh ? () => onRefresh(undefined) : undefined}
            >
              Refresh all
            </Button>
          </div>
        </Card.Row>
      )}
      {showHistory && sourceHistory && (
        <SummaryHistory
          userId={userId}
          source={sourceHistory}
          summaries={summaries}
          isVisible={!!sourceHistory}
          setVisible={setSourceHistory}
        />
      )}
      {/* For now we are just concatting the scraped summary with the others on the frontend but should be done on the backend */}
      {(scrapedSummary ? [scrapedSummary, ...summaries] : summaries).map((summary) => (
        <Card.Section className={s.section}>
          <div className={s.sectionHeader}>
            <div>
              <div className={s.logo}>
                <img
                  src={`/${summary.source?.sourceType}.png`}
                  height={40}
                  alt={summary.source?.sourceType}
                />
                {summary.source?.sourceType === 'SCRAPE' && (
                  <a href={summary.source?.sourceValue} className={s.scrapeLink} target="_blank">
                    <span>{summary.source.sourceValue}</span>{' '}
                    <ExternalLinkFill width={15} height={15} />
                  </a>
                )}
              </div>
              <p className={s.lastUpdated}>
                Last updated {dayjs.dayjs(summary.updatedAt).fromNow()}
              </p>
            </div>
            {showHistory && (
              <div className={s.sectionActions}>
                <div className={s.buttonGroup}>
                  <Button
                    type="TETRIARY"
                    icon={<HistoryLine />}
                    onClick={() => setSourceHistory(summary.source)}
                  >
                    View history
                  </Button>
                  <Button
                    type="SECONDARY"
                    icon={<RefreshLine />}
                    onClick={onRefresh ? () => onRefresh(summary.source) : undefined}
                    style={{ width: '122px' }}
                  >
                    Refresh
                  </Button>
                </div>
              </div>
            )}
          </div>
          <div className={s.merchantDetails}>
            <div>
              <div className={cn(s.fields, s.form)}>
                <Form.Layout.Label icon={<BriefcaseIcon />} title={'Business industry'} />
                {summary.industry ?? '-'}
              </div>

              <div className={cn(s.fields, s.form)}>
                <>
                  <Form.Layout.Label icon={<BriefcaseIcon />} title={'Products sold'} />
                </>
                <>{summary.products?.join(',') ?? '-'}</>
              </div>

              <div className={cn(s.fields, s.form)}>
                <Form.Layout.Label icon={<EarthLineIcon />} title={'Location'} />

                {summary.location ?? '-'}
              </div>

              <div className={cn(s.fields, s.form)}>
                <Form.Layout.Label icon={<UserGroupIcon />} title={'Company size'} />

                {summary.employees ?? '-'}
              </div>

              <div className={cn(s.fields, s.form)}>
                <Form.Layout.Label icon={<MoneyIcon />} title={'Annual revenue'} />
                {summary.revenue ?? '-'}
              </div>
            </div>
            <div className={s.summary}>
              <h3>Summary</h3>
              <Card.Row>
                <span data-cy="merchant-monitoring-user-summary">{summary.summary}</span>
              </Card.Row>
            </div>
          </div>
        </Card.Section>
      ))}
    </Card.Section>
  );
};

const SummaryHistory = ({
  source,
  userId,
  isVisible,
  setVisible,
}: {
  source: MerchantMonitoringSource;
  userId: string;
  isVisible: boolean;
  setVisible: (source: MerchantMonitoringSource | undefined) => void;
  summaries: MerchantMonitoringSummary[];
}) => {
  const api = useApi();
  const queryResult = useQuery(MERCHANT_SUMMARY_HISTORY(userId, source), () =>
    api.postMerchantHistory({ MerchantMonitoringSummaryRequest: { userId, source } }),
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
            <Summaries userId={userId} summaries={summariesResp.data} showHistory={false} />
          )
        }
      </AsyncResourceRenderer>
    </Drawer>
  );
};
