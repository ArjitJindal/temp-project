import s from './index.module.less';
import * as Card from '@/components/ui/Card';
import { InternalBusinessUser } from '@/apis';
import Calander2LineIcon from '@/components/ui/icons/Remix/business/calendar-2-line.react.svg';
import TransactionIcon from '@/components/ui/icons/transaction.react.svg';

interface Props {
  user: InternalBusinessUser;
}

export default function ExpectedTransactionLimits(props: Props) {
  const { user } = props;
  return (
    <>
      <Card.Row className={s.all}>
        <Card.Column className={s.outer}>
          <Card.Row className={s.row}>
            {
              <div className={s.inner}>
                <div>
                  <Calander2LineIcon className={s.icon} />
                </div>
                <div>Period</div>
              </div>
            }
          </Card.Row>
          <Card.Row className={s.row}>
            {
              <div className={s.inner}>
                <div>
                  <TransactionIcon className={s.icon} />
                </div>
                <div>Transaction Limit</div>
              </div>
            }
          </Card.Row>
        </Card.Column>
        <Card.Column className={s.limit}>
          <Card.Row className={s.row}>{<div className={s.inner}>{'Daily'}</div>}</Card.Row>
          <Card.Row className={s.row}>
            {
              <div className={s.inner}>
                {user.transactionLimits?.maximumDailyTransactionLimit ?? '-'}
              </div>
            }
          </Card.Row>
        </Card.Column>
        <Card.Column className={s.limit}>
          <Card.Row className={s.row}>{<div className={s.inner}>{'Weekly'}</div>}</Card.Row>
          <Card.Row className={s.row}>
            {
              <div className={s.inner}>
                {user.transactionLimits?.maximumWeeklyTransactionLimit ?? '-'}
              </div>
            }
          </Card.Row>
        </Card.Column>
        <Card.Column className={s.limit}>
          <Card.Row className={s.row}>{<div className={s.inner}>{'Monthly'}</div>}</Card.Row>
          <Card.Row className={s.row}>
            {
              <div className={s.inner}>
                {user.transactionLimits?.maximumMonthlyTransactionLimit ?? '-'}
              </div>
            }
          </Card.Row>
        </Card.Column>
        <Card.Column className={s.limit}>
          <Card.Row className={s.row}>{<div className={s.inner}>{'Quarterly'}</div>}</Card.Row>
          <Card.Row className={s.row}>
            {
              <div className={s.inner}>
                {user.transactionLimits?.maximumQuarterlyTransactionLimit ?? '-'}
              </div>
            }
          </Card.Row>
        </Card.Column>
        <Card.Column className={s.limit}>
          <Card.Row className={s.row}>{<div className={s.inner}>{'Yearly'}</div>}</Card.Row>
          <Card.Row className={s.row}>
            {
              <div className={s.inner}>
                {user.transactionLimits?.maximumYearlyTransactionLimit ?? '-'}
              </div>
            }
          </Card.Row>
        </Card.Column>
      </Card.Row>
    </>
  );
}
