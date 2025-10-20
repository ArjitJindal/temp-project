import { PaperClipOutlined } from '@ant-design/icons';
import filesize from 'filesize';
import cn from 'clsx';
import { useState } from 'react';
import DeleteIcon from './delete-icon.react.svg';
import s from './styles.module.less';
import COLORS from '@/components/ui/colors';
import { FileInfo } from '@/apis';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import { P } from '@/components/ui/Typography';
import Button from '@/components/library/Button';
import AiForensicsLogo from '@/components/ui/AiForensicsLogo';

interface Props {
  files: FileInfo[];
  onDeleteFile?: (s3Key: string) => void;
  fixedHeight?: boolean;
  disableMissingLinks?: boolean;
}

export default function FilesList(props: Props) {
  const { files, onDeleteFile, fixedHeight = false, disableMissingLinks = true } = props;
  const summarizationEnabled = useFeatureEnabled('FILES_AI_SUMMARY');
  const isSomeFilesWithSummary = files.some((file) => file.aiSummary != null);
  const [showSummary, setShowSummary] = useState(true);

  if (files.length === 0) {
    return <></>;
  }
  return (
    <div className={cn(s.fileList, fixedHeight && s.fileListContainerFixedHeight)}>
      {!!(summarizationEnabled && isSomeFilesWithSummary) && (
        <div className={s.fileListHeader}>
          <div className={s.headerText}>
            <AiForensicsLogo />
            <P bold variant="m">
              AI attachment summary ({files.length})
            </P>
          </div>
          <div>
            <Button
              className={s.toggleSummaryButton}
              onClick={() => setShowSummary((prev) => !prev)}
              type="TEXT"
              size="SMALL"
            >
              {showSummary ? 'Hide' : 'Show'} summary
            </Button>
          </div>
        </div>
      )}
      {files.map((file) => (
        <div key={file.s3Key}>
          <div className={s.fileAttachmentButton} data-cy="attached-file">
            <div className={s.section}>
              <PaperClipOutlined style={{ color: COLORS.purpleGray.base }} />
              <a
                href={file.downloadLink}
                className={cn(s.downloadLink, {
                  [s.isClickable]: !!file.downloadLink,
                  [s.isDisabled]: disableMissingLinks && !file.downloadLink,
                })}
              >
                {file.filename}
              </a>
              <span className={s.size}>{`(${filesize(file.size)})`}</span>
            </div>
            {onDeleteFile != null && (
              <button className={s.fileListDeleteButton} onClick={() => onDeleteFile(file.s3Key)}>
                <DeleteIcon />
              </button>
            )}
          </div>
          {!!(summarizationEnabled && file.aiSummary != null && showSummary) && (
            <div className={s.aiSummaryContainer}>
              <P variant="s" className={s.aiSummaryText}>
                {file.aiSummary}
              </P>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
