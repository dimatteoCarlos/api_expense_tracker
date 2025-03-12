import pc from 'picocolors';
import { pool } from '../../db/configDB.js';
import { handlePostgresError } from '../../../utils/errorHandling';
import {
  getExpenseConfig,
  getIncomeConfig,
  getInvestmentConfig,
  getPocketConfig,
  getDebtorConfig,
} from '../../../utils/movementInputHandler.js';
import { determineTransactionType } from '../../../utils/helpers.js';

//createError, handlePostgressError
//pool
//determineTransactionType
//recordTransaction

//put:/api/fintrack/transaction/transfer-between-accounts?user=UUID&&movement=expense

// functions
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
  WHERE ua.user_id = $1 AND ua.accountName = $2 AND act.account_type_name = $3`;

  const accountInfoResult = await pool.query({
    text: accountQuery,
    values: [userId, accountTypeName],
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

const balanceMultiplierFn = (transactionTypeName) => {
  const negativeArr = ['withdraw', 'borrow', 'borrowing'];
  const trimTypeName = transactionTypeName.trim().toLowerCase();
  return trimTypeName.includes(negativeArr) ? -1 : 1;
};

const updateAccountBalance = async (
  newBalance,
  accountId,
  transactionActualDate
) => {
  const insertBalanceQuery = {
    text: `UPDATE user_accounts SET account_balance=$1), updated_at = transactionActualDate WHERE account_id = $2 RETURNING *`,
    values: [newBalance, accountId],
  };
  const updatedAccountResult = await pool.query(insertBalanceQuery);
  //assure the existence of updatedAccountResult
  return updatedAccountResult.rows[0];
};

//------------------

//------------------
export const transferBetweenAccounts = async (req, res, next) => {
  console.log(pc.magentaBright('transferBetweenAccounts'));
  const client = await pool.connect();

  //Previously create a cash account. In the cases where a source or destination account is not known, a bank type account named "cash" is used

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
    const movement_typesResults = await pool.query(
      `SELECT * FROM movement_types`
    );

    //--get the movement types, get the movement type id and check --------------
    const movement_typesResultsExist = movement_typesResults.rows.length > 0;
    if (!movement_typesResultsExist) {
      const message = 'something went wront with the movement_types table';
      console.warn(pc.magentaBright(message));
      return res.status(400).json({ status: 400, message });
    }
    const movement_types = movement_typesResults.rows[0];
    const movement_type_id = movement_types.filter((mov) => {
      mov.movement_type_name === movement.trim().toLowerCase();
    }).movement_type_id;
    console.log(movement_type_id);

    if (!movement_type_id) {
      const message = `${movementName} was not found. Try again`;
      console.warn(pc.magentaBright(message));
      throw new Error({ status: 400, message });
      // console.warn(pc.magentaBright(message));
      // return res.status(400).json({ status: 400, message });
    }
    //------------------

    //since frontend input data form are controlled by selection options, then, data should be considered already validated by frontend.
    //example:expense
    //movementName: expense, sourceAccountTypeName: 'bank', destinationAccountTypeName:'category_budget', sourceAccountTransactionType:withdraw, destinationAccountTransactionType:deposit,

    const { note, amount, currency: currencyCode } = req.body; //common fields to all tracker;
    //-----------------
    // Obtener la configuración basada en movementName
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

    console.log('🚀 ~ transferBetweenAccounts ~ config:', config);

    //-------transaction and account types from db.
    const transactionsTypes = getTransactionTypes();
    console.log(
      '🚀 ~ transferBetweenAccounts ~ transactionsTypes:',
      transactionsTypes
    );
    const accountTypes = getAccountTypes();
    console.log('🚀 ~ transferBetweenAccounts ~ accountTypes:', accountTypes);
    //--------------------
    if (amount < 0) {
      const message = 'Amount must be > 0. Tray again!';
      console.warn(pc.redBright(message));
      return res.status(400).json({ status: 400, message });
    }

    const numericAmount = amount ? parseFloat(amount) : 0.0;
    const currencyIdReq = await getCurrencyId(currencyCode);

    if (!currencyIdReq) {
      throw new Error({
        status: 404,
        message: `Currency ${currencyCode} not found`,
      });
    }

    //source account info
    const sourceAccountInfo = await getAccountInfo(
      sourceAccountName,
      sourceAccountTypeName,
      userId
    );
    console.log('🚀 ~ sourceAccountInfo:', sourceAccountInfo);

    if (!sourceAccountInfo) {
      throw new Error({
        status: 404,
        message: `Account  ${sourceAccountName} and type ${sourceAccountTypeName} not found`,
      });
    }

    const sourceAccountTypeid = accountTypes.filter(
      (type) => type.account_type_name === sourceAccountTypeName
    );
    const sourceTransactionTypeId = transactionsTypes.filter(
      (type) => type.transaction_type_name === sourceAccountTransactionType
    );

    //---Update the balance in the source account
    const sourceAccountBalance = sourceAccountInfo.account_balance;

    if (sourceAccountBalance < numericAmount) {
      const message = `Not enough funds to transfer (${currencyCode} ${numericAmount} from account ${sourceAccountName} (${currencyCode} ${sourceAccountBalance})`;
      console.warn(pc.magentaBright(message));

      if (sourceAccountName !== 'cash') {
        return res.status(400).json({ status: 400, message });
      }
    }

    const { date: transactionActualDate } = req.body; //OJO revisar COMO LO ENVIA EL FRONTEND

    const transaction_actual_date =
      !transactionActualDate || transactionActualDate == ''
        ? new Date()
        : transactionActualDate;

    //=========================================================
    //pg transaction to insert data  in user_accounts
    const newSourceAccountBalance =
      sourceAccountBalance + numericAmount * balanceMultiplierFn;

    console.log('🚀 ~ newSourceAccountBalance:', newSourceAccountBalance);

    const sourceAccountId = sourceAccountInfo.account_id;

    const updatedSourceAccountInfo = updateAccountBalance(
      newSourceAccountBalance,
      sourceAccountId,
      transaction_actual_date
    );
    console.log('🚀 ~ updatedSourceAccountInfo:', updatedSourceAccountInfo);

    //-----------Register transaction
    const transactionDescription = `${note}. Transfered ${currencyCode} ${numericAmount} from: ${sourceAccountName} of type: ${sourceAccountTypeName} to ${destinationAccountName}. Transaction: ${sourceAccountTransactionType}. ${transactionActualDate.toLocaleDate()}`; //revisar formato de fecha

    console.log(
      userId,
      sourceAccountId,
      transactionDescription,
      movement_type_id,
      sourceTransactionTypeId,
      newSourceAccountBalance,
      currencyIdReq,
      sourceAccountId,
      // destination_account_id,
      transaction_actual_date
    );

    // const transactionOption = {
    //   userId,
    //   description: transactionDescription,
    //   movement_type_id,
    //   transaction_type_id, //deposit or lend
    //   status: 'complete',
    //   amount: account_balance, //initial balance
    //   currency_id: currencyIdReq,
    //   source_account_id,
    //   destination_account_id,
    //   transaction_actual_date,
    // };

    // recordTransaction(transactionOption);
    //=========================================================

    await client.query('COMMIT');

    const message = 'Transaction completed successfully.';
    console.log(pc.yellowBright(message));
    res.status(200).json({ status: 200, message });
    
  } catch (error) {
    await client.query('ROLLBACK');
    const { code, message } = handlePostgresError(error);
    console.error(
      pc.red('when transfering between accounts'),
      pc.magentaBright(message || 'something went wrong')
    );
    next(createError(code, message));
  } finally {
    client.release();
  }

  // amount,
  // currency_id,
  // transaction_actual_date,

  // source_account_id,
  // transaction_type_id,
  // destination_account_id,
  // description,
  // status,

  //data from body
  //chequear el tipo de movimiento req.
  // y segun el tipo de transaction
  //ajusta datos segun el requerimiento tipo de movimiento
  //obtiene los id de los datos recibidos como nombres,
  //valida montos
  //check account detail info and balance for the accounts
  //verificar existencia de las cuentas, y que los montos a transferir este de acuerdo con los balances de las cuentas
  //Begin Transaction
  //transfer from account
  //Insert trnsaction records on transfering account

  //acondicionar los datos para to receiving account

  //Insert trnsaction records on transfering account

  //mensaje de exito
  //mensaje de erro
};
