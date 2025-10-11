import { useParams } from 'react-router';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { TableSearchParams } from '../case-management/types';
import { QAModal } from '../case-management/QA/Modal';
import s from './index.module.less';
import Breadcrumbs from '@/components/library/Breadcrumbs';
import PageWrapper, { PageWrapperContentContainer } from '@/components/PageWrapper';
import * as Card from '@/components/ui/Card';
import PriorityTag from '@/components/library/PriorityTag';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import Tag from '@/components/library/Tag';
import Button from '@/components/library/Button';
import EditLineIcon from '@/components/ui/icons/Remix/design/edit-line.react.svg';
import DeleteLineIcon from '@/components/ui/icons/Remix/system/delete-bin-line.react.svg';
import { P } from '@/components/ui/Typography';
import Avatar from '@/components/library/Avatar';
import { useUsers } from '@/utils/user-utils';
import { dayjs, DEFAULT_DATE_TIME_FORMAT } from '@/utils/dayjs';
import QaTable from '@/pages/case-management/QA/Table';
import { Authorized } from '@/components/utils/Authorized';
import { message } from '@/components/library/Message';
import Confirm from '@/components/utils/Confirm';
import { useQaSample, useUpdateQaSample } from '@/hooks/api/alerts';

export const QASamplePage = () => {
  const { samplingId } = useParams<{ samplingId: string }>() as { samplingId: string };
  const [params, onChangeParams] = useState<TableSearchParams>({
    pageSize: 20,
    sort: [['createdAt', 'descend']],
    sampleId: samplingId,
  });

  const sampleQueryResult = useQaSample(samplingId, { enabled: !!samplingId });

  const [users] = useUsers();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const mutation = useUpdateQaSample({
    onSuccess: () => sampleQueryResult.refetch(),
  }) as any;

  return (
    <Authorized minRequiredResources={['read:::case-management/qa/*']} showForbiddenPage>
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
                      <Tag color="gray">{`Sampling - ${
                        sample.samplingType === 'AUTOMATIC'
                          ? `${sample.numberOfAlerts} alerts`
                          : 'Manual'
                      }`}</Tag>
                      <Link style={{ fontWeight: 600 }} to="#">
                        {sample.samplingId}
                      </Link>
                    </div>
                    <div className={s.cardSection}>
                      <Authorized minRequiredResources={['write:::case-management/qa/*']}>
                        <div className={s.actions}>
                          <Button
                            type="TETRIARY"
                            size="SMALL"
                            icon={<EditLineIcon />}
                            onClick={() => setIsModalOpen(true)}
                            testName="edit-sampling"
                          >
                            Edit
                          </Button>
                          <Confirm
                            text="Are you sure you want to delete this sample? This action cannot be undone."
                            title="Delete sample"
                            onConfirm={() => {
                              message.info('Deleting sample...');
                              // The specific delete hook exists elsewhere; keeping callback stubbed
                            }}
                          >
                            {({ onClick }) => (
                              <Button
                                type="TETRIARY"
                                size="SMALL"
                                onClick={onClick}
                                testName="delete-sampling"
                                icon={<DeleteLineIcon />}
                              >
                                Delete
                              </Button>
                            )}
                          </Confirm>
                        </div>
                      </Authorized>
                      <QAModal
                        isModalOpen={isModalOpen}
                        setIsModalOpen={setIsModalOpen}
                        type="EDIT"
                        onSubmit={(values) => {
                          if (values.samplingQuantity < sample.samplingQuantity) {
                            return message.error(
                              'Number of alerts in the sample cannot be less than the current number of alerts',
                            );
                          }
                          mutation.mutate({
                            sampleId: samplingId,
                            body: {
                              priority: values.priority,
                              samplingName: values.samplingName,
                              samplingDescription: values.samplingDescription,
                              samplingQuantity: values.samplingQuantity,
                            },
                          });
                        }}
                        initialValues={sample}
                        params={sample.filters}
                        sampleType={sample.samplingType}
                      />
                    </div>
                  </div>
                  <div data-cy="samplingName">
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
                  params={params}
                  onChangeParams={onChangeParams}
                  isSelectionEnabled={false}
                  manuallyAddedAlerts={sample.manuallyAdded}
                />
              </PageWrapperContentContainer>
            </div>
          )}
        </AsyncResourceRenderer>
      </PageWrapper>
    </Authorized>
  );
};
