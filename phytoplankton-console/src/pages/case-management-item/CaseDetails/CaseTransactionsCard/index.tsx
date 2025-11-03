import { useState } from 'react';
import { Link } from 'react-router-dom';
import s from './index.module.less';
import { CaseType, InternalBusinessUser, InternalConsumerUser, MissingUser } from '@/apis';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import TransactionsTable, {
  TransactionsTableParams,
} from '@/pages/transactions/components/TransactionsTable';
import * as Card from '@/components/ui/Card';
import Button from '@/components/library/Button';
import { P } from '@/components/ui/Typography';
import AddLine from '@/components/ui/icons/Remix/system/add-line.react.svg';
import { keepBackUrl } from '@/utils/backUrl';
import { makeUrl } from '@/utils/routing';
import { useCaseTransactionsList } from '@/utils/api/transactions';

type Props = {
  caseId: string;
  caseType: CaseType;
  caseTransactionsCount: number;
  user: InternalConsumerUser | InternalBusinessUser | MissingUser;
};

export const CaseTransactionsCard = (props: Props) => {
  const { caseTransactionsCount, caseType, caseId, user } = props;
  const [tableParams, setTableParams] = useState<TransactionsTableParams>(DEFAULT_PARAMS_STATE);

  const queryResults = useCaseTransactionsList({
    params: {
      ...tableParams,
      caseId,
      filterDestinationCountries: tableParams['destinationAmountDetails.country'],
      filterOriginCountries: tableParams['originAmountDetails.country'],
    },
  });

  return caseType === 'MANUAL' && caseTransactionsCount === 0 ? (
    <Card.Root noBorder className={s.cardEmpty}>
      <div className={s.cardEmptyContent}>
        <P variant="xl" fontWeight="normal" bold>
          No transactions found
        </P>
        <P variant="m" fontWeight="normal" grey>
          You haven’t added any transactions yet. Add transactions to this case for investigation
        </P>
        {'type' in user && (
          <Link
            to={keepBackUrl(
              makeUrl('/users/list/:userType/:userId/transaction-history', {
                userType: user.type.toLowerCase(),
                userId: user.userId,
              }),
            )}
          >
            <Button type="PRIMARY" icon={<AddLine />}>
              Add transactions
            </Button>
          </Link>
        )}
      </div>
    </Card.Root>
  ) : (
    <Card.Root noBorder className={s.card}>
      <TransactionsTable
        queryResult={queryResults}
        params={tableParams}
        onChangeParams={setTableParams}
      />
    </Card.Root>
  );
};
