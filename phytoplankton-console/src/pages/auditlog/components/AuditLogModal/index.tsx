import { useState } from 'react';
import { startCase, toLower } from 'lodash';
import { humanizeAuto } from '@flagright/lib/utils/humanize';
import s from './index.module.less';
import TableTemplate, { summariseChanges } from '@/pages/auditlog/components/TableTemplate';
import Modal from '@/components/library/Modal';
import { H4 } from '@/components/ui/Typography';

interface Props {
  data: {
    type: string;
    oldImage: object;
    newImage: object;
    showNotChanged?: boolean;
    showOldImage?: boolean;
    metaData?: object;
  };
}

const AuditLogModal = (props: Props) => {
  const { data } = props;
  const [isModalVisible, setIsModalVisible] = useState(false);
  const { changedDetails, notChangedDetails } = summariseChanges(data);
  const { changedDetails: metaDataDetails } = summariseChanges({
    type: 'Meta Data',
    oldImage: {},
    newImage: data.metaData ?? {},
    showNotChanged: false,
  });
  return (
    <>
      <span
        className={s.viewChangesLink}
        onClick={() => {
          setIsModalVisible(true);
        }}
      >
        View changes
      </span>
      <Modal
        isOpen={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        width={'L'}
        hideFooter
        title={`Changes for ${humanizeAuto(data.type)}`}
      >
        <div className={s.modalContent}>
          {changedDetails.length > 0 && (
            <>
              <H4>{startCase(toLower(data.type))} details changed</H4>
              <TableTemplate details={changedDetails} showOldImage={data.showOldImage} />
            </>
          )}
          <>
            {notChangedDetails.length > 0 && (
              <div className={s.section}>
                <H4>{startCase(toLower(data.type))} details not changed</H4>
                <TableTemplate details={notChangedDetails} showOldImage={data.showOldImage} />
              </div>
            )}
          </>
          <>
            {metaDataDetails.length > 0 && (
              <div className={s.section}>
                <H4>{startCase(toLower(data.type))} event meta data</H4>
                <TableTemplate
                  details={metaDataDetails}
                  showOldImage={data.showOldImage}
                  isMetaData={true}
                />
              </div>
            )}
          </>
        </div>
      </Modal>
    </>
  );
};

export default AuditLogModal;
