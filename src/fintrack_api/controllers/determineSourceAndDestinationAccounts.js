
//Function to determine source and destination accounts id as a function of transaction types
export function determineSourceAndDestinationAccounts(
  newAccountInfo,
  counterAccountInfo
) {
  let destination_account_id = newAccountInfo.account_id;
  let source_account_id = newAccountInfo.account_id;
  const isAccountOpening =
    newAccountInfo.transaction_type_name === 'account-opening';

  if (!isAccountOpening) {
    destination_account_id =
      newAccountInfo.transaction_type_name === 'deposit' ||
      newAccountInfo.transaction_type_name === 'lend'
        ? newAccountInfo.account_id
        : counterAccountInfo.account.account_id;

    source_account_id =
      newAccountInfo.transaction_type_name === 'withdraw' ||
      newAccountInfo.transaction_type_name === 'borrow'
        ? newAccountInfo.account_id
        : counterAccountInfo.account.account_id;
  }
  return {
    destination_account_id,
    source_account_id,
    isAccountOpening,
  };
}