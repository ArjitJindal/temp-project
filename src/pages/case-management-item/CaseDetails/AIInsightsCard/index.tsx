import React, { useEffect, useState } from 'react';
import s from './index.module.less';
import * as Card from '@/components/ui/Card';
import { InternalBusinessUser, MerchantMonitoringSource, MerchantMonitoringSummary } from '@/apis';
import { useApi } from '@/api';
import * as Form from '@/components/ui/Form';
import EarthLineIcon from '@/components/ui/icons/Remix/map/earth-line.react.svg';
import MoneyIcon from '@/components/ui/icons/Remix/finance/money-dollar-box-fill.react.svg';
import TeamIcon from '@/components/ui/icons/Remix/user/team-line.react.svg';
import BriefcaseIcon from '@/components/ui/icons/Remix/business/briefcase-2-line.react.svg';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
import { useQuery } from '@/utils/queries/hooks';
import { MERCHANT_SUMMARY, MERCHANT_SUMMARY_HISTORY } from '@/utils/queries/keys';
import dayjs from '@/utils/dayjs';
import Button from '@/components/library/Button';
import Drawer from '@/components/library/Drawer';
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
          <Button onClick={() => setRefresh(true)}>Refresh</Button>
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
      <input
        placeholder={'flagright.com'}
        value={scrapedDomain}
        onChange={(e) => {
          e.preventDefault();
          setScrapeDomain(e.target.value);
        }}
      />
      <Button
        onClick={() => {
          api
            .postMerchantScrape({ MerchantMonitoringSummaryRequest: { domain: scrapedDomain } })
            .then(setScrapedSummary);
        }}
      >
        Search
      </Button>
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
          <h1>{summary.source}</h1>
          <h3>{dayjs.dayjs(summary.updatedAt).fromNow()}</h3>
          {showHistory && <Button onClick={() => setSourceHistory(summary.source)}>History</Button>}
          <Card.Row>
            <Card.Column className={s.column}>
              <Card.Row>
                <div className={s.field}>
                  <Form.Layout.Label icon={<BriefcaseIcon />} title={'Business Industry'}>
                    {summary.industry ?? '-'}
                  </Form.Layout.Label>
                </div>
              </Card.Row>
              <Card.Row>
                <div className={s.field}>
                  <Form.Layout.Label icon={<BriefcaseIcon />} title={'Products Solds'}>
                    {summary.products?.join(',') ?? '-'}
                  </Form.Layout.Label>
                </div>
              </Card.Row>
              <Card.Row>
                <div className={s.field}>
                  <Form.Layout.Label icon={<EarthLineIcon />} title={'Location'}>
                    {summary.location ?? '-'}
                  </Form.Layout.Label>
                </div>
              </Card.Row>
              <Card.Row>
                <div className={s.field}>
                  <Form.Layout.Label icon={<TeamIcon />} title={'Company Size'}>
                    {summary.employees ?? '-'}
                  </Form.Layout.Label>
                </div>
              </Card.Row>
              <Card.Row>
                <div className={s.field}>
                  <Form.Layout.Label icon={<MoneyIcon />} title={'Annual Revenue'}>
                    {summary.revenue ?? '-'}
                  </Form.Layout.Label>
                </div>
              </Card.Row>
            </Card.Column>
            <Card.Column>
              <Card.Row>{summary.summary}</Card.Row>
            </Card.Column>
          </Card.Row>
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
