import { Space } from 'antd';
import { useState } from 'react';
import { humanizeConstant } from '@flagright/lib/utils/humanize';
import { useQueryClient } from '@tanstack/react-query';
import ReportStatusTag from './ReportStatusTag';
import MarkdownEditor from '@/components/markdown/MarkdownEditor';
import MarkdownViewer from '@/components/markdown/MarkdownViewer';
import Select from '@/components/library/Select';
import Modal from '@/components/library/Modal';
import { FincenReportValidStatus, NonFincenReportValidStatus, Report, ReportStatus } from '@/apis';
import { useApi } from '@/api';
import { message } from '@/components/library/Message';
import { REPORTS_LIST } from '@/utils/queries/keys';
import { useHasResources } from '@/utils/user-utils';

type StatusUpdate = { status: ReportStatus; statusInfo: string };

export default function ReportStatusChangeModal(props: {
  report?: Report;
  onClose: () => void;
  reportStatuses: FincenReportValidStatus[] | NonFincenReportValidStatus[];
}) {
  const { report, onClose, reportStatuses } = props;
  const [statusInfoEditing, setStatusInfoEditing] = useState<boolean>(false);
  const [statusUpdate, setStatusUpdate] = useState<StatusUpdate | null>(null);
  const api = useApi();
  const queryClient = useQueryClient();
  const canEdit = useHasResources(['write:::reports/generated/*']);
  return (
    <Modal
      title={
        report && (
          <>
            Report {report.id} status - <ReportStatusTag status={report.status} />
          </>
        )
      }
      isOpen={Boolean(report)}
      onCancel={() => {
        setStatusInfoEditing(false);
        onClose();
      }}
      onOk={async () => {
        if (!report || !canEdit) {
          return;
        }
        if (!statusInfoEditing) {
          setStatusInfoEditing(true);
          setStatusUpdate({
            status: report.status,
            statusInfo: report.statusInfo || '',
          });
        } else {
          if (report.id == null) {
            throw new Error(`displayStatusInfoReport.id can not be null`);
          }
          if (statusUpdate == null) {
            throw new Error(`statusUpdate can not be null`);
          }
          try {
            await api.postReportsReportIdStatus({
              reportId: report.id,
              ReportStatusUpdateRequest: statusUpdate,
            });
            await queryClient.invalidateQueries({ queryKey: REPORTS_LIST() });
            setStatusInfoEditing(false);
            onClose();
            message.success('Report status updated successfully');
          } catch (e) {
            message.error(`Failed to save: ${e}`);
          }
        }
      }}
      okText={statusInfoEditing ? 'Save' : 'Edit'}
      hideFooter={!canEdit}
    >
      {statusInfoEditing ? (
        <Space direction="vertical" style={{ width: '100%' }}>
          <Select
            mode="SINGLE"
            style={{ width: 200 }}
            value={statusUpdate?.status}
            options={reportStatuses.map((v) => ({ label: humanizeConstant(v), value: v }))}
            onChange={(v) => {
              if (v != null) {
                setStatusUpdate(
                  (prev) =>
                    prev && {
                      ...prev,
                      status: v,
                    },
                );
              }
            }}
          />
          <MarkdownEditor
            key={report?.id}
            initialValue={statusUpdate?.statusInfo || ''}
            onChange={(v) =>
              setStatusUpdate(
                (prev) =>
                  prev && {
                    ...prev,
                    statusInfo: v || '',
                  },
              )
            }
          />
        </Space>
      ) : (
        <MarkdownViewer
          key={report?.statusInfo}
          value={report?.statusInfo || 'No additional information'}
        />
      )}
    </Modal>
  );
}
