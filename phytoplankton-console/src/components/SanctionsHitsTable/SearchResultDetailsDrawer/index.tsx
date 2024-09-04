import React, { useEffect, useMemo, useState } from 'react';
import { LoadingOutlined } from '@ant-design/icons';
import { groupBy, startCase, uniq } from 'lodash';
import DownloadAsPDF from '../../DownloadAsPdf/DownloadAsPDF';
import s from './index.module.less';
import ListingCard from './ListingCard';
import Section from './Section';
import { ADVERSE_MEDIA, normalizeAmlTypes, TABS_ORDER } from './helpers';
import SanctionsComparison from './SanctionsComparison';
import { getComparisonItems } from './SanctionsComparison/helpers';
import {
  ComplyAdvantageSearchHitDoc,
  ComplyAdvantageSearchHitDocFields,
  SanctionsHit,
  SanctionsHitStatus,
} from '@/apis';
import * as Form from '@/components/ui/Form';
import LinkIcon from '@/components/ui/icons/Remix/system/external-link-line.react.svg';
import DownloadLineIcon from '@/components/ui/icons/Remix/system/download-line.react.svg';
import ArrowRightSLineIcon from '@/components/ui/icons/Remix/system/arrow-right-s-line.react.svg';
import ArrowLeftSLineIcon from '@/components/ui/icons/Remix/system/arrow-left-s-line.react.svg';
import { message } from '@/components/library/Message';
import Drawer from '@/components/library/Drawer';
import Button from '@/components/library/Button';
import Tabs from '@/components/library/Tabs';
import { humanizeAuto } from '@/utils/humanize';
import FieldValue from '@/components/SanctionsHitsTable/SearchResultDetailsDrawer/FieldValue';
import { P } from '@/components/ui/Typography';
import Portal from '@/components/library/Portal';
import TimestampDisplay from '@/components/ui/TimestampDisplay';
import AISummary from '@/pages/case-management/AlertTable/InvestigativeCoPilotModal/InvestigativeCoPilot/History/HistoryItem/HistoryItemBase/AISummary';
import CountryDisplay from '@/components/ui/CountryDisplay';
import Tag from '@/components/library/Tag';
import { notEmpty } from '@/utils/array';
import { AsyncResource, getOr, isSuccess } from '@/utils/asyncResource';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';

interface Props {
  hitRes: AsyncResource<SanctionsHit | undefined>;
  searchedAt?: number;
  onClose: () => void;
  newStatus?: SanctionsHitStatus;
  onChangeStatus?: (newStatus: SanctionsHitStatus) => void;
  showNavigation?: boolean;
  onNext?: () => void;
  onPrev?: () => void;
}

