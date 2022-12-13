import React, { useState } from 'react';
import { message, Tooltip } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { dayjs } from '@/utils/dayjs';
import { useApi } from '@/api';
import { TableSearchParams } from '@/pages/case-management/types';
import { ApiException } from '@/apis';
import Button from '@/components/ui/Button';

interface Props {
  disabled: {
    state: boolean;
    reason: string | null;
  };
  onGetFormValues: () => TableSearchParams;
}

export default function ExportButton(props: Props) {
  const { disabled, onGetFormValues } = props;
  const api = useApi();
  const [isBusy, setBusy] = useState(false);
  return (
    <Tooltip title={disabled.reason}>
      <Button
        analyticsName="Export to CSV"
        icon={<DownloadOutlined />}
        type="default"
        disabled={isBusy || disabled.state}
        onClick={async () => {
          const hideMessage = message.loading(`Exporting search results...`, 0);
          setBusy(true);
          try {
            const { timestamp, caseId, rulesHitFilter, rulesExecutedFilter } = onGetFormValues();
            // todo: deduplicate with fetching
            const { downloadUrl } = await api.getTransactionsListExport({
              limit: EXPORT_ENTRIES_LIMIT,
              skip: 0,
              afterTimestamp: timestamp ? dayjs(timestamp[0]).valueOf() : 0,
              beforeTimestamp: timestamp ? dayjs(timestamp[1]).valueOf() : Date.now(),
              filterId: caseId,
              filterRulesHit: rulesHitFilter,
              filterRulesExecuted: rulesExecutedFilter,
              filterOutStatus: 'ALLOW',
            });
            message.success(`Finished! File downloading should start in a moment`);
            window.location.href = downloadUrl;
          } catch (e: unknown) {
            let errorMessage = 'Unknown error';
            if (e instanceof ApiException) {
              // todo: implement proper errors typing
              errorMessage = e.body?.message ?? errorMessage;
            } else if (e instanceof Error && e.message) {
              errorMessage = e.message;
            }
            message.error(`Unable to export! ${errorMessage}`);
          } finally {
            hideMessage();
            setBusy(false);
          }
        }}
      >
        Export to CSV
      </Button>
    </Tooltip>
  );
}
