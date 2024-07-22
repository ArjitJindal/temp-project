import { Progress as AntProgress } from 'antd';
import s from './style.module.less';
import Spinner from '@/components/library/Spinner';
import { H4 } from '@/components/ui/Typography';
import dayjs from '@/utils/dayjs';
import { TaskStatusChangeStatusEnum } from '@/apis';

interface Props {
  message?: string;
  progress?: number;
  status: TaskStatusChangeStatusEnum;
  totalEntities?: number;
  width: 'FULL' | 'HALF';
  simulationStartedAt?: number;
}

export const Progress = (props: Props) => {
  const { message, progress, status, totalEntities = 0, width, simulationStartedAt } = props;
  const isFailed = status === 'FAILED';
  const progressValue = Number(progress?.toFixed(2) ?? 0);
  const entitiesProcessed = Math.round(totalEntities * (progressValue / 100));
  const timeElapsed = Date.now() - (simulationStartedAt ?? 0);

  const timeRemaining =
    progressValue > 0 && progressValue < 100 && simulationStartedAt
      ? Math.round(((100 - progressValue) / progressValue) * timeElapsed)
      : 0;
  const durationObj = dayjs.duration(timeRemaining, 'milliseconds');

  const minutes = Math.floor(durationObj.asMinutes());
  const seconds = durationObj.seconds();
  return (
    <div className={s.loadingCard}>
      <div className={width === 'FULL' ? s.widthFull : s.widthHalf}>
        {status === 'IN_PROGRESS' ? (
          <>
            <div className={s.progressInfo}>
              <div className={s.progressDetails}>
                <H4>{progressValue}%</H4>
                {timeRemaining ? (
                  <>
                    <div className={s.divider}></div>
                    <span>
                      About{' '}
                      <b>
                        {minutes}mins and {seconds}secs
                      </b>{' '}
                      remaining
                    </span>
                  </>
                ) : (
                  <></>
                )}
              </div>
              {totalEntities > 0 && (
                <div>
                  Entities simulated -{' '}
                  <b>
                    {entitiesProcessed}/{totalEntities}
                  </b>
                </div>
              )}
            </div>
            <AntProgress percent={progressValue} status="active" showInfo={false} />
            {message && (
              <div className={s.loader}>
                <Spinner size="SMALL" /> {message}
              </div>
            )}
          </>
        ) : (
          <div className={s.failed}>
            {isFailed ? (
              'Failed to load simulation results'
            ) : (
              <>
                <Spinner size="SMALL" /> <span>Initializing simulation...</span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
