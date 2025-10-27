import React from 'react';
import Alert from '@/components/library/Alert';
import { useDispositionApprovalWarnings } from '@/utils/api/workflows';

interface Props {
  className?: string;
}

/**
 * Component that displays approval workflow warnings for disposition changes
 */
export const DispositionApprovalWarnings: React.FC<Props> = ({ className }) => {
  const approvalWarnings = useDispositionApprovalWarnings();

  // Always show the general info banner if there are any fields that could be affected
  if (approvalWarnings.fieldsInfo.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      <Alert type="INFO">
        <div>
          <p>
            Any changes made to user fields will follow the configured approval workflows. Fields
            not requiring approval will be applied immediately.
          </p>
        </div>
      </Alert>
    </div>
  );
};
