import cn from 'clsx';
import { Tooltip } from 'antd';
import { firstLetterUpper } from '@flagright/lib/utils/humanize';
import { QuestionCircleOutlined } from '@ant-design/icons';
import React from 'react';
import s from './index.module.less';
import Avatar from './Avatar';
import OriginIcon from './origin-icon.react.svg';
import DestinationIcon from './destination-icon.react.svg';
import {
  DeviceData,
  InternalBusinessUser,
  InternalConsumerUser,
  TransactionAmountDetails,
} from '@/apis';
import * as Card from '@/components/ui/Card';
import * as Form from '@/components/ui/Form';
import { getUserName } from '@/utils/api/users';
import CountryDisplay from '@/components/ui/CountryDisplay';
import Id from '@/components/ui/Id';
import { makeUrl } from '@/utils/routing';
import Money from '@/components/ui/Money';
import PaymentDetailsProps from '@/components/ui/PaymentDetailsProps';
import { PaymentDetails } from '@/utils/api/payment-details';
import DeviceDataProps from '@/components/ui/DeviceDataProps';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';

function getUnknownUserTooltipMessage(userId?: string, userAlias?: string) {
  return userId
    ? `${firstLetterUpper(
        userAlias,
      )} ${userId} doesn't exist in the system. Please call the user creation API to create the ${userAlias} in order to see the ${userAlias} info.`
    : `Please include origin/destination ${userAlias} ID when calling our transaction verification API and create the ${userAlias} with the user creation API`;
}

interface Props {
  type: 'ORIGIN' | 'DESTINATION';
  user: InternalBusinessUser | InternalConsumerUser | undefined;
  amountDetails: TransactionAmountDetails | undefined;
  paymentDetails: PaymentDetails | undefined;
  userId?: string;
  deviceData?: DeviceData;
  currentRef?: React.RefObject<HTMLDivElement>;
  otherRef?: React.RefObject<HTMLDivElement>;
}

export default function UserDetails(props: Props) {
  const { type, user, userId, amountDetails, paymentDetails, deviceData, currentRef, otherRef } =
    props;
  const settings = useSettings();

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
              <Tooltip title={getUnknownUserTooltipMessage(userId, settings.userAlias)}>
                Unknown {settings.userAlias} <QuestionCircleOutlined />
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
        <div className={s.mainInfo}>
          {amountDetails && (
            <>
              <Form.Layout.Label title={isDestination ? 'Amount received' : 'Amount sent'}>
                <Money transactionAmount={amountDetails} />
              </Form.Layout.Label>
              <Form.Layout.Label
                title={isDestination ? 'Country received in' : 'Country sent from'}
              >
                <CountryDisplay isoCode={amountDetails.country}></CountryDisplay>
              </Form.Layout.Label>
            </>
          )}
        </div>
        <Card.Root>
          <Card.Section>
            <PaymentDetailsProps
              paymentDetails={paymentDetails}
              currentRef={currentRef}
              otherRef={otherRef}
            />
          </Card.Section>
        </Card.Root>
        {deviceData && (
          <Card.Root>
            <Card.Section>
              <DeviceDataProps deviceData={deviceData} />
            </Card.Section>
          </Card.Root>
        )}
      </Card.Section>
    </Card.Root>
  );
}
