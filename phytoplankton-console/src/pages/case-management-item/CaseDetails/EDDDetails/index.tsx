import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import s from './index.module.less';
import { useSidebarWidth } from './useSidebarWidth';
import { EDDReview, EDDReviewUpdateRequest } from '@/apis';
import Dropdown from '@/components/library/Dropdown';
import Button from '@/components/library/Button';
import { H4 } from '@/components/ui/Typography';
import ArrowDownFilled from '@/components/ui/icons/Remix/system/arrow-down-s-fill.react.svg';
import EditLineIcon from '@/components/ui/icons/Remix/design/edit-line.react.svg';
import CollapseAltOutlined from '@/components/ui/icons/collapse-diagonal-line.react.svg';
import ExpandAltOutlined from '@/components/ui/icons/expand-diagonal-s-line.react.svg';
import CloseIcon from '@/components/ui/icons/Remix/system/close-line.react.svg';
import MarkdownViewer from '@/components/markdown/MarkdownViewer';
import MarkdownEditor from '@/components/markdown/MarkdownEditor';
import { useQuery } from '@/utils/queries/hooks';
import { useApi } from '@/api';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { dayjs } from '@/utils/dayjs';

export const EDDDetails = (props: { userId: string }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const sidebarWidth = useSidebarWidth();
  const api = useApi();

  const queryResults = useQuery(['edd-reviews', props.userId], async () => {
    const response = await api.getUsersUserIdEddReviews({ userId: props.userId });
    const latestEddReview = response.data.sort((a, b) => {
      return dayjs(b.createdAt).diff(dayjs(a.createdAt));
    })[0];
    setSelectedEddId(latestEddReview.id);
    return response;
  });

  const queryClient = useQueryClient();

  const mutation = useMutation<EDDReview, unknown, EDDReviewUpdateRequest>(
    async (data) => {
      if (!selectedEddId) {
        throw new Error('No EDD review selected');
      }

      const response = await api.patchUsersUserIdEddReviewsEddReviewId({
        userId: props.userId,
        eddReviewId: selectedEddId,
        EDDReviewUpdateRequest: data,
      });
      return response;
    },
    {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: ['edd-reviews', props.userId] });
        setSelectedEddId(data.id);
        setIsEditing(false);
      },
    },
  );

  const [selectedEddId, setSelectedEddId] = useState<string | null>(null);
  const [markdown, setMarkdown] = useState<string>('');
  return (
    <div
      className={`${s.wrapper} ${isExpanded ? s.expanded : ''}`}
      style={isExpanded ? { left: `${sidebarWidth}px` } : {}}
    >
      <div className={s.root}>
        <AsyncResourceRenderer resource={queryResults.data}>
          {(eddReviews) => (
            <div className={s.dropdownContainer}>
              <div className={s.dropdownContainerItem}>
                {eddReviews.data.length > 0 ? (
                  <Dropdown
                    options={eddReviews.data.map((eddReview) => ({
                      label: `EDD Review ${dayjs(eddReview.periodStart).format(
                        'DD MMMM YYYY',
                      )} - ${dayjs(eddReview.periodEnd).format('DD MMMM YYYY')}`,
                      value: eddReview.id,
                    }))}
                    onSelect={(value) => setSelectedEddId(value.value)}
                    optionClassName={s.dropdownOption}
                  >
                    <Button
                      type="TEXT"
                      className={s.dropdownButton}
                      iconRight={<ArrowDownFilled color="black" />}
                    >
                      <H4>
                        EDD Review{' '}
                        {dayjs(
                          eddReviews.data.find((eddReview) => eddReview.id === selectedEddId)
                            ?.periodStart,
                        ).format('DD MMMM YYYY')}{' '}
                        -{' '}
                        {dayjs(
                          eddReviews.data.find((eddReview) => eddReview.id === selectedEddId)
                            ?.periodEnd,
                        ).format('DD MMMM YYYY')}
                      </H4>
                    </Button>
                  </Dropdown>
                ) : (
                  <H4>No EDD reviews found</H4>
                )}
              </div>

              {eddReviews.data.length > 0 && (
                <div className={s.dropdownContainerItem2}>
                  {!isEditing ? (
                    <Button
                      type="TETRIARY"
                      className={s.dropdownButton}
                      icon={<EditLineIcon />}
                      onClick={() => setIsEditing(true)}
                    >
                      Edit
                    </Button>
                  ) : (
                    <Button
                      type="PRIMARY"
                      className={s.dropdownButton}
                      onClick={() => {
                        if (selectedEddId) {
                          mutation.mutate({ review: markdown });
                        }
                      }}
                    >
                      Save
                    </Button>
                  )}
                  <div className={s.expandIconContainer} onClick={() => setIsExpanded(!isExpanded)}>
                    {isExpanded ? <CollapseAltOutlined /> : <ExpandAltOutlined />}
                  </div>
                  <CloseIcon className={s.closeIcon} onClick={() => setIsEditing(false)} />
                </div>
              )}
            </div>
          )}
        </AsyncResourceRenderer>
        <MarkdownSection
          isEditing={isEditing}
          eddId={selectedEddId ?? null}
          userId={props.userId}
          markdown={markdown}
          setMarkdown={setMarkdown}
          isExpanded={isExpanded}
        />
      </div>
    </div>
  );
};

type MarkdownSectionProps = {
  isEditing: boolean;
  eddId: string | null;
  userId: string;
  markdown: string;
  setMarkdown: (markdown: string) => void;
  isExpanded: boolean;
};

const MarkdownSection = (props: MarkdownSectionProps) => {
  const api = useApi();
  const queryResults = useQuery(
    ['edd-review', props.eddId],
    () =>
      api.getUsersUserIdEddReviewsEddReviewId({
        userId: props.userId,
        eddReviewId: props.eddId ?? '',
      }),
    { enabled: !!props.eddId },
  );

  return (
    <AsyncResourceRenderer resource={queryResults.data}>
      {(eddReview) => (
        <div className={s.markdownContainer}>
          {props.isEditing ? (
            <MarkdownEditor
              initialValue={eddReview.review ?? ''}
              onChange={(value) => {
                props.setMarkdown(value);
              }}
              editorHeight={props.isExpanded ? 'FULL' : 200}
            />
          ) : (
            <MarkdownViewer value={eddReview.review ?? ''} />
          )}
        </div>
      )}
    </AsyncResourceRenderer>
  );
};
