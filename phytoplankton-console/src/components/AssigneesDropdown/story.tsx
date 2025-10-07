import { useQueryClient } from '@tanstack/react-query';
import { AssigneesDropdown } from './index';
import { UseCase } from '@/pages/storybook/components';
import Button from '@/components/library/Button';
import { ACCOUNT_LIST } from '@/utils/queries/keys';

export default function (): JSX.Element {
  const queryClient = useQueryClient();
  return (
    <>
      <div>
        <Button
          onClick={() => {
            queryClient.invalidateQueries(ACCOUNT_LIST());
          }}
        >
          Invalidate cache
        </Button>
      </div>
      <UseCase
        title={'Edit mode'}
        initialState={{
          value: [
            'auth0|65ded68859261c2cff233db2',
            'auth0|65ded6a3110ae652fb7c9d36',
            'auth0|63f1f09b8aabe642ab49ef06',
            'auth0|63e3bc1cbf7ef9f089efd2b5',
            'auth0|64be61cf2c41f23613784279',
            'auth0|63e3bd0051878f0df2dc13a4',
            'auth0|65158c61ea6e45c018d323e1',
            'auth0|63a876262ed33a01a61c498e',
          ],
        }}
      >
        {([state, setState]) => (
          <AssigneesDropdown
            assignments={(state.value ?? []).map((assigneeUserId) => ({ assigneeUserId }))}
            editing={true}
            onChange={async (assignees) => {
              setState((prev) => ({ ...prev, value: assignees }));
            }}
          />
        )}
      </UseCase>
      <UseCase
        title={'View mode'}
        initialState={{
          value: [
            'auth0|65ded68859261c2cff233db2',
            'auth0|65ded6a3110ae652fb7c9d36',
            'auth0|63f1f09b8aabe642ab49ef06',
            'auth0|63e3bc1cbf7ef9f089efd2b5',
            'auth0|64be61cf2c41f23613784279',
            'auth0|63e3bd0051878f0df2dc13a4',
            'auth0|65158c61ea6e45c018d323e1',
            'auth0|63a876262ed33a01a61c498e',
          ],
        }}
      >
        {([state]) => (
          <AssigneesDropdown
            assignments={(state.value ?? []).map((assigneeUserId) => ({ assigneeUserId }))}
            editing={false}
          />
        )}
      </UseCase>
    </>
  );
}
