import React, { useState } from 'react';
import { compact } from 'lodash';
import s from './index.module.less';
import ExpandIcon from '@/components/library/ExpandIcon';
import { Small } from '@/components/ui/Typography';
import { dayjs, DEFAULT_DATE_TIME_FORMAT } from '@/utils/dayjs';
import ExpandContainer from '@/components/utils/ExpandContainer';
import { CountryFlag } from '@/components/ui/CountryDisplay';
import { CountryCode, SanctionsEntityType, SanctionsSourceFields } from '@/apis';
import UpdatedTag from '@/components/library/Tag/UpdatedTag';
import DownloadIcon from '@/components/ui/icons/Remix/system/download-2-line.react.svg';
import { downloadLink } from '@/utils/download-link';
import { useApi } from '@/api';
import { message } from '@/components/library/Message';
import LoadingIcon from '@/components/ui/icons/Remix/system/loader-2-line.react.svg';

interface Props {
  title: string | JSX.Element;
  countries: CountryCode[];
  listedTime: [number | undefined, number | undefined];
  isExpandedByDefault?: boolean;
  children: React.ReactNode;
  hasUpdates: boolean;
  pdfMode?: boolean;
  description?: string;
  sanctionsSourceFields?: SanctionsSourceFields[];
}

interface DownloadSourceProps {
  resourceId?: string;
  evidenceId?: string;
  entityType?: SanctionsEntityType;
  sanctionsSourceFields?: SanctionsSourceFields[];
}

export default function ListingCard(props: Props & DownloadSourceProps) {
  const {
    listedTime,
    title,
    countries,
    children,
    isExpandedByDefault = false,
    hasUpdates,
    pdfMode,
    description,
    resourceId,
    evidenceId,
    entityType,
    sanctionsSourceFields,
  } = props;
  const [isExpanded, setIsExpanded] = useState(isExpandedByDefault);
  const nonEmptyTime = compact(listedTime);
  return (
    <div className={s.root}>
      <div className={s.expandIcon}>
        <ExpandIcon
          isExpanded={isExpanded}
          onClick={() => {
            setIsExpanded((prevState) => !prevState);
          }}
        />
      </div>
      <div className={s.children}>
        <div className={s.title}>
          {countries.length > 0 && (
            <div className={s.countries}>
              {countries.map((code) => (
                <CountryFlag key={code} code={code} svg={!pdfMode} />
              ))}
            </div>
          )}
          <div className={s.titleText}>
            {title}
            {!pdfMode && typeof title !== 'string' ? (
              <DownloadButton
                resourceId={resourceId}
                evidenceId={evidenceId}
                entityType={entityType}
                sanctionsSourceFields={sanctionsSourceFields}
              />
            ) : (
              <></>
            )}
          </div>
          {hasUpdates && <UpdatedTag />}
        </div>
        {description && <div>{description}</div>}
        {nonEmptyTime.length > 0 && (
          <Small className={s.listedTime}>
            {nonEmptyTime
              .map((timestamp) => dayjs(timestamp).format(DEFAULT_DATE_TIME_FORMAT))
              .join(' - ')}
          </Small>
        )}
        <ExpandContainer isCollapsed={!isExpanded}>{children}</ExpandContainer>
      </div>
    </div>
  );
}

const DownloadButton = (props: DownloadSourceProps) => {
  const { resourceId, evidenceId, entityType, sanctionsSourceFields } = props;
  const [loading, setLoading] = useState(false);
  const api = useApi();
  const handleDownload = async (
    evidenceId?: string,
    resourceId?: string,
    entityType?: SanctionsEntityType,
    sanctionsSourceFields?: SanctionsSourceFields[],
  ) => {
    if (!resourceId || !evidenceId || !entityType) {
      return;
    }
    setLoading(true);
    message.info('Downloading file...');
    try {
      const response = await api.getAcurisCopywritedSourceDownloadUrl({
        evidenceId,
        resourceId,
        entityType,
      });
      message.success('File downloaded successfully');
      downloadLink(response.url, `${evidenceId}.pdf`, true);
    } catch (error) {
      try {
        const assetField = sanctionsSourceFields?.find((field) => field.name === 'Asset url');
        const url = assetField?.values?.find((value) => value.startsWith('http'));
        if (url) {
          downloadLink(url, `${evidenceId}.pdf`, true);
        } else {
          message.error('Source is not copyrighted and can be directly accessed from Console.');
        }
      } catch (error) {
        message.error('Failed to download file');
      }
    } finally {
      setLoading(false);
    }
  };
  return (
    <>
      {!loading ? (
        <DownloadIcon
          className={s.icon}
          onClick={() => handleDownload(evidenceId, resourceId, entityType, sanctionsSourceFields)}
        />
      ) : (
        <LoadingIcon className={s.icon} />
      )}
    </>
  );
};
