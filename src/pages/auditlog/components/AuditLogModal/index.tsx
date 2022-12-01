import { Modal, Table, Typography } from 'antd';
import _ from 'lodash';
import { useState } from 'react';
import COLORS from '@/components/ui/colors';
import { AuditLog } from '@/apis';

interface Props {
  data: AuditLog;
}

interface TableTemplateProp {
  details: object[];
}

const RenderModalData = (data: any) => {
  if (data?.length === 0) {
    return <em>Empty</em>;
  } else if (Array.isArray(data)) {
    if (data.length && typeof data[0] === 'object') {
      return <pre>{JSON.stringify(data, null, 2)}</pre>;
    } else {
      return <p>{data.join(', ')}</p>;
    }
  } else if (typeof data === 'object') {
    return <pre>{JSON.stringify(data, null, 2)}</pre>;
  } else {
    return <p>{data}</p>;
  }
};

const TableTemplate = (props: TableTemplateProp) => {
  return (
    <Table
      dataSource={props.details}
      pagination={false}
      style={{ overflowX: 'scroll' }}
      columns={[
        {
          title: 'Parameter Name',
          dataIndex: 'key',
          key: 'key',
          render: (text) => <b>{_.startCase(text)}</b>,
          width: 80,
        },
        {
          title: 'Old Value',
          dataIndex: 'oldImage',
          key: 'oldImage',
          render: (data) => {
            return RenderModalData(data);
          },
          width: 150,
        },
        {
          title: 'New Value',
          dataIndex: 'newImage',
          key: 'newImage',
          render: (data) => {
            return RenderModalData(data);
          },
          width: 150,
        },
      ]}
    />
  );
};

type convertDataReturn = {
  changedDetails: object[];
  notChangedDetails: object[];
};

const convertDataOldImageAndNewImageToArr = (data: AuditLog): convertDataReturn => {
  const changedDetails: object[] = [];
  const notChangedDetails: object[] = [];
  const oldImage = data?.oldImage;
  const newImage = data?.newImage;

  const oldImageKeys = oldImage ? Object.keys(oldImage) : [];
  const newImageKeys = newImage ? Object.keys(newImage) : [];
  const allKeys = _.uniq([...oldImageKeys, ...newImageKeys]);
  allKeys.forEach((key) => {
    const obj = {
      key,
      oldImage: oldImage && oldImage[key] != null ? oldImage[key] : 'N/A',
      newImage: newImage && newImage[key] != null ? newImage[key] : 'N/A',
    };
    if (oldImage && newImage && _.isEqual(oldImage[key], newImage[key])) {
      notChangedDetails.push(obj);
    } else {
      changedDetails.push(obj);
    }
  });
  return { changedDetails, notChangedDetails };
};

const AuditLogModal = (props: Props) => {
  const { data } = props;
  const [isModalVisible, setIsModalVisible] = useState(false);

  const { changedDetails, notChangedDetails } = convertDataOldImageAndNewImageToArr(data);

  return (
    <>
      <Typography.Text
        style={{ color: COLORS.brandBlue.base, cursor: 'pointer' }}
        onClick={() => {
          setIsModalVisible(true);
        }}
      >
        View Changes
      </Typography.Text>
      <Modal
        visible={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        width={'80%'}
        footer={null}
      >
        <div style={{ padding: '1rem', width: '100%' }}>
          {changedDetails.length && (
            <>
              <Typography.Title level={3}>
                {_.startCase(_.toLower(data.type))} Details Changed
              </Typography.Title>
              <TableTemplate details={changedDetails} />
            </>
          )}
          <>
            {notChangedDetails.length > 0 && (
              <div style={{ marginTop: changedDetails.length ? '2rem' : 'auto' }}>
                <Typography.Title level={3}>
                  {_.startCase(_.toLower(data.type))} Details Not Changed
                </Typography.Title>
                <TableTemplate details={notChangedDetails} />
              </div>
            )}
          </>
        </div>
      </Modal>
    </>
  );
};

export default AuditLogModal;
