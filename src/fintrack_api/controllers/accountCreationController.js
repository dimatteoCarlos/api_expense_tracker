//accountController.js

import pc from 'picocolors';
import {
  createError,
  handlePostgresError,
} from '../../../utils/errorHandling.js';
import { pool } from '../../db/configDB.js';
import { determineTransactionType } from '../../../utils/helpers.js';
import { recordTransaction } from '../../../utils/recordTransaction.js';
import { checkAndInsertAccount } from '../../../utils/checkAndInsertAccount.js';
import { verifyAccountExistence } from '../../../utils/verifyAccountExistence.js';
import { updateAccountBalance } from '../../../utils/updateAccountBalance.js';
import { insertAccount } from '../../../utils/insertAccount.js';
import { getTransactionTypeId } from '../../../utils/getTransactionTypeId.js';
import { determineSourceAndDestinationAccounts } from './determineSourceAndDestinationAccounts.js';
import { prepareTransactionOption } from '../../../utils/prepareTransactionOption.js';
//import { validateAndNormalizeDate } from '../../../utils/helpers.js';

//------------------------------------------------------------------------
//endpoint: post: /api/fintrack/account/new_account/account_type_name?user=UUID
//use this only for bank, income_source and investment accounts
export const createBasicAccount = async (req, res, next) => {
  //basic_account_data:  userId,account_type_name,currency_code,amount,account_start_date,account_starting_amount
  //account types: bank, income_sorce, investment. Also, cash and slack attribute accounts
  //movement_type_name:'account-opening', movement_type_id: 8, transaction_type_name:deposit,
  console.log(pc.blueBright('createBasicAccount'));
  console.log(
    'body:',
    req.body,
    'params:',
    req.params,
    'query:',
    req.query,
    'path:',
    req.path,
    'originalUrl:',
    req.originalUrl
  );

  const client = await pool.connect();

  try {
    //implement verifyUser middleware and then get userId from res.user - PENDIENTE
    const { user: userId } = req.query;
    //check if the userId exist in the database or verifyUser
    if (!userId) {
      const message = 'User ID is required';
      console.warn(pc.blueBright(message));
      return res.status(400).json({ status: 400, message });
    }
    //--------
    //account basic data
    const {
      type: account_type_name, //not necessary just for developing
      name: account_name,
      currency: currency_code,
      amount,
      date,
      transactionActualDate,
      sourceAccountId: selectedAccountInput, //adaptar para cambiar a sourceAccountTypeName
    } = req.body;
    //-----------
    //check for the account_type_name = bank
    //check coherence of type account requested
    const typeAccountRequested = req.originalUrl.split('/').pop().split('?')[0];
    //hay que decidir como introducir el tipo de cuenta, por una sola via

    if (account_type_name) {
      const checkTypeCoherence = typeAccountRequested === account_type_name;
      //aqui typeAccountRequested es como una confirmacion del tipo de cuenta
      if (!checkTypeCoherence || !typeAccountRequested) {
        const message = `Check coherence between account type requested on url: ${typeAccountRequested.toUpperCase()} vs account type entered: ${account_type_name.toUpperCase()}`;
        console.warn('Warning:', pc.cyanBright(message));
        throw new Error(message);
      }
    }
    //---

    const transaction_actual_date =
      !transactionActualDate || transactionActualDate == ''
        ? new Date()
        : transactionActualDate;

    //revisar el frontend, creo que envia date en vez de transactionActualDate, como la fecha de transaction

    const account_start_date =
      date && date !== ''
        ? date
        : !transactionActualDate || transactionActualDate == ''
        ? new Date()
        : transactionActualDate;

    if (amount < 0) {
      const message = 'Amount must be >= 0. Tray again!';
      console.warn(pc.redBright(message));
      return res.status(400).json({ status: 400, message });
    }
    const account_starting_amount = amount ? parseFloat(amount) : 0.0;
    //-----------------------
    console.log(pc.bgCyan('userId', userId));
    //-----------------------
    //date validation
    //validar que la fecha no sea mayor que el proximo dia habil? o que no sobrepase el lunes de la prox semana? o no sea mayor que el dia de hoy? o puede ser futura pero en el mismo mes actual? o libre para realizar simulaciones, aunque esto en caso de tener que hacer conversiones habria que preverlo?
    // const accountStartDateNormalized =
    //   validateAndNormalizeDate(account_start_date);
    // console.log(
    //   '🚀 ~ createAccount ~ accountStartDateNormalized:',
    //   accountStartDateNormalized
    // );
    //---
    //currency and account_type data, are better defined by frontend
    //check input data
    if (!account_type_name || !currency_code || !account_name) {
      const message =
        'Currency_code, account name and account type name fields are required';
      console.warn(pc.blueBright(message));
      return res.status(400).json({ status: 400, message });
    }

    //get all account types and then get the account type id requested
    // const { rows: [accountType] } = await pool.query('SELECT account_type_id FROM account_types WHERE account_type_name = $1', [account_type_name]);
    const accountTypeQuery = `SELECT * FROM account_types`;
    const accountTypeResult = await pool.query(accountTypeQuery);
    const accountTypeArr = accountTypeResult.rows;
    // console.log('🚀 ~ createAccount ~ accountTypeArr:', accountTypeArr,  accountTypeArr[0]);
    const accountTypeIdReqObj = accountTypeArr.filter(
      (type) => type.account_type_name == account_type_name.trim()
    )[0];
    const accountTypeIdReq = accountTypeIdReqObj.account_type_id;
    console.log('🚀 ~ createAccount ~ account_type_id:', accountTypeIdReq);

    //------------------------------------------------------------
    //verify account existence in user_accounts by userId and account name
    const accountExist = await verifyAccountExistence(
      userId,
      account_name,
      account_type_name
    );
    console.log('🚀 ~ createBasicAccount ~ accountExist:', accountExist);
    //-----------------------------------------------------
    //get currency id from currency_code requested
    const currencyQuery = `SELECT * FROM currencies`;
    const currencyResult = await pool.query(currencyQuery);
    const currencyArr = currencyResult?.rows;
    const currencyIdReq = currencyArr.filter(
      (currency) => currency.currency_code === currency_code
    )[0].currency_id;

    // console.log('🚀 ~ createAccount ~ currencyIdReq:', currencyIdReq);
    //---------------------------------------
    await client.query('BEGIN');
    //NEW ACCOUNT AND COUNTER TRANSACTION ACCOUNT (SLACK)
    // ----------------------------
    // New Account logic
    // ----------------------------
    const newAccountBalance = account_starting_amount; //>=0
    //LOG BALANCE AND ACCOUNT INITIAL AMOUNT
    //------------------------------------------------
    //DETERMINE THE TRANSACTION TYPE FOR EACH ACCOUNT
    //   transactionTypeDescriptionObj: {
    //     transactionType: string;
    //     counterTransactionType: string;
    // }
    const transactionTypeDescriptionObj = determineTransactionType(
      newAccountBalance,
      account_type_name
    );

    const transactionDescription = `Account: ${account_name} type: ${account_type_name}. Initial-(${transactionTypeDescriptionObj.transactionType}) amount: ${account_starting_amount}`;
    //get the transaction type id's

    const transactionTypeDescriptionIds = await getTransactionTypeId(
      transactionTypeDescriptionObj.transactionType,
      transactionTypeDescriptionObj.counterTransactionType
    );

    console.log(('getTransactionTypeIds:', transactionTypeDescriptionIds));

    const { transaction_type_id, countertransaction_type_id } =
      transactionTypeDescriptionIds;

    //---- UPDATE COUNTER ACCOUNT BALANCE (SLACK ACCOUNT)------
    //check whether slack account exists if not create it with start amount and balance = 0
    //slack account or counter account, is like a compensation account which serves to check the equilibrium on cash flow like a counter transaction operation

    const counterAccountInfo = await checkAndInsertAccount(userId, 'slack');

    const newCounterAccountBalance =
      counterAccountInfo.account.account_balance - account_starting_amount;

    //-------------------------------------------------------
    const counterTransactionDescription = `Transaction: ${transactionTypeDescriptionObj.counterTransactionType} .Account ${counterAccountInfo.account.account_name} of type: bank with id: ${counterAccountInfo.account.account_id}. Account reference: ${account_name})`;

    //-------COUNTER (SLACK) ACCOUNT INFO ------------------------------
    const slackCounterAccountInfo = {
      user_id: userId,
      description: counterTransactionDescription,
      transaction_type_id: countertransaction_type_id,
      transaction_type_name:
        transactionTypeDescriptionObj.counterTransactionType,
      amount: account_starting_amount,
      currency_id: currencyIdReq,
      account_id: counterAccountInfo.account.account_id,
      transaction_actual_date: transactionActualDate,
      currency_code,
      account_name: counterAccountInfo.account.account_name,
      account_type_name: 'bank',
      account_type_id: counterAccountInfo.account.account_type_id,
      balance: newCounterAccountBalance,
    };

    //-- UPDATE BALANCE OF COUNTER ACCOUNT INTO user_accounts table
    const updatedCounterAccountInfo = await updateAccountBalance(
      newCounterAccountBalance,
      slackCounterAccountInfo.account_id,
      transactionActualDate
    );
    console.log(
      '🚀 ~ createBasicAccount ~ updatedCounterAccountInfo:',
      updatedCounterAccountInfo
    );

    //-------------------------------------------------------
    //--------- INSERT NEW ACCOUNT --------------------------
    const { account_basic_data } = await insertAccount(
      userId,
      account_name,
      accountTypeIdReq,
      currencyIdReq,
      account_starting_amount,
      newAccountBalance,
      account_start_date ?? transaction_actual_date
    );
    const account_id = account_basic_data.account_id;
    const message = `${account_name} account of type ${account_type_name} with id ${account_id} was successfully created `;
    console.log('🚀 ~ createAccount ~ message:', message);

    //-------NEW ACCOUNT INFO --------------------
    const newAccountInfo = {
      user_id: userId,
      description: transactionDescription,
      transaction_type_id,
      transaction_type_name: transactionTypeDescriptionObj.transactionType,
      amount: account_starting_amount,
      currency_id: currencyIdReq,
      account_id: account_basic_data.account_id,
      transaction_actual_date: transactionActualDate,
      currency_code,
      account_name,
      account_type_name,
      account_type_id: account_basic_data.account_type_id,
      balance: newAccountBalance,
    };
    console.log(
      'slackCounter:',
      slackCounterAccountInfo,
      'newAccount:',
      newAccountInfo
    );
    //-------------------------------------------------------
    //------- RECORD TRANSACTION INTO transactions table ----
    //--- determine which account serves as a SOURCE OR DESTINATION account
    let destination_account_id = newAccountInfo.account_id,
      source_account_id = newAccountInfo.account_id;
    const isAccountOpening =
      newAccountInfo.transaction_type_name === 'account-opening';

    if (!isAccountOpening) {
      destination_account_id =
        newAccountInfo.transaction_type_name == 'deposit' ||
        newAccountInfo.transaction_type_name == 'lend'
          ? newAccountInfo.account_id
          : counterAccountInfo.account.account_id;
      //---
      source_account_id =
        newAccountInfo.transaction_type_name == 'withdraw' ||
        newAccountInfo.transaction_type_name == 'borrow'
          ? newAccountInfo.account_id
          : counterAccountInfo.account.account_id;
    }
    //------MOVEMENT TYPE ASSOCIATED TO CREATE A NEW ACCOUNT ---
    const movement_type_id = 8; //account opening
    //----------------------------------------------------
    //-REGISTER TRANSACTIONS OF NEW ACCOUNT AND THE COUNTER ACCOUNT
    //-----------Register transaction----------------------
    //Add deposit transaction
    //Rules: movement_type_name:receive, movement_type_id: 8, transaction_type_name:deposit/account-opening,transaction_type_id: 2/5

    //--------REGISTER NEW ACCOUNT TRANSACTION -------
    const transactionOption = prepareTransactionOption(
      newAccountInfo,
      source_account_id,
      destination_account_id,
      movement_type_id
    );
    const recordTransactionInfo = await recordTransaction(transactionOption);

    //--------REGISTER COUNTER ACCOUNT (SLACK) TRANSACTION -------------------

    const counterTransactionOption = prepareTransactionOption(
      slackCounterAccountInfo,
      source_account_id,
      destination_account_id,
      movement_type_id
    );

    const counterTransactionInfo = !isAccountOpening
      ? await recordTransaction(counterTransactionOption)
      : {};

    //-------------------------------------------------------------------------
    await client.query('COMMIT');

    return res.status(201).json({
      status: 201,
      data: {
        account_basic_data: {
          //sacar el user_id a parte
          ...account_basic_data,
          account_type_name,
          currency_code,
        },

        new_account_data: {
          account_name: newAccountInfo.account_name,
          transaction_data: transactionOption,
          transaction_info: recordTransactionInfo,
          transaction_type_name: newAccountInfo.transaction_type_name,
        },

        counter_account_data: {
          account_name: counterTransactionInfo.account_name,
          transaction_data: counterTransactionOption,
          transaction_info: counterTransactionInfo,
          transaction_type_name: counterTransactionInfo.transaction_type_name,
        },
      },
      message,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    //handle pg errors
    const { code, message } = handlePostgresError(error);
    console.error(
      pc.red('when creating account:'),
      message || 'something wrong'
    );
    return next(createError(code, message));
  } finally {
    client.release();
  }
};

//----------------------
//POST: http://localhost:5000/api/fintrack/account/new_account/debtor?user=6e0ba475-bf23-4e1b-a125-3a8f0b3d352c
export const createDebtorAccount = async (req, res, next) => {
  //basic_account_data:  userId,account_type_name,currency_code,amount,account_start_date,account_starting_amount
  //account type: debtor.
  //movement_type_name:'account-opening', movement_type_id: 8, transaction_type_name:lend / borrow,

  console.log(pc.blueBright('createDebtorAccount'));
  console.log(req.body, req.params, req.query);
  const client = await pool.connect();
  try {
    //implement verifyUser middleware and then get userId from res.user
    const { user: userId } = req.query;
    if (!userId) {
      const message = 'User ID is required';
      console.warn(pc.blueBright(message));
      return res.status(400).json({ status: 400, message });
    }

    //data from debt new profile form - frontend fintrack
    const {
      debtor_lastname,
      debtor_name,
      value,
      selected_account_name, //QUE ES ESTA CUENTA EN DEBTOR INPUT?
      selectedAccountInput, //optional
      type: debtor_transaction_type, //aqui type es el tipo de transaction, mientras que en los otras cuentas es el tipo de cuenta OJO!!! CONFIRMARLO EN EL FINTRACK FRONTEND
    } = req.body;

    const account_type_name = 'debtor';
    const debtorTypeTransactionInput = { lending: 'lend', borrowing: 'borrow' };
    const debtor_transaction_type_name =
      debtorTypeTransactionInput[debtor_transaction_type];
    //-----------------------
    //check coherence of type account requested
    const typeAccountRequested = req.originalUrl.split('/').pop().split('?')[0];
    const checkTypeCoherence = typeAccountRequested === account_type_name;
    if (!checkTypeCoherence) {
      const message = `Check coherence between account type requested on url: ${typeAccountRequested.toUpperCase()} vs account type entered: ${account_type_name.toUpperCase()}`;
      console.warn('Warning:', pc.cyanBright(message));
      throw new Error(message);
    }
    console.log(
      '🚀 ~ createDebtorAccount ~ debtor_transaction_type_name:',
      debtor_transaction_type_name
    );
    //-----------------------
    //NEW ACCOUNT BASIC DATA
    //currency id and type account id
    // const accountTypeId = await getAccountTypeId(account_type_name);
    // const currencyId = await getCurrencyId('usd'); // Asumimos USD por defecto
    const { currency, date, transactionActualDate } = req.body;
    const currency_code = currency ? currency : 'usd';
    const account_name = `${debtor_lastname}, ${debtor_name}`;
    const account_starting_amount = value ? parseFloat(value) : 0.0;
    //---------------------------------------
    //definir como se introduce la fecha ya que no esta contemplado en el input de fintrack para debtor
    const account_start_date = !!date && date !== '' ? date : new Date(); //in case it received a date
    const transaction_actual_date =
      !transactionActualDate || transactionActualDate == ''
        ? new Date()
        : transactionActualDate;
    //---------------------------------------
    console.log(pc.cyan(`userId: ${userId}`));
    console.log('dateInput:', transactionActualDate, transaction_actual_date);
    //---------------------------------------
    //currency and account_type data, are better defined by frontend
    if (!account_type_name || !currency_code || !account_name) {
      const message =
        'Currency_code, account name and account type name fields are required';
      console.warn(pc.blueBright(message));
      return res.status(400).json({ status: 400, message });
    }
    //---------------------------------------
    //get all account types and then get the account type id requested
    const accountTypeQuery = `SELECT * FROM account_types`;
    const accountTypeResult = await pool.query(accountTypeQuery);
    const accountTypeArr = accountTypeResult.rows;
    //console.log('🚀 ~ createAccount ~ accountTypeArr:', accountTypeArr);
    const accountTypeIdReqObj = accountTypeArr.filter(
      (type) => type.account_type_name == account_type_name.trim()
    )[0];
    const accountTypeIdReq = accountTypeIdReqObj.account_type_id;
    console.log('🚀 ~ createAccount ~ account_type_id:', accountTypeIdReq);
    //---------------------------
    //verify account existence in user_accounts by userId and account name
    const accountExist = await verifyAccountExistence(
      userId,
      account_name,
      account_type_name
    );
    console.log('🚀 ~ createDebtorAccount ~ accountExist:', accountExist);

    //----------------------------------------
    //get currency id from currency_code requested
    const currencyQuery = `SELECT * FROM currencies`;
    const currencyResult = await pool.query(currencyQuery);
    const currencyArr = currencyResult?.rows;
    const currencyIdReq = currencyArr.filter(
      (currency) => currency.currency_code === currency_code
    )[0].currency_id;

    // console.log('🚀 ~ createAccount ~ currencyIdReq:', currencyIdReq);

    //--DEBTOR ACCOUNT -----
    //---debtor_initial_balance
    const newAccountBalance =
      debtor_transaction_type_name === 'borrow'
        ? account_starting_amount * -1
        : account_starting_amount;

    //--------- INSERT NEW DEBTOR BASIC ACCOUNT ----------------
    await client.query('BEGIN');
    //---INSERT DEBTOR ACCOUNT into user_accounts table
    const { account_basic_data } = await insertAccount(
      userId,
      account_name,
      accountTypeIdReq,
      currencyIdReq,
      account_starting_amount,
      newAccountBalance,
      account_start_date ?? transaction_actual_date
    );
    const account_id = account_basic_data.account_id;

    //---------------------------------------------------------------
    //---INSERT DEBTOR ACCOUNT into debtor_accounts table
    const debtorInsertQuery = {
      text: `INSERT INTO debtor_accounts (account_id, debtor_lastname, debtor_name, value, selected_account_name, selected_account_id, account_start_date) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      values: [
        account_id,
        debtor_lastname,
        debtor_name,
        newAccountBalance,
        selected_account_name,
        selectedAccountInput || null, // selected_account_id
        new Date(), // account_start_date
      ],
    };
    const debtorAccount = await client.query(debtorInsertQuery);
    const debtor_account = {
      ...debtorAccount.rows[0],
      currency_code,
      account_type_name,
    };
    //---------------------------------------------------------------
    //DETERMINE THE TRANSACTION TYPE FOR NEW DEBTOR ACCOUNT AND FOR COUNTER ACCOUNT (SLACK)
    const transactionTypeDescriptionObj = determineTransactionType(
      newAccountBalance,
      account_type_name
    );

    const transactionDescription = `Account: ${account_name}, type: ${account_type_name}. Initial-(${transactionTypeDescriptionObj.transactionType}) amount: ${account_starting_amount}`;

    //get the transaction type id's
    const transactionTypeDescriptionIdsResults = await pool.query({
      text: `SELECT
        MAX(transaction_type_id) FILTER (WHERE transaction_type_name = $1) AS transaction_type_id, 
        MAX(transaction_type_id) FILTER (WHERE transaction_type_name = $2) AS counterTransaction_type_id
        FROM transaction_types
        `,
      values: [
        transactionTypeDescriptionObj.transactionType,
        transactionTypeDescriptionObj.counterTransactionType,
      ],
    });

    const transactionTypeDescriptionIds =
      transactionTypeDescriptionIdsResults.rows[0];

    const { transaction_type_id, countertransaction_type_id } =
      transactionTypeDescriptionIds;

    //------ DEBTOR NEW ACCOUNT INFO --------------------
    const newAccountInfo = {
      user_id: userId,
      description: transactionDescription,
      transaction_type_id,
      transaction_type_name: transactionTypeDescriptionObj.transactionType,
      amount: account_starting_amount,
      currency_id: currencyIdReq,
      account_id: account_basic_data.account_id,
      transaction_actual_date,
      currency_code,
      account_name,
      account_type_name,
      account_type_id: account_basic_data.account_type_id,
      balance: newAccountBalance,
    };

    //---- UPDATE COUNTER ACCOUNT BALANCE (SLACK ACCOUNT)------
    //check whether slack account exists if not create it with start amount and balance = 0
    //slack account or counter account, is like a compensation account which serves to check the equilibrium on cash flow like a counter transaction operation
    const counterAccountInfo = await checkAndInsertAccount(userId, 'slack');

    const newCounterAccountBalance =
      counterAccountInfo.account.account_balance - account_starting_amount;

    const counterTransactionDescription = `Transaction: ${transactionTypeDescriptionObj.counterTransactionType}. Account ${counterAccountInfo.account.account_name} of type: bank with id: ${counterAccountInfo.account.account_id}. Account reference: ${account_name})`;

    //--------------------------------------------------------------
    //-------------SLACK COUNTER ACCOUNT INFO ------
    const slackCounterAccountInfo = {
      user_id: userId,
      description: counterTransactionDescription,
      transaction_type_id: countertransaction_type_id,
      transaction_type_name:
        transactionTypeDescriptionObj.counterTransactionType,
      amount: account_starting_amount,
      currency_id: currencyIdReq,
      account_id: counterAccountInfo.account.account_id,
      transaction_actual_date,
      currency_code,
      account_name: counterAccountInfo.account.account_name,
      account_type_name: 'bank',
      account_type_id: counterAccountInfo.account.account_type_id,
      balance: newCounterAccountBalance,
    };

    //-- UPDATE BALANCE OF COUNTER ACCOUNT INTO user_accounts table
    const updatedCounterAccountInfo = await updateAccountBalance(
      newCounterAccountBalance,
      slackCounterAccountInfo.account_id,
      transaction_actual_date
    );
    console.log(
      '🚀 ~ createBasicAccount ~ updatedCounterAccountInfo:',
      updatedCounterAccountInfo
    );

    //--- determine which account serves as a SOURCE OR DESTINATION account
    const { destination_account_id, source_account_id, isAccountOpening } =
      determineSourceAndDestinationAccounts(newAccountInfo, counterAccountInfo);
    //---------------------------------------------------------------
    //------- RECORD TRANSACTION INTO transactions table ----
    //---------------------------------------------------------------
    //--------Rules to register  a transaction
    //movement_type_name:account-opening, movement_type_id: 8,  transaction_type_name:lend/borrow/account-opening, transaction_type_id: 2/3/4/5
    //nombre de la cuenta principal- tipo de cuenta -initial-transaction type name
    //*************************************
    //------MOVEMENT TYPE ASSOCIATED TO CREATE A NEW ACCOUNT ---
    const movement_type_id = 8; //account opening
    // console.log(
    //   userId,
    //   account_id,
    //   transactionDescription,
    //   movement_type_id,
    //   transaction_type_id,
    //   // status,
    //   debtor_account_balance,
    //   currencyIdReq,
    //   account_id,
    //   source_account_id,
    //   destination_account_id,
    //   transaction_actual_date
    // );
    //--------REGISTER NEW ACCOUNT TRANSACTION -------
    const transactionOption = {
      userId: newAccountInfo.user_id,
      description: newAccountInfo.description,
      transaction_type_id: newAccountInfo.transaction_type_id,
      amount: newAccountInfo.amount, //initial balance
      currency_id: newAccountInfo.currency_id,
      account_id: newAccountInfo.account_id,
      source_account_id,
      destination_account_id,
      movement_type_id,
      status: 'complete',
      transaction_actual_date: newAccountInfo.transaction_actual_date,
    };

    const recordTransactionInfo = await recordTransaction(transactionOption);

    //--------REGISTER COUNTER ACCOUNT (SLACK) TRANSACTION -------------------
    const counterTransactionOption = {
      userId: slackCounterAccountInfo.user_id,
      description: slackCounterAccountInfo.description,
      transaction_type_id: slackCounterAccountInfo.transaction_type_id,
      amount: slackCounterAccountInfo.amount, //initial balance
      currency_id: slackCounterAccountInfo.currency_id,
      account_id: slackCounterAccountInfo.account_id,
      source_account_id,
      destination_account_id,
      movement_type_id,
      status: 'complete',
      transaction_actual_date: slackCounterAccountInfo.transaction_actual_date,
    };

    const counterTransactionInfo = !isAccountOpening
      ? await recordTransaction(counterTransactionOption)
      : {};

    await client.query('COMMIT');
    //----------------------------------------------------------------
    //SUCCESS MESSAGE RESPONSE
    const message = `${account_name} account of type ${account_type_name} with id ${account_id} was successfully created `;
    console.log('🚀 ~ createAccount ~ message:', message);

    return res.status(201).json({
      status: 201,
      data: {
        account_basic_data: {
          ...account_basic_data,
          account_type_name,
          currency_code,
        },
        new_debtor_account: debtor_account,

        new_account_data: {
          account_name: newAccountInfo.account_name,
          transaction_data: transactionOption,
          transaction_info: recordTransactionInfo,
          transaction_type_name: newAccountInfo.transaction_type_name,
        },
        counter_account_data: {
          account_name: counterTransactionInfo.account_name,
          transaction_data: counterTransactionOption,
          transaction_info: counterTransactionInfo,
          transaction_type_name: counterTransactionInfo.transaction_type_name,
        },
      },
      message,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    //handle pg errors
    const { code, message } = handlePostgresError(error);
    console.error(
      pc.red('when creating debtor account:'),
      message || 'something wrong'
    );
    return next(createError(code, message));
  } finally {
    client.release();
  }
};
//----------------------
//POST: http://localhost:5000/api/fintrack/account/new_account/pocket_saving?user=6e0ba475-bf23-4e1b-a125-3a8f0b3d352c
export const createPocketAccount = async (req, res, next) => {
  //basic_account_data:  userId,account_type_name,currency_code,amount,account_start_date,account_starting_amount,
  //account type: pocket_saving.
  //movement_type_name:'account-opening', movement_type_id: 8, transaction_type_name:deposit / withdraw

  console.log(pc.blueBright('createPocketAccount'));
  console.log(req.body, req.params, req.query, req.originalUrl);

  const client = await pool.connect();
  try {
    //implement verifyUser middleware and then get userId from res.user
    const { user: userId } = req.query;

    if (!userId) {
      const message = 'User ID is required';
      console.warn(pc.blueBright(message));
      return res.status(400).json({ status: 400, message });
    }

    //data from new pocket saving form
    const { name, note, targetAmount, transactionTypeName, sourceAccountId } =
      req.body;

    const transaction_type_name = transactionTypeName
      ? transactionTypeName
      : 'deposit';

    //check coherence of type account requested
    const account_type_name = 'pocket_saving';
    const typeAccountRequested = req.originalUrl.split('/').pop().split('?')[0];
    const checkTypeCoherence = typeAccountRequested === account_type_name;
    if (!checkTypeCoherence) {
      const message = `Check coherence between account type requested on url: ${typeAccountRequested.toUpperCase()} vs account type entered: ${account_type_name.toUpperCase()}`;
      console.warn('Warning:', pc.cyanBright(message));
      throw new Error(message);
    }
    //----
    //account basic data
    const { currency, date, transactionActualDate, amount } = req.body;
    const currency_code = currency ? currency : 'usd';
    const account_name = `${name}`;
    const account_start_date = !!date && date !== '' ? date : new Date();

    if (amount < 0) {
      const message = 'Amount must be >= 0. Tray again!';
      console.warn(pc.redBright(message));
      return res.status(400).json({ status: 400, message });
    }

    const account_starting_amount = amount ? parseFloat(amount) : 0.0;

    const target =
      targetAmount && !targetAmount < 0 ? parseFloat(targetAmount) : 0.0;

    const transaction_actual_date =
      !transactionActualDate || transactionActualDate == ''
        ? new Date()
        : transactionActualDate;

    //if there is not a desired date then consider one year from now
    let { desired_date } = req.body;
    if (!desired_date || desired_date == '') {
      const newDate = new Date(account_start_date);
      newDate.setFullYear(newDate.getFullYear() + 1);
      desired_date = newDate.toISOString();
    }
    //----------------------------------
    //currency and account_type data, are better defined by frontend
    if (!account_type_name || !currency_code || !account_name) {
      const message =
        'Currency_code, account name and account type name fields are required';
      console.warn(pc.blueBright(message));
      return res.status(400).json({ status: 400, message });
    }
    //------
    //get all account types and then get the account type id requested
    const accountTypeQuery = `SELECT * FROM account_types`;
    const accountTypeResult = await pool.query(accountTypeQuery);
    const accountTypeArr = accountTypeResult.rows;
    const accountTypeIdReqObj = accountTypeArr.filter(
      (type) => type.account_type_name == account_type_name.trim()
    )[0];
    const accountTypeIdReq = accountTypeIdReqObj.account_type_id;
    // console.log('🚀 ~ createAccount ~ account_type_id:', accountTypeIdReq);
    //-------
    //verify account existence in user_accounts by userId and account name
    const accountExistQuery = {
      text: `SELECT ua.* FROM user_accounts ua
      JOIN account_types act ON ua.account_type_id = act.account_type_id
      WHERE ua.user_id = $1 AND ua.account_name ILIKE $2 AND act.account_type_name ILIKE $3`,
      values: [userId, `%${account_name}%`, `%${account_type_name}%`],
    };
    const accountExistResult = await pool.query(accountExistQuery);
    const accountExist = accountExistResult.rows.length > 0;
    // console.log('🚀 ~ createAccount ~ accountExist:', accountExist);
    if (accountExist) {
      const message = `${accountExistResult.rows.length} account(s) found with a similar name ${account_name} of type ${account_type_name}. Try again`;
      console.log(pc.blueBright(message));
      throw new Error(message);
    }
    //---
    //get currency id from currency_code requested
    const currencyQuery = `SELECT * FROM currencies`;
    const currencyResult = await pool.query(currencyQuery);
    const currencyArr = currencyResult?.rows;
    const currencyIdReq = currencyArr.filter(
      (currency) => currency.currency_code === currency_code
    )[0].currency_id;
    // console.log('🚀 ~ createAccount ~ currencyIdReq:', currencyIdReq);
    //---
    //---pocket_initial_balance
    const account_balance =
      transaction_type_name === 'withdraw'
        ? account_starting_amount * -1
        : account_starting_amount;

    //user_accounts to insert data
    await client.query('BEGIN');
    const insertQuery = {
      text: `INSERT INTO user_accounts(user_id,
      account_name,
      account_type_id,
      currency_id,
      account_starting_amount,
      account_balance,
      account_start_date) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      values: [
        userId,
        account_name,
        accountTypeIdReq,
        currencyIdReq,
        account_starting_amount,
        account_balance, //initial balance
        account_start_date,
      ],
    };
    const accountResult = await pool.query(insertQuery);
    const account_basic_data = {
      ...accountResult.rows[0],
      account_type_name,
      currency_code,
    };
    const account_id = accountResult.rows[0].account_id;

    // insert data
    const pocket_saving_accountQuery = {
      text: `INSERT INTO pocket_saving_accounts (account_id,target,desired_date,account_start_date) VALUES ($1,$2,$3,$4) RETURNING *`,
      values: [account_id, target, desired_date, account_start_date],
    };

    const pocket_saving_accountResult = await pool.query(
      pocket_saving_accountQuery
    );

    const pocket_saving_account = {
      ...pocket_saving_accountResult.rows[0],
      currency_code,
      account_type_name,
    };

    const message = `Pocket saving ${account_name} account was successfully created`;
    console.log('🚀 ~ createAccount ~ message:', message);

    //-----------Register transaction
    //Add deposit transaction
    //movement_type_name:account-opening, movement_type_id: 7,  transaction_type_name:deposit/withdraw/account-opening, transaction_type_id: 2/1/5
    //nombre de la cuenta principal- tipo de cuenta -initial-transaction type name
    //*************************************
    //tratar de tomar los valores dinamicamente de la consulta de base de datos sobre tipo de transaccion y tipo de movimiento en cuanto a id y a name
    //*************************************

    const transactionTypeDescription = determineTransactionType(
      account_balance,
      account_type_name
    );
    console.log(
      '🚀 ~ createPocketAccount ~ transactionTypeDescription:',
      transactionTypeDescription
    );

    const transaction_type_idResult = await pool.query({
      text: `SELECT transaction_type_id FROM transaction_types WHERE transaction_type_name = $1`,
      values: [transactionTypeDescription],
    });

    const transaction_type_id =
      transaction_type_idResult.rows[0].transaction_type_id;

    const transactionDescription = `Account: ${account_name} type: ${account_type_name}. Initial-(${transactionTypeDescription})`;

    const source_account_id = sourceAccountId || account_id;

    const destination_account_id = account_id;

    const movement_type_id = 8; //account opening

    console.log(
      userId,
      account_id,
      transactionDescription,
      movement_type_id,
      transaction_type_id,
      // status,
      account_balance,
      currencyIdReq,
      source_account_id,
      destination_account_id,
      transaction_actual_date
    );

    const transactionOption = {
      userId,
      description: transactionDescription,
      movement_type_id,
      transaction_type_id, //deposit or lend
      status: 'complete',
      amount: account_balance, //initial balance
      currency_id: currencyIdReq,
      account_id,
      source_account_id,
      destination_account_id,
      transaction_actual_date,
    };

    recordTransaction(transactionOption);
    //actualizar balance en cuenta slack
    //registrar movements y debtor_movements
    // ------
    await client.query('COMMIT');
    return res.status(201).json({
      status: 201,
      data: { account_basic_data, pocket_saving_account },
      message,
    });

    //--------------------
  } catch (error) {
    await client.query('ROLLBACK');
    //handle pg errors
    const { code, message } = handlePostgresError(error);
    console.error(
      pc.red('when creating account:'),
      message || 'something wrong'
    );
    return next(createError(code, message));
  } finally {
    client.release();
  }
};
//----------------------

//----------------------
//POST: http://localhost:5000/api/fintrack/account/new_account/category_budget?user=6e0ba475-bf23-4e1b-a125-3a8f0b3d352c
export const createCategoryBudgetAccount = async (req, res, next) => {
  //basic_account_data:  userId,account_type_name,currency_code,amount,account_start_date,account_starting_amount,
  //account type: category_budget.
  //movement_type_name:'account-opening', movement_type_id: 8, transaction_type_name:deposit
  console.log(pc.blueBright('createCategoryBudgetAccount'));
  // console.log(req.body, req.params, req.query);
  const client = await pool.connect();
  try {
    //implement verifyUser middleware and then get userId from res.user
    const { user: userId } = req.query;
    if (!userId) {
      const message = 'User ID is required';
      console.warn('message:', message);
      return res.status(400).json({ status: 400, message });
    }
    //data from budget new category form
    const {
      nature: nature_type_name_req,
      subcategory,
      name: category_name,
      budget,
      sourceAccountId,
      transactionActualDate,
    } = req.body;

    //account basic data
    const { currency, date, amount } = req.body;
    const currency_code = currency ? currency : 'usd';
    const account_start_date = !!date && date !== '' ? date : new Date();
    const transaction_actual_date =
      !transactionActualDate || transactionActualDate == ''
        ? new Date()
        : transactionActualDate;

    //category_budget account
    const account_type_name = 'category_budget';
    const account_name =
      account_type_name === 'category_budget'
        ? req.body.name + '_' + req.body.nature
        : req.body.name;

    const category_nature_budget = budget ? parseFloat(budget) : 0.0;

    if (budget < 0) {
      const message = 'Budget amount must be >= 0. Tray again!';
      console.warn(pc.redBright(message));
      return res.status(400).json({ status: 400, message });
    }
    const account_starting_amount = amount ? parseFloat(amount) : 0.0; //initial amount received (expense from other accounts)
    //---category_budget_initial_balance / VERIFICAR NATURE
    const account_balance = account_starting_amount; //initial amount spent in the balance (expense from other accounts)

    //CHECK WEATHER IT CAN BE SPENT WHEN NO BUDGET HAS BEEN ASSIGNED TO THE ACCOUNT. IT SHOULD NOT.
    //CUANDO SE ASIGNA UN BUDGET, ?SE RESERVA ALGUN DINERO DE ALGUNA OTRA CUENTA?
    //----------------------------------
    // console.log('userId', userId);
    //----------------------------------
    //currency and account_type data, are better defined by frontend
    if (!account_type_name || !currency_code || !account_name) {
      const message =
        'Currency_code, account name and account type name fields are required';
      console.warn(pc.blueBright(message));
      return res.status(400).json({ status: 400, message });
    }
    //-----
    //get all account types and then get the account type id requested
    const accountTypeQuery = `SELECT * FROM account_types`;
    const accountTypeResult = await pool.query(accountTypeQuery);
    const accountTypeArr = accountTypeResult.rows;
    // console.log('🚀 ~ createAccount ~ accountTypeArr:', accountTypeArr);
    const accountTypeIdReqObj = accountTypeArr.filter(
      (type) => type.account_type_name == account_type_name.trim()
    )[0];
    const accountTypeIdReq = accountTypeIdReqObj.account_type_id;
    //---
    //verify account existence in user_accounts by userId and account name
    const accountExistQuery = {
      text: `SELECT ua.* FROM user_accounts ua
      JOIN account_types act ON ua.account_type_id = act.account_type_id
      WHERE ua.user_id = $1 AND ua.account_name ILIKE $2 AND act.account_type_name ILIKE $3`,
      values: [userId, `%${account_name}%`, `%${account_type_name}%`],
    };
    const accountExistResult = await pool.query(accountExistQuery);
    const accountExist = accountExistResult.rows.length > 0;

    if (accountExist) {
      const message = `${accountExistResult.rows.length} account(s) found with a similar name ${account_name} of type ${account_type_name}. Try again`;
      console.log(pc.blueBright(message));
      throw new Error(message);
    }
    //---
    //check data for creating: category_budget,income_source, pocket_saving, debtor, investment, bank
    //---
    //get currency id from currency_code requested
    const currencyQuery = `SELECT * FROM currencies`;
    const currencyResult = await pool.query(currencyQuery);
    const currencyArr = currencyResult?.rows;
    const currencyIdReq = currencyArr.filter(
      (currency) => currency.currency_code === currency_code
    )[0].currency_id;
    //---
    //transaction to insert data
    await client.query('BEGIN');
    const insertQuery = {
      text: `INSERT INTO user_accounts(user_id,
      account_name,
      account_type_id,
      currency_id,
      account_starting_amount,
      account_balance,
      account_start_date) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      values: [
        userId,
        account_name,
        accountTypeIdReq,
        currencyIdReq,
        account_starting_amount,
        account_balance, //initial balance
        account_start_date,
      ],
    };
    const accountResult = await pool.query(insertQuery);
    const account_basic_data = accountResult.rows[0];
    const account_id = accountResult.rows[0].account_id;
    //--------
    //   check existence
    const categoryAndNatureQuery = {
      text: `SELECT cba.* FROM category_budget_accounts cba
  JOIN category_nature_types cnt ON cba.category_nature_type_id = cnt.category_nature_type_id
  WHERE cba.category_name = $1 AND cnt.category_nature_type_name=$2`,
      values: [category_name, nature_type_name_req],
    };
    const categoryAndNatureExistsResult = await pool.query(
      categoryAndNatureQuery
    );
    const categoryAndNatureExists =
      categoryAndNatureExistsResult.rows.length > 0;

    if (categoryAndNatureExists) {
      await client.query('ROLLBACK');
      const message = `Category ${category_name} with nature ${nature_type_name_req} account already exists. Try again`;
      console.warn('🚀 ~ createAccount ~ message:', message);
      throw new Error(message);
    }
    //----
    const category_nature_type_id_reqResult = await pool.query({
      text: `SELECT category_nature_type_id FROM category_nature_types WHERE category_nature_type_name = $1`,
      values: [nature_type_name_req],
    });

    const category_nature_type_id_req =
      category_nature_type_id_reqResult.rows[0].category_nature_type_id;
    //--------
    // insert data
    const category_budget_accountQuery = {
      text: `INSERT INTO category_budget_accounts(account_id, category_name,category_nature_type_id,subcategory,budget,account_start_date ) VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
      values: [
        account_id,
        category_name,
        category_nature_type_id_req,
        subcategory,
        category_nature_budget,
        account_start_date,
      ],
    };
    const category_budget_accountResult = await pool.query(
      category_budget_accountQuery
    );
    const category_budget_account = {
      ...category_budget_accountResult.rows[0],
      nature_type_name: nature_type_name_req,
      currency_code,
    };
    //-----------Register transaction
    //Add deposit transaction
    //movement_type_name:account-opening, movement_type_id: 7,  transaction_type_name:deposit/account-opening, transaction_type_id: 2/5
    //nombre de la cuenta principal- tipo de cuenta -initial-transaction type name
    //*************************************
    //tratar de tomar los valores dinamicamente de la consulta de base de datos sobre tipo de transaccion y tipo de movimiento en cuanto a id y a name
    //*************************************
    const transactionTypeDescription = determineTransactionType(
      account_balance,
      account_type_name
    );
    console.log(
      '🚀 ~ createPocketAccount ~ transactionTypeDescription:',
      transactionTypeDescription
    );
    const transaction_type_idResult = await pool.query({
      text: `SELECT transaction_type_id FROM transaction_types WHERE transaction_type_name = $1`,
      values: [transactionTypeDescription],
    });
    const transaction_type_id =
      transaction_type_idResult.rows[0].transaction_type_id;

    const transactionDescription = `Account: ${account_name} type: ${account_type_name}. Initial-(${transactionTypeDescription})`;

    const source_account_id = sourceAccountId || account_id;

    const destination_account_id = account_id;

    const movement_type_id = 8; //account opening

    console.log(
      userId,
      account_id,
      transactionDescription,
      movement_type_id,
      transaction_type_id,
      // status,
      account_balance,
      currencyIdReq,
      source_account_id,
      destination_account_id,
      transaction_actual_date
    );

    const transactionOption = {
      userId,
      description: transactionDescription,
      movement_type_id,
      transaction_type_id, //deposit or lend
      status: 'complete',
      amount: account_balance, //initial balance
      currency_id: currencyIdReq,
      source_account_id,
      destination_account_id,
      transaction_actual_date,
    };

    recordTransaction(transactionOption);
    //actualizar balance en cuenta slack
    //registrar movements y debtor_movements
    // ------

    await client.query('COMMIT');

    const message = `${account_name} account of type ${account_type_name} was successfully created `;
    console.log('🚀 ~ createAccount ~ message:', message);

    return res.status(201).json({
      status: 201,
      data: {
        account_basic_data: {
          ...account_basic_data,
          account_type_name,
          nature_type_name: nature_type_name_req,
          currency_code,
        },
        category_budget_account,
      },
      message,
    });
  } catch (error) {
    await client.query('ROLLBACK');

    const { code, message } = handlePostgresError(error); //handle pg errors
    console.error(
      pc.red('when creating account:'),
      message || 'something wrong'
    );
    return next(createError(code, message));
  } finally {
    client.release();
  }
};
//--------------------
