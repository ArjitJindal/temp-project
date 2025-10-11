import { firstLetterUpper } from '@flagright/lib/utils/humanize';
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
  DrsScore,
  KrsScore,
} from '@/apis';
import DownloadAsPDF from '@/components/DownloadAsPdf/DownloadAsPDF';
import { message } from '@/components/library/Message';
import { useFeatureEnabled, useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import { useUserDrs, useUserKrs } from '@/hooks/api';
import { all, getOr, map } from '@/utils/asyncResource';
import { sortByDate } from '@/components/ui/RiskScoreDisplay';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { CommentType } from '@/utils/user-utils';
import { useRiskClassificationScores } from '@/utils/risk-levels';

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
  onNewComment: (newComment: Comment, commentType: CommentType, personId?: string) => void;
  onNewTags: (tags: UserTag[]) => void;
}

export const HeaderMenu = (props: Props) => {
  const { user, onNewComment, onNewTags } = props;
  const userId = user.userId;
  const isRiskScoringEnabled = useFeatureEnabled('RISK_SCORING');
  const isRiskLevelEnabled = useFeatureEnabled('RISK_LEVELS');
  const riskClassificationValues = useRiskClassificationScores();
  const settings = useSettings();
  const drsQueryResult = useUserDrs(userId, { enabled: isRiskScoringEnabled });
  const kycQueryResult = useUserKrs(userId, { enabled: isRiskScoringEnabled });

  const drsRiskScore = useMemo(
    () =>
      map(drsQueryResult.data, (v) => {
        const list: DrsScore[] = Array.isArray(v)
          ? v
          : getOr(drsQueryResult.data as any, [] as DrsScore[]);
        const values = list.length
          ? list.map((x) => ({
              score: x.drsScore,
              manualRiskLevel: (x as any)?.manualRiskLevel,
              createdAt: x.createdAt,
              components: x.components,
              riskLevel: (x as any).derivedRiskLevel,
            }))
          : null;
        return values ? sortByDate(values)[values.length - 1] : null;
      }),
    [drsQueryResult.data],
  );

  const kycRiskScore = useMemo(
    () =>
      map(kycQueryResult.data, (v) => {
        const k: KrsScore | null = v as any;
        return k
          ? {
              score: k.krsScore,
              riskLevel: k.riskLevel,
              components: k.components,
              createdAt: k.createdAt,
            }
          : null;
      }),
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
        tableOptions: getUserReportTables(
          user,
          riskScores,
          tenantSettings,
          riskClassificationValues,
        ),
        reportTitle: `${firstLetterUpper(settings.userAlias)} report`,
      });
      message.success('Report downloaded successfully');
    } catch (err) {
      message.fatal('Unable to complete the download!', err);
    } finally {
      setLoading(false);
      hideMessage && hideMessage();
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
                <Downloadicon className={s.icon} /> Export
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
        <Button type="TETRIARY" testName="status-options-button" icon={<MoreOutlined />} />
      </Dropdown>
    </div>
  );
};
