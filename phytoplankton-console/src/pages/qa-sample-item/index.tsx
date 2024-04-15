import { useParams } from 'react-router';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { TableSearchParams } from '../case-management/types';
import { QAModal } from '../case-management/QAModal';
import s from './index.module.less';
import Breadcrumbs from '@/components/library/Breadcrumbs';
import PageWrapper, { PageWrapperContentContainer } from '@/components/PageWrapper';
import * as Card from '@/components/ui/Card';
import PriorityTag from '@/components/library/PriorityTag';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { ALERT_QA_SAMPLE } from '@/utils/queries/keys';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import Tag from '@/components/library/Tag';
import Button from '@/components/library/Button';
import EditLineIcon from '@/components/ui/icons/Remix/design/edit-line.react.svg';
import { P } from '@/components/ui/Typography';
import Avatar from '@/components/library/Avatar';
import { useUsers } from '@/utils/user-utils';
import { dayjs, DEFAULT_DATE_TIME_FORMAT } from '@/utils/dayjs';
import QaTable from '@/pages/case-management/QaTable';
import { Authorized } from '@/components/utils/Authorized';
import { useMutation } from '@/utils/queries/mutations/hooks';
import { AlertsQaSampling, AlertsQaSamplingUpdateRequest } from '@/apis';
import { message } from '@/components/library/Message';

export const QASamplePage = () => {
  const { samplingId } = useParams<{ samplingId: string }>() as { samplingId: string };
  const api = useApi();
  const [params, onChangeParams] = useState<TableSearchParams>({
    pageSize: 20,
    sort: [['createdAt', 'descend']],
  });

  const sampleQueryResult = useQuery(
    ALERT_QA_SAMPLE(samplingId),
    async () => await api.getAlertsQaSample({ sampleId: samplingId }),
    { enabled: !!samplingId },
  );

  const mutation = useMutation<AlertsQaSampling, unknown, AlertsQaSamplingUpdateRequest>(
    async (data) =>
      await api.patchAlertsQaSample({ sampleId: samplingId, AlertsQaSamplingUpdateRequest: data }),
    {
      onSuccess: () => {
        message.success('Sampling updated successfully');
        sampleQueryResult.refetch();
        setIsModalOpen(false);
      },
      onError: (error) => {
        message.fatal('Failed to update sampling', error);
      },
    },
  );

  const [users] = useUsers();
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <Authorized required={['case-management:qa:read']} showForbiddenPage>
      <PageWrapper
        header={
          <div className={s.header}>
            <Breadcrumbs
              items={[
                { title: 'Case Management', to: '/case-management' },
                { title: 'QA', to: '/case-management/cases' },
                { title: 'Sampling', to: '/case-management/qa-sampling' },
                { title: samplingId },
              ]}
            />
          </div>
        }
      >
        <AsyncResourceRenderer resource={sampleQueryResult.data}>
          {(sample) => (
            <div className={s.container}>
              <Card.Root noBorder>
                <div className={s.card}>
                  <div className={s.cardHeader}>
                    <div className={s.cardSection}>
                      <PriorityTag priority={sample.priority} />
                      <Tag color="grey">{`Sampling - ${sample.samplingPercentage}%`}</Tag>
                      <Link style={{ fontWeight: 600 }} to="#">
                        {sample.samplingId}
                      </Link>
                    </div>
                    <div className={s.cardSection}>
                      <Authorized required={['case-management:qa:write']}>
                        <Button
                          type="TETRIARY"
                          size="SMALL"
                          icon={<EditLineIcon />}
                          onClick={() => setIsModalOpen(true)}
                        >
                          Edit
                        </Button>
                      </Authorized>
                      <QAModal
                        isModalOpen={isModalOpen}
                        setIsModalOpen={setIsModalOpen}
                        type="EDIT"
                        onSubmit={(values) => {
                          mutation.mutate(values);
                        }}
                        initialValues={sample}
                      />
                    </div>
                  </div>
                  <div>
                    <P bold variant="m">
                      {sample.samplingName}
                    </P>
                    <P variant="m">{sample.samplingDescription}</P>
                  </div>
                  <div className={s.cardBottom}>
                    <div className={s.cardBottomItem}>
                      <P variant="s" grey>
                        Created by -
                      </P>
                      <Avatar user={users[sample.createdBy as string]} size="xs" />
                      <P variant="s">
                        {users[sample.createdBy as string]?.name ||
                          users[sample.createdBy as string]?.email}
                      </P>
                    </div>
                    <div className={s.cardBottomItem}>
                      <P variant="s" grey>
                        Created at -
                      </P>
                      <P variant="s">{dayjs(sample.createdAt).format(DEFAULT_DATE_TIME_FORMAT)}</P>
                    </div>
                  </div>
                </div>
              </Card.Root>
              <PageWrapperContentContainer>
                <QaTable
                  params={{ ...params, filterAlertIds: sample.alertIds }}
                  onChangeParams={onChangeParams}
                />
              </PageWrapperContentContainer>
            </div>
          )}
        </AsyncResourceRenderer>
      </PageWrapper>
    </Authorized>
  );
};