export default function SearchResultDetailsDrawer(props: Props) {
  const { hitRes, onClose, newStatus, onChangeStatus, showNavigation, onNext, onPrev } = props;

  const hit = getOr(hitRes, undefined);

  const [pdfRef, setPdfRef] = useState<HTMLDivElement | null>(null);
  const pdfName = hit?.caEntity?.name;
  const [isDownloading, setDownloading] = useState<boolean>(false);
  const handleDownloadClick = async () => {
    setDownloading(true);
  };
  useEffect(() => {
    async function job() {
      if (isDownloading && pdfRef) {
        try {
          await DownloadAsPDF({ pdfRef, fileName: `${pdfName} Screening Details.pdf` });
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
      title={
        <div className={s.title}>
          {pdfName ?? ''}
          {hit?.status === 'OPEN' && <Tag color="purple">Human review</Tag>}
        </div>
      }
      isVisible={Boolean(hit)}
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
          {showNavigation && (
            <>
              <Button
                type="SECONDARY"
                onClick={onPrev}
                isDisabled={onPrev == null}
                icon={<ArrowLeftSLineIcon />}
              >
                {'Previous hit'}
              </Button>
              <Button
                type="SECONDARY"
                onClick={onNext}
                isDisabled={onNext == null}
                iconRight={<ArrowRightSLineIcon />}
              >
                {'Next hit'}
              </Button>
            </>
          )}
        </>
      }
      footerRight={
        <>
          <Button isDisabled={!isSuccess(hitRes)} type="PRIMARY" onClick={handleDownloadClick}>
            {okText}
          </Button>
          {onChangeStatus && newStatus && (
            <Button
              isDisabled={!isSuccess(hitRes)}
              type="PRIMARY"
              onClick={() => onChangeStatus(newStatus)}
            >
              {newStatus === 'CLEARED' && 'Clear'}
              {newStatus === 'OPEN' && 'Re-open'}
            </Button>
          )}
        </>
      }
    >
      <AsyncResourceRenderer resource={hitRes}>
        {(hit) =>
          hit != null ? (
            <div className={s.sections}>
              <Content {...props} hit={hit} />
              {isDownloading && (
                <Portal>
                  <div style={{ position: 'fixed', opacity: 0, pointerEvents: 'none' }}>
                    <div ref={setPdfRef}>
                      <Content {...props} pdfMode={true} hit={hit} />
                    </div>
                  </div>
                </Portal>
              )}
            </div>
          ) : (
            <></>
          )
        }
      </AsyncResourceRenderer>
    </Drawer>
  );
}

function Content(props: { hit: SanctionsHit; pdfMode?: boolean; searchedAt?: number }) {
  const { hit, pdfMode = false, searchedAt } = props;
  const comparisonItems = getComparisonItems(hit);

  const nameMatched =
    hit.caMatchTypesDetails?.some((x) => (x.name_matches?.length ?? 0) > 0) ?? false;
  const dateMatched =
    hit.caMatchTypesDetails?.some((x) => (x.secondary_matches?.length ?? 0) > 0) ?? false;

  return (
    <>
      {hit.status === 'OPEN' && <AISummary text={makeStubAiText(hit)} />}
      {searchedAt && (
        <Section title={'Searched at'}>
          {searchedAt ? <TimestampDisplay timestamp={searchedAt} /> : 'N/A'}
        </Section>
      )}
      {comparisonItems.length > 0 && <SanctionsComparison items={comparisonItems} />}
      {hit.caEntity && (
        <CAEntityDetails
          dateMatched={dateMatched}
          nameMatched={nameMatched}
          caEntity={hit.caEntity}
          pdfMode={pdfMode}
        />
      )}
    </>
  );
}

export function CAEntityDetails(props: {
  caEntity: ComplyAdvantageSearchHitDoc;
  nameMatched?: boolean;
  dateMatched?: boolean;
  pdfMode?: boolean;
}) {
  const { caEntity, nameMatched = false, dateMatched = false, pdfMode = false } = props;
  const allFields = useMemo(
    () => caEntity?.fields?.sort((a, b) => a.name?.localeCompare(b?.name ?? '') || 0) || [],
    [caEntity?.fields],
  );
  const tabItems = useTabs(caEntity, allFields, pdfMode);

  const extractedFields = extractInformationFromFields(allFields, [
    ...(dateMatched ? [] : ['Date of Birth']),
    'Gender',
    'Country',
  ]);

  return (
    <>
      <Section title={'Key information'}>
        <div className={s.keyInformation}>
          {!nameMatched && (
            <Form.Layout.Label title={'Full name'}>{caEntity?.name}</Form.Layout.Label>
          )}
          <Form.Layout.Label title={'Entity type'}>
            {startCase(caEntity?.entity_type)}
          </Form.Layout.Label>
          <Form.Layout.Label title={'Aliases'}>
            {uniq(caEntity?.aka?.map((item) => item.name)).join(', ')}
          </Form.Layout.Label>
          {extractedFields.map(({ name, values }) => (
            <Form.Layout.Label key={name} title={name}>
              <Values caEntity={caEntity} name={name} values={values} />
            </Form.Layout.Label>
          ))}
          {caEntity?.associates?.length && (
            <Form.Layout.Label title={'Other associates'}>
              <div>
                {caEntity.associates.map(({ association, name }, i) => (
                  <React.Fragment key={i}>
                    {i !== 0 && ', '}
                    <span>
                      {name} ({association})
                    </span>
                  </React.Fragment>
                ))}
              </div>
            </Form.Layout.Label>
          )}
        </div>
      </Section>
      {pdfMode ? (
        tabItems.map((item) => <Tabs key={item.key} items={[item]} />)
      ) : (
        <Tabs items={tabItems} />
      )}
    </>
  );
}

function Values(props: {
  caEntity: ComplyAdvantageSearchHitDoc;
  name: string;
  values: {
    value: unknown;
    sources: string[];
  }[];
}) {
  const { caEntity, name, values } = props;
  if (name === 'Country') {
    return (
      <div className={s.countryList}>
        {values.map(({ value, sources }, i) => (
          <CountryDisplay
            key={i}
            countryName={typeof value === 'string' ? value : undefined}
            htmlTitle={`Sources: ${sources
              .map((source) => caEntity?.source_notes?.[source]?.name ?? source)
              .join(', ')}`}
          />
        ))}
      </div>
    );
  }
  return (
    <div>
      {values.map(({ value, sources }, i) => (
        <React.Fragment key={i}>
          {i !== 0 && ', '}
          <span
            title={`Sources: ${sources
              .map((source) => caEntity?.source_notes?.[source]?.name ?? source)
              .join(', ')}`}
          >
            {value}
          </span>
        </React.Fragment>
      ))}
    </div>
  );
}

/*
  Helpers
 */

function extractInformationFromFields(
  allFields: ComplyAdvantageSearchHitDocFields[],
  fieldNamesToExtract: string[],
): {
  name: string;
  values: {
    value: unknown;
    sources: string[];
  }[];
}[] {
  const groups = groupBy(allFields, 'name');
  const prepared = Object.entries(groups).map(([name, fields]) => ({
    name,
    values: Object.entries(groupBy(fields, 'value')).map(([value, fields]) => ({
      value,
      sources: fields.map(({ source }) => source).filter(notEmpty),
    })),
  }));
  return prepared.filter(({ name }) => {
    return fieldNamesToExtract.includes(name);
  });
}

function makeStubAiText(hit: SanctionsHit): string {
  const hasNameMatches = hit.caMatchTypes.some((x) =>
    [
      'name_exact',
      'aka_exact',
      'name_fuzzy',
      'aka_fuzzy',
      'phonetic_name',
      'phonetic_aka',
      'equivalent_name',
      'equivalent_aka',
      'unknown',
      'removed_personal_title',
      'removed_personal_suffix',
      'removed_organisation_prefix',
      'removed_organisation_suffix',
      'removed_clerical_mark',
      'name_variations_removal',
    ].includes(x),
  );
  const hasDateMatches = hit.caMatchTypes.some((x) => ['year_of_birth'].includes(x));
  if (hasNameMatches && hasDateMatches) {
    return 'Date of birth and name match and hit requires human review';
  } else if (hasNameMatches) {
    return 'Name matches and hit requires human review';
  } else if (hasDateMatches) {
    return 'Date of birth match and hit requires human review';
  }
  return 'Hit requires human review';
}

function useTabs(
  caEntity: ComplyAdvantageSearchHitDoc,
  allFields: ComplyAdvantageSearchHitDocFields[],
  pdfMode,
) {
  return useMemo(() => {
    const sourceGroupes: {
      [key: string]: { sourceName: string; fields: ComplyAdvantageSearchHitDocFields[] }[];
    } = {};
    for (const source of caEntity?.sources || []) {
      const amlTypes = normalizeAmlTypes(caEntity?.source_notes?.[source]?.aml_types ?? []);
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
                const sourceNote = caEntity?.source_notes?.[source.sourceName];
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
                        {caEntity?.media?.map((media) => (
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
  }, [allFields, caEntity, pdfMode]);
}
