import pc from 'picocolors';
import { pool } from '../../db/configDB.js';
import {
  createError,
  handlePostgresError,
} from '../../../utils/errorHandling.js';
import {
  getExpenseConfig,
  getIncomeConfig,
  getInvestmentConfig,
  getPocketConfig,
  getDebtorConfig,
} from '../../../utils/movementInputHandler.js';
import { determineTransactionType } from '../../../utils/helpers.js';
import { recordTransaction } from '../../../utils/recordTransaction.js';

//endpoint: put:/api/fintrack/transaction/transfer-between-accounts?user=UUID&&movement=expense

// functions declaration
//get the currency_id by the currency_code
export const getCurrencyId = async (currency_code) => {
  const currencyQuery = `SELECT * FROM currencies WHERE currency_code = $1`;
  const currencyResult = await pool.query(currencyQuery, [currency_code]);
  return currencyResult.rows[0]?.currency_id;
};
//get the account_type_id by account_type_name
export const getAccountTypeId = async (accountTypeName) => {
  const accountTypeQuery = `SELECT * FROM account_types WHERE account_type_name =  $1`;
  const accountTypeResult = await pool.query({
    text: accountTypeQuery,
    values: [accountTypeName],
  });
  return accountTypeResult.rows[0]?.account_type_id;
};

//get the account info by user_id, account_name and account_type_name
export const getAccountInfo = async (accountName, accountTypeName, userId) => {
  const accountQuery = `SELECT ua.* FROM user_accounts ua
  JOIN account_types act ON ua.account_type_id = act.account_type_id
  WHERE ua.user_id = $1 AND ua.account_name = $2 AND act.account_type_name = $3`;

  const accountInfoResult = await pool.query({
    text: accountQuery,
    values: [userId, accountName, accountTypeName],
  });
  return accountInfoResult.rows[0];
};

//get the array of account type objects
export const getAccountTypes = async () => {
  const accountTypeQuery = `SELECT * FROM account_types`;
  const accountTypeResult = await pool.query(accountTypeQuery);
  const accountTypeArr = accountTypeResult.rows;
  return accountTypeArr;
};

//get the array of transaction type objects
export const getTransactionTypes = async () => {
  const transactionTypeQuery = `SELECT * FROM transaction_types`;
  const transactionTypeResult = await pool.query(transactionTypeQuery);
  const transactionTypeArr = transactionTypeResult.rows;
  return transactionTypeArr;
};

export const balanceMultiplierFn = (transactionTypeName) => {
  const negativeArr = ['withdraw', 'borrow', 'borrowing'];
  const trimTypeName = transactionTypeName.trim().toLowerCase();
  const mult = negativeArr.includes(trimTypeName) ? -1.0 : 1.0;
  // console.log("🚀 ~ balanceMultiplierFn ~ :", mult, 'para', transactionTypeName)
  return mult;
};

export const updateAccountBalance = async (
  newBalance,
  accountId,
  transactionActualDate
) => {
  const insertBalanceQuery = {
    text: `UPDATE user_accounts SET account_balance=$1, updated_at = $2 WHERE account_id = $3 RETURNING *`,
    values: [newBalance, transactionActualDate, accountId],
  };
  const updatedAccountResult = await pool.query(insertBalanceQuery);
  //assure the existence of updatedAccountResult
  return updatedAccountResult.rows[0];
};
//------------------

