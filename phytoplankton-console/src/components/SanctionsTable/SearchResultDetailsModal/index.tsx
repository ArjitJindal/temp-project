import { useRef } from 'react';
import { Modal, Space, Tag } from 'antd';
import _ from 'lodash';
import ProDescriptions from '@ant-design/pro-descriptions';
import s from './index.module.less';
import SearchResultDetailsModalFooter from './SearchResultDetailsModalFooter';
import { ComplyAdvantageSearchHit } from '@/apis/models/ComplyAdvantageSearchHit';
import * as Card from '@/components/ui/Card';
import EntityHeader from '@/components/ui/entityPage/EntityHeader';
import * as Form from '@/components/ui/Form';
import LinkIcon from '@/components/ui/icons/Remix/system/external-link-line.react.svg';

interface Props {
  hit: ComplyAdvantageSearchHit;
  onClose: () => void;
}

export default function SearchResultDetailsModal(props: Props) {
  const { hit, onClose } = props;
  const allFields = hit.doc?.fields?.sort((a, b) => a.name?.localeCompare(b.name!) || 0) || [];
  const keyInfoFields = allFields.filter((field) => !field.source);
  const sourceFields = (hit.doc?.sources || []).map((source) => ({
    source,
    fields: allFields?.filter((field) => field.source === source),
  }));
  const pdfRef = useRef() as React.MutableRefObject<HTMLInputElement>;
  return (
    <Modal
      className={s.modal}
      width={1500}
      visible={Boolean(hit)}
      onCancel={onClose}
      footer={
        <SearchResultDetailsModalFooter onClose={onClose} pdfRef={pdfRef} pdfName={hit.doc?.name} />
      }
    >
      <div ref={pdfRef}>
        <Card.Section>
          <EntityHeader idTitle={'Name'} id={hit.doc?.name}>
            <Form.Layout.Label title="Matched Types">
              {hit.doc?.types?.map((matchType) => (
                <Tag key={matchType} color="volcano">
                  {_.startCase(matchType)}
                </Tag>
              ))}
            </Form.Layout.Label>
          </EntityHeader>
        </Card.Section>
        <Card.Root
          header={{
            title: 'Key Information',
          }}
        >
          <Card.Section>
            <ProDescriptions column={1} colon={false} layout="horizontal">
              <ProDescriptions.Item label={<b>Full Name</b>} valueType="text">
                {hit.doc?.name}
              </ProDescriptions.Item>
              <ProDescriptions.Item label={<b>Entity Type</b>} valueType="text">
                {_.startCase(hit.doc?.entity_type)}
              </ProDescriptions.Item>
              <ProDescriptions.Item label={<b>AKA</b>} valueType="text">
                {hit.doc?.aka?.map((item) => item.name).join(', ')}
              </ProDescriptions.Item>
              {keyInfoFields.map((field) => (
                <ProDescriptions.Item key={field.name} label={<b>{field.name}</b>}>
                  {field.value}
                </ProDescriptions.Item>
              ))}
            </ProDescriptions>
          </Card.Section>
        </Card.Root>
        <br />
        <Card.Root
          header={{
            title: 'Listing',
          }}
        >
          {sourceFields.map((source) => {
            const sourceNote = hit.doc?.source_notes?.[source.source];
            const isRemoved = Boolean(sourceNote?.listing_ended_utc);
            const listedTime = [
              sourceNote?.listing_started_utc
                ? new Date(sourceNote?.listing_started_utc).toDateString()
                : '',
              sourceNote?.listing_ended_utc
                ? new Date(sourceNote?.listing_ended_utc).toDateString()
                : '',
            ].join(' - ');
            return (
              <Card.Section key={source.source}>
                <ProDescriptions column={1} colon={false} layout="horizontal">
                  <ProDescriptions.Item>
                    {sourceNote?.aml_types?.map((matchType: string) => (
                      <Tag key={matchType} color="volcano">
                        {_.startCase(matchType)}
                      </Tag>
                    ))}
                  </ProDescriptions.Item>
                  <ProDescriptions.Item label={<b>Source</b>}>
                    <Space>
                      {sourceNote?.url ? (
                        <a href={sourceNote?.url}>{sourceNote?.name}</a>
                      ) : (
                        sourceNote?.name
                      )}
                      <Tag color={isRemoved ? 'green' : 'red'}>
                        {isRemoved ? 'Removed' : 'Live'}
                      </Tag>
                    </Space>
                  </ProDescriptions.Item>
                  <ProDescriptions.Item label={<b>Listed Dates</b>}>
                    {listedTime}
                  </ProDescriptions.Item>
                  {source.fields.map((field) => (
                    <ProDescriptions.Item key={field.name} label={<b>{field.name}</b>}>
                      {field.value}
                    </ProDescriptions.Item>
                  ))}
                </ProDescriptions>
              </Card.Section>
            );
          })}
        </Card.Root>
        <br />
        <Card.Root
          header={{
            title: 'Adverse Media',
          }}
        >
          {hit.doc?.media?.map((media) => {
            return (
              <Card.Section key={media.title}>
                <ProDescriptions column={1} colon={false} layout="horizontal">
                  <ProDescriptions.Item>
                    <Space>
                      <a href={media.url} target="_blank" className={s.link}>
                        <span>{media.title}</span> <LinkIcon height={16} />
                      </a>
                    </Space>
                  </ProDescriptions.Item>
                  <ProDescriptions.Item>{media.snippet}</ProDescriptions.Item>
                </ProDescriptions>
              </Card.Section>
            );
          })}
        </Card.Root>
      </div>
    </Modal>
  );
}
