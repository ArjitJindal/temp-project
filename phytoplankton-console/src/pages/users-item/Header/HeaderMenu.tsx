import { MoreOutlined } from '@ant-design/icons';
import { useMemo, useState } from 'react';
import { ManualCaseCreationButton } from '../ManualCaseCreationButton';
import { getUserReportTables } from '../UserReport';
import s from './index.module.less';
import EditTagsButton from './EditTagsButton';
import Dropdown from '@/components/library/Dropdown';
import Button from '@/components/library/Button';
import Downloadicon from '@/components/ui/icons/Remix/system/download-line.react.svg';
import {
  Comment,
  InternalBusinessUser,
  InternalConsumerUser,
  RiskLevel,
  RiskScoreComponent,
  UserTag,
} from '@/apis';
import DownloadAsPDF from '@/components/DownloadAsPdf/DownloadAsPDF';
import { message } from '@/components/library/Message';
import { useFeatureEnabled, useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import { USERS_ITEM_RISKS_DRS, USERS_ITEM_RISKS_KRS } from '@/utils/queries/keys';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { AsyncResource, all, map } from '@/utils/asyncResource';
import { sortByDate } from '@/components/ui/RiskScoreDisplay';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';

export interface RiskScores {
  kycRiskScore?: RiskScore | null;
  drsRiskScore?: RiskScore | null;
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
  onNewComment: (comment: Comment) => void;
  onNewTags: (tags: UserTag[]) => void;
}

export const HeaderMenu = (props: Props) => {
  const { user, onNewComment, onNewTags } = props;
  const userId = user.userId;
  const isRiskScoringEnabled = useFeatureEnabled('RISK_SCORING');
  const isRiskLevelEnabled = useFeatureEnabled('RISK_LEVELS');
  const api = useApi();
  const drsQueryResult = useQuery(USERS_ITEM_RISKS_DRS(userId), () => {
    return isRiskScoringEnabled ? api.getDrsValue({ userId }) : null;
  });
  const kycQueryResult = useQuery(USERS_ITEM_RISKS_KRS(userId), () => {
    return isRiskScoringEnabled ? api.getKrsValue({ userId }) : null;
  });

  const drsRiskScore: AsyncResource<RiskScore | null> = useMemo(
    () =>
      map(drsQueryResult.data, (v) => {
        const values = v
          ? v.map((x) => ({
              score: x.drsScore,
              manualRiskLevel: x?.manualRiskLevel,
              createdAt: x.createdAt,
              components: x.components,
              riskLevel: x.derivedRiskLevel,
            }))
          : null;
        return values ? sortByDate(values)[values.length - 1] : null;
      }),
    [drsQueryResult.data],
  );

  const kycRiskScore: AsyncResource<RiskScore | null> = useMemo(
    () =>
      map(kycQueryResult.data, (v) =>
        v
          ? {
              score: v.krsScore,
              riskLevel: v.riskLevel,
              components: v.components,
              createdAt: v.createdAt,
            }
          : null,
      ),
    [kycQueryResult.data],
  );

  const riskScoresDetails = all([drsRiskScore, kycRiskScore]);
  const tenantSettings = useSettings();
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
        tableOptions: getUserReportTables(user, riskScores, tenantSettings),
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
        <AsyncResourceRenderer resource={riskScoresDetails}>
          {([drsRiskScore, kycRiskScore]) => {
            return (
              <Button
                type="TETRIARY"
                className={s.optionButton}
                isDisabled={loading}
                onClick={async () => {
                  await handleReportDownload(user, {
                    drsRiskScore: isRiskLevelEnabled ? drsRiskScore : null,
                    kycRiskScore,
                  });
                }}
              >
                {' '}
                <Downloadicon className={s.icon} /> User report
              </Button>
            );
          }}
        </AsyncResourceRenderer>
      ),
      value: 'USER_REPORT',
    },
    {
      label: (
        <EditTagsButton
          user={user}
          onNewComment={onNewComment}
          onTagsUpdated={onNewTags}
          className={s.optionButton}
        />
      ),
      value: 'EDIT_TAGS',
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
