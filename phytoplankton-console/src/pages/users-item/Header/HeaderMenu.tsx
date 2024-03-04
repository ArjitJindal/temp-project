import { MoreOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { ManualCaseCreationButton } from '../ManualCaseCreationButton';
import { getUserReportTables } from '../UserReport';
import s from './index.module.less';
import Dropdown from '@/components/library/Dropdown';
import Button from '@/components/library/Button';
import Downloadicon from '@/components/ui/icons/Remix/system/download-line.react.svg';
import { InternalBusinessUser, InternalConsumerUser, RiskLevel, RiskScoreComponent } from '@/apis';
import DownloadAsPDF from '@/components/DownloadAsPdf/DownloadAsPDF';
import { message } from '@/components/library/Message';

export interface RiskScores {
  kycRiskScore?: RiskScore;
  drsRiskScore?: RiskScore;
}

export interface RiskScore {
  score: number;
  riskLevel?: RiskLevel;
  createdAt: number;
  components?: Array<RiskScoreComponent>;
  manualRiskLevel?: RiskLevel;
}

interface Props {
  user: InternalConsumerUser | InternalBusinessUser;
  riskScores: RiskScores;
}

export const HeaderMenu = (props: Props) => {
  const { user, riskScores } = props;
  const [loading, setLoading] = useState(false);
  const handleReportDownload = async (
    user: InternalBusinessUser | InternalConsumerUser,
    riskScores,
  ) => {
    const hideMessage = message.loading('Downloading report...');
    setLoading(true);

    try {
      await DownloadAsPDF({
        fileName: `user-${user.userId}-report.pdf`,
        tableOptions: getUserReportTables(user, riskScores),
        reportTitle: 'User report',
      });
    } catch (err) {
      message.fatal('Unable to complete the download!', err);
    } finally {
      setLoading(false);
      hideMessage && hideMessage();
      message.success('Report successfully downloaded');
    }
  };

  const options = [
    {
      label: (
        <ManualCaseCreationButton userId={user.userId} type={'CREATE'} className={s.optionButton} />
      ),
      value: 'CREATE_CASE',
    },
    {
      label: (
        <Button
          type="TETRIARY"
          className={s.optionButton}
          isDisabled={loading}
          onClick={async () => {
            await handleReportDownload(user, riskScores);
          }}
        >
          {' '}
          <Downloadicon className={s.icon} /> User report
        </Button>
      ),
      value: 'USER_REPORT',
    },
  ];
  return (
    <div>
      <Dropdown options={options} optionClassName={s.option}>
        <Button type="TETRIARY" testName="status-options-button" className={s.button}>
          <MoreOutlined />
        </Button>
      </Dropdown>
    </div>
  );
};
