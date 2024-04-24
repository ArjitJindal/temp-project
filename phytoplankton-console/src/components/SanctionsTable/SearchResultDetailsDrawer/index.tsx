import React, { useState, useMemo, useEffect } from 'react';
import { LoadingOutlined } from '@ant-design/icons';
import { startCase, groupBy, uniq } from 'lodash';
import DownloadAsPDF from '../../DownloadAsPdf/DownloadAsPDF';
import s from './index.module.less';
import ListingCard from './ListingCard';
import Section from './Section';
import { normalizeAmlTypes, ADVERSE_MEDIA, TABS_ORDER } from './helpers';
import { ComplyAdvantageSearchHit, ComplyAdvantageSearchHitDocFields } from '@/apis';
import * as Form from '@/components/ui/Form';
import LinkIcon from '@/components/ui/icons/Remix/system/external-link-line.react.svg';
import DownloadLineIcon from '@/components/ui/icons/Remix/system/download-line.react.svg';
import { message } from '@/components/library/Message';
import Drawer from '@/components/library/Drawer';
import Button from '@/components/library/Button';
import Tabs from '@/components/library/Tabs';
import { humanizeAuto } from '@/utils/humanize';
import FieldValue from '@/components/SanctionsTable/SearchResultDetailsDrawer/FieldValue';
import { P } from '@/components/ui/Typography';
import Portal from '@/components/library/Portal';
import TimestampDisplay from '@/components/ui/TimestampDisplay';

interface Props {
  hit: ComplyAdvantageSearchHit;
  searchedAt?: number;
  onClose: () => void;
}

export default function SearchResultDetailsDrawer(props: Props) {
  const { hit, onClose } = props;
  const allFields = useMemo(
    () => hit.doc?.fields?.sort((a, b) => a.name?.localeCompare(b?.name ?? '') || 0) || [],
    [hit.doc?.fields],
  );

  const [pdfRef, setPdfRef] = useState<HTMLDivElement | null>(null);
  const pdfName = hit.doc?.name;
  const [isDownloading, setDownloading] = useState<boolean>(false);
  const handleDownloadClick = async () => {
    setDownloading(true);
  };
  useEffect(() => {
    async function job() {
      if (isDownloading && pdfRef) {
        try {
          await DownloadAsPDF({ pdfRef, fileName: `${pdfName} Sanctions Details.pdf` });
        } catch (err) {
          message.fatal(`Unable to complete the download!`, err);
        } finally {
          setDownloading(false);
        }
      }
    }
    job();
  }, [isDownloading, pdfRef, pdfName]);
  const okText = isDownloading ? (
    <>
      <LoadingOutlined className={s.spinner} spin /> Downloading
    </>
  ) : (
    <>
      <DownloadLineIcon className={s.icon} /> Download as PDF
    </>
  );
  return (
    <Drawer
      title={pdfName ?? ''}
      isVisible={Boolean(hit)}
      isClickAwayEnabled={true}
      onChangeVisibility={(isShown) => {
        if (!isShown) {
          onClose();
        }
      }}
      footer={
        <>
          <Button type="SECONDARY" onClick={onClose}>
            {'Close'}
          </Button>
          <Button type="PRIMARY" onClick={handleDownloadClick}>
            {okText}
          </Button>
        </>
      }
    >
      <div className={s.sections}>
        <Content {...props} allFields={allFields} />
        {isDownloading && (
          <Portal>
            <div style={{ position: 'fixed', opacity: 0, pointerEvents: 'none' }}>
              <div ref={setPdfRef}>
                <Content {...props} allFields={allFields} pdfMode={true} />
              </div>
            </div>
          </Portal>
        )}
      </div>
    </Drawer>
  );
}

