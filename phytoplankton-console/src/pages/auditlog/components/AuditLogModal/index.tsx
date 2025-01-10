import { Typography } from 'antd';
import { useState } from 'react';
import { startCase, toLower } from 'lodash';
import { humanizeAuto } from '@flagright/lib/utils/humanize';
import COLORS from '@/components/ui/colors';
import { AuditLog } from '@/apis';
import TableTemplate, { summariseChanges } from '@/pages/auditlog/components/TableTemplate';
import Modal from '@/components/library/Modal';

interface Props {
  data: AuditLog;
}

const AuditLogModal = (props: Props) => {
  const { data } = props;
  const [isModalVisible, setIsModalVisible] = useState(false);
  const { changedDetails, notChangedDetails } = summariseChanges(data);

  return (
    <>
      <Typography.Text
        style={{ color: COLORS.brandBlue.base, cursor: 'pointer' }}
        onClick={() => {
          setIsModalVisible(true);
        }}
      >
        View changes
      </Typography.Text>
      <Modal
        isOpen={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        width={'L'}
        hideFooter
        title={`Changes for ${humanizeAuto(data.type)}`}
      >
        <div style={{ padding: '1rem', width: '100%' }}>
          {changedDetails.length && (
            <>
              <Typography.Title level={4}>
                {startCase(toLower(data.type))} details changed
              </Typography.Title>
              <TableTemplate details={changedDetails} />
            </>
          )}
          <>
            {notChangedDetails.length > 0 && (
              <div style={{ marginTop: changedDetails.length ? '2rem' : 'auto' }}>
                <Typography.Title level={4}>
                  {startCase(toLower(data.type))} details not changed
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
