import { useState } from 'react';
import s from './index.module.less';
import { useSidebarWidth } from './useSidebarWidth';
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
import { useEddReview, useEddReviews, usePatchEddReview } from '@/hooks/api/users';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { dayjs } from '@/utils/dayjs';

export const EDDDetails = (props: { userId: string }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const sidebarWidth = useSidebarWidth();
  const queryResults = useEddReviews(props.userId);

  const mutation = usePatchEddReview(props.userId, () => selectedEddId);

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
  const queryResults = useEddReview(props.userId, props.eddId);

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
