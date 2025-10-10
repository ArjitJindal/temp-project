import { useMutation } from '@tanstack/react-query';
import s from './styles.module.less';
import CommentPopover from '@/pages/case-management/AlertTable/InvestigativeCoPilotModal/InvestigativeCoPilot/History/HistoryItem/HistoryItemBase/CommentPopover';
import { DownloadButton } from '@/components/library/Widget';
import ReloadButton from '@/components/library/Table/Header/Tools/ReloadButton';
import { FormValues as CommentEditorFormValues } from '@/components/CommentEditor';
import { useApi } from '@/api';
import { sanitizeComment } from '@/components/markdown/MarkdownEditor/mention-utlis';
import { message } from '@/components/library/Message';
import { getErrorMessage } from '@/utils/lang';
import AiForensicsLogo from '@/components/ui/AiForensicsLogo';

interface Props {
  alertId: string;
  summary: string;
  onReload: () => void;
}

export default function AiAlertSummary(props: Props) {
  const { summary, onReload, alertId } = props;

  const api = useApi();
  const commentSubmitMutation = useMutation<unknown, unknown, CommentEditorFormValues>(
    async (values: CommentEditorFormValues) => {
      return await api.createAlertsComment({
        alertId,
        CommentRequest: { body: sanitizeComment(values.comment), files: values.files },
      });
    },
    {
      onSuccess: () => {
        message.success('Comment added successfully');
      },
      onError: (error) => {
        message.fatal(`Unable to add comment! ${getErrorMessage(error)}`, error);
      },
    },
  );
  return (
    <div className={s.root}>
      <div className={s.header}>
        <div className={s.title}>
          <AiForensicsLogo /> <span>AI alert summary</span>
        </div>
        <div className={s.extraControls}>
          <CommentPopover
            commentSubmitMutation={commentSubmitMutation}
            summary={summary}
            key={alertId}
          />
          <ReloadButton onClick={onReload} />
          <DownloadButton
            onDownload={async () => {
              return {
                fileName: ``,
                data: '',
              };
            }}
          />
        </div>
      </div>
      <div className={s.summary}>{summary}</div>
    </div>
  );
}
