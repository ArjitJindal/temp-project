import React, { forwardRef, useImperativeHandle, useMemo, useState } from 'react';
import { titleCaseWord } from '@flagright/lib/utils/humanize';
import { useFeatureEnabled } from '../AppWrapper/Providers/SettingsProvider';
import PageWrapper, { PageWrapperProps } from '../PageWrapper';
import { Authorized } from '../utils/Authorized';
import Button from '../library/Button';
import Dropdown from '../library/Dropdown';
import Modal from '../library/Modal';
import FilesDraggerInput from '../ui/FilesDraggerInput';
import { CloseMessage, message } from '../library/Message';
import s from './styles.module.less';
import Link from '@/components/ui/Link';
import Toggle from '@/components/library/Toggle';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { getBranding } from '@/utils/branding';
import { SIMULATION_COUNT } from '@/utils/queries/keys';
import Tooltip from '@/components/library/Tooltip';
import Label from '@/components/library/Label';
import { FileInfo } from '@/apis';
import FileListIcon from '@/components/ui/icons/Remix/document/file-list-3-line.react.svg';

export type TopRightSectionRef = {
  refetchSimulationCount: () => void;
};

export type ImportExportType = {
  import: (file: FileInfo) => Promise<void>;
  export: () => void;
  type: 'RULES' | 'RISK_FACTORS';
};

export type VersionHistoryType = {
  url: string;
};

export type TopRightSectionProps = PageWrapperProps & {
  header?: (actionButtons: React.ReactNode) => JSX.Element;
  onSimulationModeChange: (value: boolean | undefined) => void;
  isSimulationModeEnabled: boolean;
  importExport?: ImportExportType;
  versionHistory?: VersionHistoryType;
  className?: string;
};

export const TopRightSection = forwardRef<TopRightSectionRef, TopRightSectionProps>(
  (props, ref) => {
    const api = useApi();
    const isSimulationFeatureEnabled = useFeatureEnabled('SIMULATOR');
    const simulationCountResults = useQuery(SIMULATION_COUNT(), async () => {
      if (!isSimulationFeatureEnabled) {
        return { runJobsCount: 0 };
      }
      return api.getSimulationJobsCount();
    });
    useImperativeHandle(ref, () => ({
      refetchSimulationCount: () => {
        simulationCountResults.refetch();
      },
    }));
    const branding = getBranding();
    const SIMULATOR_DISABLED_TOOLTIP_MESSAGE = useMemo(
      () => `This is an advanced feature. Please contact ${branding.supportEmail} to enable it.`,
      [branding.supportEmail],
    );

    const [uploading, setUploading] = useState(false);
    const [uploadingFile, setUploadingFile] = useState<FileInfo | null>(null);

    let closeMessage: CloseMessage | null = null;

    const uploadModal = (
      <Modal
        title={`Upload ${props.importExport?.type.toLowerCase()}`}
        isOpen={uploading}
        onCancel={() => setUploading(false)}
        onOk={async () => {
          if (uploadingFile) {
            closeMessage = message.loading('Starting import...');
            await props.importExport?.import(uploadingFile);
            closeMessage?.();
            message.info(
              `${titleCaseWord(
                props.importExport?.type ?? 'Job for',
                true,
              )} import started successfully. Changes will be reflected within a few minutes.`,
              { duration: 10000 },
            );
          }
          setUploading(false);
          setUploadingFile(null);
        }}
      >
        <FilesDraggerInput
          accept={['text/plain']}
          size="LARGE"
          singleFile
          onChange={(value) => {
            if (value && value.length > 0) {
              setUploadingFile(value[0]);
              return;
            }
          }}
        />
      </Modal>
    );

    const actionButton = (
      <div className={s.simulationRoot}>
        <Authorized minRequiredResources={['read:::simulator/simulations/*']}>
          <div className={s.right}>
            {props.importExport && (
              <Dropdown<'import' | 'export'>
                options={[
                  { label: 'Import', value: 'import' },
                  { label: 'Export', value: 'export' },
                ]}
                onSelect={(data) => {
                  if (!props.importExport) {
                    return;
                  }

                  if (data.value === 'import') {
                    setUploading(true);
                  } else if (data.value === 'export') {
                    props.importExport.export();
                  }
                }}
                optionClassName={s.jsonButtonOption}
              >
                <Button size="SMALL" type="TETRIARY" className={s.jsonButton}>
                  JSON
                </Button>
              </Dropdown>
            )}
            {props.versionHistory && !props.isSimulationModeEnabled && (
              <Link to={props.versionHistory.url} className={s.history}>
                <FileListIcon className={s.icon} /> Version history
              </Link>
            )}
            {uploadModal}
            <Label label="Simulator" position="RIGHT">
              {!isSimulationFeatureEnabled ? (
                <div>
                  <Tooltip title={SIMULATOR_DISABLED_TOOLTIP_MESSAGE} placement="bottomLeft">
                    <span>
                      <Toggle size="S" isDisabled={true} />
                    </span>
                  </Tooltip>
                </div>
              ) : (
                <Toggle
                  size="S"
                  value={props.isSimulationModeEnabled}
                  onChange={props.onSimulationModeChange}
                  testId="simulation-toggle"
                />
              )}
            </Label>
          </div>
        </Authorized>
      </div>
    );

    return (
      <PageWrapper
        {...props}
        header={props.header && props.header(actionButton)}
        actionButton={actionButton}
        className={props.className}
      >
        {props.children}
      </PageWrapper>
    );
  },
);