function Content(props: {
  hit: ComplyAdvantageSearchHit;
  allFields: ComplyAdvantageSearchHitDocFields[];
  pdfMode?: boolean;
  searchedAt?: number;
}) {
  const { hit, allFields, pdfMode = false, searchedAt } = props;
  const keyInfoFields = allFields.filter((field) => !field.source);
  const tabItems = useTabs(hit, allFields, pdfMode);
  return (
    <>
      <Section title={'Searched at'}>
        {searchedAt ? <TimestampDisplay timestamp={searchedAt} /> : 'N/A'}
      </Section>
      <Section title={'Key information'}>
        <div className={s.keyInformation}>
          <Form.Layout.Label title={'Full name'}>{hit.doc?.name}</Form.Layout.Label>
          <Form.Layout.Label title={'Entity type'}>
            {startCase(hit.doc?.entity_type)}
          </Form.Layout.Label>
          <Form.Layout.Label title={'Entity type'}>
            {startCase(hit.doc?.entity_type)}
          </Form.Layout.Label>
          <Form.Layout.Label title={'Aliases'}>
            {uniq(hit.doc?.aka?.map((item) => item.name)).join(', ')}
          </Form.Layout.Label>
          {keyInfoFields.map((field) =>
            field.name ? (
              <Form.Layout.Label key={field.name} title={field.name}>
                {field.value}
              </Form.Layout.Label>
            ) : (
              <></>
            ),
          )}
        </div>
      </Section>
      <div className={s.separator} />
      <Section title={'Listing'}>
        {pdfMode ? (
          tabItems.map((item) => <Tabs key={item.key} items={[item]} />)
        ) : (
          <Tabs items={tabItems} />
        )}
      </Section>
    </>
  );
}

/*
  Helpers
 */
function useTabs(
  hit: ComplyAdvantageSearchHit,
  allFields: ComplyAdvantageSearchHitDocFields[],
  pdfMode,
) {
  return useMemo(() => {
    const sourceGroupes: {
      [key: string]: { sourceName: string; fields: ComplyAdvantageSearchHitDocFields[] }[];
    } = {};
    for (const source of hit.doc?.sources || []) {
      const amlTypes = normalizeAmlTypes(hit.doc?.source_notes?.[source]?.aml_types ?? []);
      for (const amlType of amlTypes) {
        sourceGroupes[amlType] = [
          ...(sourceGroupes[amlType] ?? []),
          {
            sourceName: source,
            fields: allFields?.filter((field) => field.source === source),
          },
        ];
      }
    }
    return [
      ...Object.entries(sourceGroupes)
        .sort(
          ([x], [y]) =>
            (TABS_ORDER.indexOf(x) || Number.MAX_SAFE_INTEGER) -
            (TABS_ORDER.indexOf(y) || Number.MAX_SAFE_INTEGER),
        )
        .map(([groupKey, sources]) => ({
          key: groupKey,
          title: `${humanizeAuto(groupKey)} (${sources.length})`,
          children: (
            <div className={s.listingItems}>
              {sources.map((source) => {
                const sourceNote = hit.doc?.source_notes?.[source.sourceName];
                const sourceTitle = sourceNote?.url ? (
                  <a href={sourceNote?.url} target="_blank">
                    {sourceNote?.name}
                  </a>
                ) : (
                  sourceNote?.name
                );

                return (
                  <ListingCard
                    key={sourceNote?.name}
                    countries={uniq(sourceNote.country_codes ?? [])}
                    title={sourceTitle}
                    listedTime={[sourceNote?.listing_started_utc, sourceNote?.listing_ended_utc]}
                    isExpandedByDefault={pdfMode}
                  >
                    {groupKey === ADVERSE_MEDIA ? (
                      <div className={s.adverseMediaList}>
                        {hit.doc?.media?.map((media) => (
                          <div key={media.title}>
                            <P>
                              <a href={media.url} target="_blank" className={s.link}>
                                <span>{media.title}</span> <LinkIcon height={16} />
                              </a>
                            </P>
                            <P grey={true} variant="xs">
                              {media.snippet}
                            </P>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className={s.fieldGrid}>
                        {Object.entries(groupBy(source.fields, (x) => x.name)).map(
                          ([name, fields]) => (
                            <React.Fragment key={name}>
                              <Form.Layout.Label title={name ?? '(Unknown field)'} />
                              <div>
                                {fields.map((field) => (
                                  <div key={field.value}>
                                    <FieldValue field={field} />
                                  </div>
                                ))}
                              </div>
                            </React.Fragment>
                          ),
                        )}
                      </div>
                    )}
                  </ListingCard>
                );
              })}
            </div>
          ),
        })),
    ];
  }, [allFields, hit, pdfMode]);
}