//------------------
export const transferBetweenAccounts = async (req, res, next) => {
  console.log(pc.magentaBright('transferBetweenAccounts'));
  //Previously create a named slack account. In the cases where a source or destination account is not known, a bank type account named "slack" is used
  const client = await pool.connect();
  try {
    const { user: userId, movement: movementName } = req.query;
    if (!userId) {
      const message = 'User ID is required';
      console.warn(pc.magentaBright(message));
      return res.status(400).json({ status: 400, message });
    }
    if (!movementName) {
      const message = 'movement name is required';
      console.warn(pc.magentaBright(message));
      return res.status(400).json({ status: 400, message });
    }
    //------------------

    //------------------
    //--get the movement types, get the movement type id and check --------------
    const movement_typesResults = await pool.query(
      `SELECT * FROM movement_types`
    );
    const movement_typesResultsExist = movement_typesResults.rows.length > 0;
    if (!movement_typesResultsExist) {
      const message = 'something went wrong with the movement_types table';
      console.warn(pc.magentaBright(message));
      return res.status(400).json({ status: 400, message });
    }
    const movement_types = movement_typesResults.rows;

    const movement_type_id = movement_types.filter(
      (mov) => mov.movement_type_name === movementName.trim().toLowerCase()
    )[0].movement_type_id;

    if (!movement_type_id) {
      const message = `${movementName} was not found. Try again`;
      console.warn(pc.magentaBright(message));
      console.log('🚀 ~ transferBetweenAccounts ~ message:', message);
      throw new Error({ status: 400, message });
      // console.warn(pc.magentaBright(message));
      // return res.status(400).json({ status: 400, message });
    }
    //------------------
    //since frontend input data form are controlled by selection options, then, data should be considered already validated from frontend. Also, frontend, gets the data through this api
    //example:expense
    //movementName: expense, sourceAccountTypeName: 'bank', destinationAccountTypeName:'category_budget', sourceAccountTransactionType:withdraw, destinationAccountTransactionType:deposit,

    const { note, amount, currency: currencyCode } = req.body; //common fields to all tracker movements.
    //-----------------
    //Not all tracker movement have the same input data, so, get the config strategy based on movementName
    const config = {
      expense: getExpenseConfig(req.body),
      income: getIncomeConfig(req.body),
      investment: getInvestmentConfig(req.body),
      pocket: getPocketConfig(req.body),
      debtor: getDebtorConfig(req.body),
    }[movementName];
    console.log('🚀 ~ transferBetweenAccounts ~ config:', config);

    const {
      sourceAccountName,
      sourceAccountTransactionType,
      sourceAccountTypeName,
      destinationAccountName,
      destinationAccountTypeName,
      destinationAccountTransactionType,
    } = config;
    //==========transaction and account types from db.
    const transactionsTypes = await getTransactionTypes();
    const sourceTransactionTypeId = transactionsTypes.filter(
      (type) => type.transaction_type_name === sourceAccountTransactionType
    )[0].transaction_type_id;

    const destinationTransactionTypeId = transactionsTypes.filter(
      (type) => type.transaction_type_name === destinationAccountTransactionType
    )[0].transaction_type_id;

    console.log(
      '🚀 ~ transferBetweenAccounts ~ transactionsTypes:',
      sourceTransactionTypeId,
      'sourceAccountTransactionType',
      sourceAccountTransactionType,
      'destinationTransactionTypeId',
      destinationTransactionTypeId
    );

    const accountTypes = await getAccountTypes();
    //==============================================
    //-------check common input data ----------------
    //validate amount
    const numericAmount = amount ? parseFloat(amount) : 0.0;
    if (numericAmount < 0) {
      const message = 'Amount must be > 0. Tray again!';
      console.warn(pc.redBright(message));
      return res.status(400).json({ status: 400, message });
    }
    //validate currency
    const currencyIdReq = await getCurrencyId(currencyCode);
    if (!currencyIdReq) {
      throw new Error({
        status: 404,
        message: `Currency ${currencyCode} not found`,
      });
    }
    //validate input date
    const { date: transactionActualDate } = req.body; //OJO revisar COMO LO ENVIA EL FRONTEND
    const transaction_actual_date =
      !transactionActualDate || transactionActualDate == ''
        ? new Date()
        : Date.parse(transactionActualDate);

    console.log({ transaction_actual_date });

    //-------account info----------------------------
    //source and destination account info
    const sourceAccountInfo = await getAccountInfo(
      sourceAccountName,
      sourceAccountTypeName,
      userId
    );
    const destinationAccountInfo = await getAccountInfo(
      destinationAccountName,
      destinationAccountTypeName,
      userId
    );

    console.log('🚀 ~ sourceAccountInfo:', sourceAccountInfo);

    if (!sourceAccountInfo || !destinationAccountInfo) {
      // message: `Account  ${sourceAccountName} and type ${sourceAccountTypeName} not found`, // for individual message
      const message = `Destination or Source account not found`;
      return res.status(400).json({
        status: 404,
        message: `Destination or Source account not found`,
      });
    }

    //----source account
    const sourceAccountTypeid = accountTypes.filter(
      (type) => type.account_type_name === sourceAccountTypeName
    )[0].account_type_name;
    console.log(
      '🚀 ~ transferBetweenAccounts ~ accountTypes:',
      sourceAccountTypeid
    );
    //------------------

    //------------------
    //---begin transaction---
    await client.query('BEGIN');

    //---Update the balance in the source account
    const sourceAccountBalance = sourceAccountInfo.account_balance;
    console.log(
      '🚀 ~ transferBetweenAccounts ~ sourceAccountBalance:',
      sourceAccountBalance + 550
    );

    //---check balance only for source account
    if (sourceAccountBalance < numericAmount) {
      const message = `Not enough funds to transfer (${currencyCode} ${numericAmount} from account ${sourceAccountName} (${currencyCode} ${sourceAccountBalance})`;
      console.warn(pc.magentaBright(message));

      if (sourceAccountName !== 'slack') {
        return res.status(400).json({ status: 400, message }); //since slack account is fictional
      }
    }
    //===================================
    //pg transaction to insert data in user_accounts
    const newSourceAccountBalance =
      parseFloat(sourceAccountBalance) +
      numericAmount * balanceMultiplierFn(sourceAccountTransactionType);

    console.log(
      '🚀 ~ newSourceAccountBalance:',
      newSourceAccountBalance,
      '  typeof',
      balanceMultiplierFn(sourceAccountTransactionType)
    );

    const sourceAccountId = sourceAccountInfo.account_id;

    const updatedSourceAccountInfo = await updateAccountBalance(
      newSourceAccountBalance,
      sourceAccountId,
      transaction_actual_date
    );
    console.log(
      '🚀 ~ updatedSourceAccountInfo:',
      updatedSourceAccountInfo,
      'type of:',
      typeof sourceAccountBalance
    );
    //-------------
    //---Update the balance in the destination account
    const destinationAccountBalance = destinationAccountInfo.account_balance;
    const newDestinationAccountBalance =
      parseFloat(destinationAccountBalance) +
      numericAmount * balanceMultiplierFn(destinationAccountTransactionType);

    console.log(
      '🚀 ~ newdestinationAccountBalance:',
      newDestinationAccountBalance,
      '  typeof',
      balanceMultiplierFn(destinationAccountTransactionType)
    );

    const destinationAccountId = destinationAccountInfo.account_id;

    const updatedDestinationAccountInfo = await updateAccountBalance(
      newDestinationAccountBalance,
      destinationAccountId,
      transaction_actual_date
    );
    console.log(
      '🚀 ~ updateddestinationAccountInfo:',
      updatedDestinationAccountInfo,
      'type of:',
      typeof destinationAccountBalance
    );

    //----Register trasnfer/receive transaction-----------------
    //-----------source transaction
    const transactionDescription = `${note}.Transaction: ${sourceAccountTransactionType}. Transfered ${currencyCode} ${numericAmount} from account ${sourceAccountName} of type: ${sourceAccountTypeName} account, to ${destinationAccountName} of type ${destinationAccountTypeName}.${transactionActualDate}`; //revisar formato de fecha

    console.log(
      userId,
      transactionDescription,
      movement_type_id,
      sourceTransactionTypeId,
      newSourceAccountBalance,
      currencyIdReq,
      sourceAccountId,
      destinationAccountId,
      transaction_actual_date
    );

    const sourceTransactionOption = {
      userId,
      description: transactionDescription,
      movement_type_id,
      transaction_type_id: sourceTransactionTypeId, //deposit or lend
      status: 'complete',
      amount: numericAmount * balanceMultiplierFn(sourceAccountTransactionType), //
      currency_id: currencyIdReq,
      source_account_id: sourceAccountId,
      destination_account_id: destinationAccountId,
      transaction_actual_date,
    };

    await recordTransaction(sourceTransactionOption);
    //=========================================================
    //-----------destination transaction
    const transactionDescriptionReceived = `${note}.Transaction: ${sourceAccountTransactionType}. Received ${currencyCode} ${numericAmount} from account ${sourceAccountName} of type: ${sourceAccountTypeName} account, to ${destinationAccountName} of type ${destinationAccountTypeName}.${transactionActualDate}`; //revisar formato de fecha

    console.log(
      userId,
      transactionDescriptionReceived,
      movement_type_id,
      sourceTransactionTypeId,
      newDestinationAccountBalance,
      numericAmount * balanceMultiplierFn(destinationAccountTransactionType), //

      currencyIdReq,
      sourceAccountId,
      destinationAccountId,
      transaction_actual_date
    );

    const destinationTransactionOption = {
      userId,
      description: transactionDescriptionReceived,
      movement_type_id,
      transaction_type_id: destinationTransactionTypeId, //withdraw or borrow
      status: 'complete',
      amount:
        numericAmount * balanceMultiplierFn(destinationAccountTransactionType), //
      currency_id: currencyIdReq,
      source_account_id: sourceAccountId,
      destination_account_id: destinationAccountId,
      transaction_actual_date,
    };

    await recordTransaction(destinationTransactionOption);
    //=======================================================
    await client.query('COMMIT');

    const message = 'Transaction completed successfully.';
    console.log(pc.magentaBright(message));
    res.status(200).json({ status: 200, message });

  } catch (error) {
    await client.query('ROLLBACK');
    const { code, message } = handlePostgresError(error);
    console.error(
      pc.red('error during transfer'),
      pc.magentaBright(message || 'something went wrong')
    );
    next(createError(code, message));
  } finally {
    client.release();
  }
};
