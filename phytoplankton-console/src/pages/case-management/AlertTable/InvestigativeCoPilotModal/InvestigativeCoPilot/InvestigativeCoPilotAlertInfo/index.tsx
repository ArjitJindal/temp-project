import React from 'react';
import pluralize from 'pluralize';
import { firstLetterUpper, humanizeAuto } from '@flagright/lib/utils/humanize';
import s from './index.module.less';
import dayjs, { TIME_FORMAT_WITHOUT_SECONDS } from '@/utils/dayjs';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { ALERT_ITEM, CASES_ITEM } from '@/utils/queries/keys';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import * as Form from '@/components/ui/Form';
import { all } from '@/utils/asyncResource';
import TimestampDisplay from '@/components/ui/TimestampDisplay';
import CaseStatusTag from '@/components/library/Tag/CaseStatusTag';
import Id from '@/components/ui/Id';
import { addBackUrlToRoute } from '@/utils/backUrl';
import { makeUrl } from '@/utils/routing';
import { Case } from '@/apis';
import { TableUser } from '@/pages/case-management/CaseTable/types';
import { getUserName } from '@/utils/api/users';
import UserLink from '@/components/UserLink';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';

interface Props {
  alertId: string;
  caseId: string;
}

export default function InvestigativeCoPilotAlertInfo(props: Props) {
  const { alertId, caseId } = props;
  const api = useApi();
  const settings = useSettings();

  const caseQueryResults = useQuery(
    CASES_ITEM(caseId),
    (): Promise<Case> =>
      api.getCase({
        caseId,
      }),
  );

  const alertQueryResult = useQuery(ALERT_ITEM(alertId), async () =>
    api.getAlert({
      alertId,
    }),
  );

  return (
    <AsyncResourceRenderer resource={all([caseQueryResults.data, alertQueryResult.data])}>
      {([caseItem, alert]) => {
        const caseUsers = caseItem.caseUsers ?? {};

        const user = caseUsers?.origin?.userId
          ? caseUsers?.origin
          : caseUsers?.destination?.userId
          ? caseUsers?.destination
          : undefined;

        const caseUserName = getUserName(user as TableUser | undefined);
        const caseUserId = caseUsers?.origin?.userId ?? caseUsers?.destination?.userId ?? '';
        const paymentDetails =
          caseItem.paymentDetails?.origin ?? caseItem.paymentDetails?.destination;

        return (
          <div className={s.alertInfo}>
            {user && 'type' in user && (
              <>
                <Form.Layout.Label title={firstLetterUpper(settings.userAlias)}>
                  {caseUserName}
                </Form.Layout.Label>
                <Form.Layout.Label title={`${firstLetterUpper(settings.userAlias)} ID`}>
                  <UserLink user={user}>{caseUserId}</UserLink>
                </Form.Layout.Label>
              </>
            )}
            {paymentDetails && (
              <>
                <Form.Layout.Label title={'Payment method'}>
                  {humanizeAuto(paymentDetails.method)}
                </Form.Layout.Label>
                <Form.Layout.Label title={'Payment method ID'}>
                  {caseItem.paymentMethodId ?? '-'}
                </Form.Layout.Label>
              </>
            )}
            <Form.Layout.Label title={'Alert ID'}>
              <Id
                to={addBackUrlToRoute(
                  makeUrl(`/case-management/case/:caseId/:tab`, {
                    caseId: alert.caseId,
                    tab: 'alerts',
                  }),
                )}
                testName="alert-id"
              >
                {alertId}
              </Id>
            </Form.Layout.Label>
            <Form.Layout.Label title={'Case ID'}>
              <Id
                to={addBackUrlToRoute(
                  makeUrl(`/case-management/case/:caseId`, {
                    caseId: alert.caseId,
                  }),
                )}
                testName="case-id"
              >
                {alert.caseId}
              </Id>
            </Form.Layout.Label>
            <Form.Layout.Label title={'Created at'}>
              <TimestampDisplay
                timestamp={alert.createdTimestamp}
                timeFormat={TIME_FORMAT_WITHOUT_SECONDS}
              />
            </Form.Layout.Label>
            <Form.Layout.Label title={'Priority'}>{alert.priority}</Form.Layout.Label>
            <Form.Layout.Label title={'Alert age'}>
              {pluralize(
                'day',
                Math.floor(dayjs.duration(Date.now() - alert.createdTimestamp).asDays()),
                true,
              )}
            </Form.Layout.Label>
            <Form.Layout.Label title={'TX#'}>{alert.numberOfTransactionsHit}</Form.Layout.Label>
            <Form.Layout.Label title={'Alert status'}>
              {alert.alertStatus ? <CaseStatusTag caseStatus={alert.alertStatus} /> : 'N/A'}
            </Form.Layout.Label>
          </div>
        );
      }}
    </AsyncResourceRenderer>
  );
}
