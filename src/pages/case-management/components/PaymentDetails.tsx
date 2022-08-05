import React from 'react';

interface Props {
  paymentDetails: any;
}

const removeMethod = (paymentDetails: any) => {
  const { method, ...rest } = paymentDetails;
  return rest;
};

export const PaymentDetails: React.FC<Props> = ({ paymentDetails }) => {
  const paymentDetailsWithoutMethod = removeMethod(paymentDetails);
  const paymentDetailsKeys = Object.keys(paymentDetailsWithoutMethod);
  return (
    <>
      {paymentDetailsKeys.map((key) => {
        return (
          <React.Fragment key={key}>
            {key}: <b>{paymentDetailsWithoutMethod[key]}</b> <br />
          </React.Fragment>
        );
      })}
    </>
  );
};
