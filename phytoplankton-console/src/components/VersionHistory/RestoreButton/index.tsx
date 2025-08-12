import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import s from './index.module.less';
import { H4 } from '@/components/ui/Typography';
import Tag from '@/components/library/Tag';
import Button from '@/components/library/Button';
import Confirm from '@/components/utils/Confirm';
import { VersionHistory, VersionHistoryType } from '@/apis';
import { useVersionHistoryItem, useVersionHistoryRestore } from '@/utils/version';
import DownloadLineIcon from '@/components/ui/icons/Remix/system/download-line.react.svg';
import { QueryResult } from '@/utils/queries/types';
import { AsyncResource, match, success, map, init } from '@/utils/asyncResource';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import Tooltip from '@/components/library/Tooltip';
import { RISK_CLASSIFICATION_WORKFLOW_PROPOSAL } from '@/utils/queries/keys';

interface VersionHistoryRestoreButtonProps {
  versionId: string;
  type: VersionHistoryType;
  isActiveCheck: (versionId: string) => boolean;
  navigateUrl: string;
  handleDownload?: (versionHistory: QueryResult<VersionHistory>) => void;
  approvalWorkflows?: {
    pendingProposalRes: QueryResult<unknown>;
    messages: {
      pending: string;
      loading: string;
      failed: string;
      init?: string;
    };
  };
}

export default function VersionHistoryHeader(props: VersionHistoryRestoreButtonProps) {
  const { versionId, type, isActiveCheck, navigateUrl, handleDownload, approvalWorkflows } = props;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const onSuccess = useCallback(() => {
    navigate(navigateUrl);
    queryClient.invalidateQueries(RISK_CLASSIFICATION_WORKFLOW_PROPOSAL());
  }, [navigate, navigateUrl, queryClient]);
  const mutationRiskFactorsRestore = useVersionHistoryRestore(onSuccess);
  const versionHistoryItem = useVersionHistoryItem(type, versionId);
  const isApprovalWorkflowsEnabled = useFeatureEnabled('APPROVAL_WORKFLOWS');

  const isPendingApprovalRes: AsyncResource<boolean> = useMemo(() => {
    if (!isApprovalWorkflowsEnabled) {
      return init();
    }

    if (!approvalWorkflows?.pendingProposalRes) {
      return success(false);
    }

    return map(approvalWorkflows?.pendingProposalRes.data, (value) => value != null);
  }, [approvalWorkflows, isApprovalWorkflowsEnabled]);

  const pendingApprovalMessage: string | undefined = useMemo(
    () =>
      match(isPendingApprovalRes, {
        init: () => approvalWorkflows?.messages.init,
        success: (value) => (value ? approvalWorkflows?.messages.pending : undefined),
        loading: () => approvalWorkflows?.messages.loading,
        failed: (message) => `${approvalWorkflows?.messages.failed} ${message}`,
      }),
    [isPendingApprovalRes, approvalWorkflows],
  );

  return (
    <div className={s.header}>
      <div className={s.title}>
        <H4 bold>Version ID: {versionId}</H4>
        {isActiveCheck(versionId) && <Tag color="green">Active</Tag>}
      </div>
      <div className={s.buttons}>
        {!isActiveCheck(versionId) && (
          <Confirm
            title="Are you sure you want to restore this configuration?"
            text="Please note that restoring this version would keep the configuration but save as a new version."
            onConfirm={(formValues) => {
              mutationRiskFactorsRestore.mutate({
                type,
                versionId,
                comment: formValues.comment || `Restored from version ${versionId}`,
              });
            }}
          >
            {(props) => {
              return (
                <Tooltip title={pendingApprovalMessage}>
                  <Button type="PRIMARY" onClick={props.onClick}>
                    Restore configuration
                  </Button>
                </Tooltip>
              );
            }}
          </Confirm>
        )}
        {handleDownload && (
          <Button
            type="TETRIARY"
            onClick={() => handleDownload(versionHistoryItem)}
            icon={<DownloadLineIcon />}
          >
            Download
          </Button>
        )}
      </div>
    </div>
  );
}
