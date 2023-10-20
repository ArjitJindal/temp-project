import cn from 'clsx';
import { Tooltip } from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';
import s from './index.module.less';
import Avatar from './Avatar';
import OriginIcon from './origin-icon.react.svg';
import DestinationIcon from './destination-icon.react.svg';
import PaymentDetailsComponent, { PaymentDetails } from './PaymentDetails';
import { InternalBusinessUser, InternalConsumerUser, TransactionAmountDetails } from '@/apis';
import * as Card from '@/components/ui/Card';
import * as Form from '@/components/ui/Form';
import { getUserName } from '@/utils/api/users';
import CountryDisplay from '@/components/ui/CountryDisplay';
import Id from '@/components/ui/Id';
import { makeUrl } from '@/utils/routing';

function getUnknownUserTooltipMessage(userId?: string) {
  return userId
    ? `User ${userId} doesn't exist in the system. Please call the user creation API to create the user in order to see the user info.`
    : 'Please include origin/destination user ID when calling our transaction verification API and create the user with the user creation API';
}

interface Props {
  type: 'ORIGIN' | 'DESTINATION';
  user: InternalBusinessUser | InternalConsumerUser | undefined;
  amountDetails: TransactionAmountDetails | undefined;
  paymentDetails: PaymentDetails | undefined;
  userId?: string;
  ipAddress?: string;
}

export default function UserDetails(props: Props) {
  const { type, user, userId, amountDetails, paymentDetails, ipAddress } = props;
  const isDestination = type === 'DESTINATION';
  return (
    <Card.Root className={cn(s.root, s[`type-${type}`])}>
      <Card.Section>
        <div className={s.header}>
          {isDestination ? (
            <>
              <DestinationIcon className={cn(s.icon)} />
              <span>Destination (Receiver)</span>
            </>
          ) : (
            <>
              <OriginIcon className={cn(s.icon)} />
              <span>Origin (Sender)</span>
            </>
          )}
        </div>
        <div className={s.user}>
          <Avatar name={user ? getUserName(user) : undefined} />
          <span>
            {user ? (
              getUserName(user)
            ) : (
              <Tooltip title={getUnknownUserTooltipMessage(userId)}>
                Unknown user <QuestionCircleOutlined />
              </Tooltip>
            )}
          </span>
          {user && (
            <Id
              to={makeUrl('/users/list/:list/:id', {
                list: user.type === 'BUSINESS' ? 'business' : 'consumer',
                id: user.userId,
              })}
            >
              {user.userId}
            </Id>
          )}
        </div>
        {amountDetails && (
          <div className={s.mainInfo}>
            <Form.Layout.Label title={isDestination ? 'Amount received' : 'Amount sent'}>
              {amountDetails.transactionCurrency}{' '}
              {new Intl.NumberFormat().format(amountDetails.transactionAmount ?? NaN)}
            </Form.Layout.Label>
            <Form.Layout.Label title={isDestination ? 'Country received in' : 'Country sent from'}>
              <CountryDisplay isoCode={amountDetails.country}></CountryDisplay>
            </Form.Layout.Label>
            <Form.Layout.Label title={'IP address'}>{ipAddress}</Form.Layout.Label>
          </div>
        )}
        <PaymentDetailsComponent paymentDetails={paymentDetails} />
      </Card.Section>
    </Card.Root>
  );
}
