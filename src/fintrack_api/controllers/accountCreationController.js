//accountController.js

import pc from 'picocolors';
import {
  createError,
  handlePostgresError,
} from '../../../utils/errorHandling.js';
import { pool } from '../../db/configDB.js';
import { determineTransactionType } from '../../../utils/helpers.js';
import { recordTransaction } from '../../../utils/recordTransaction.js';
//import { validateAndNormalizeDate } from '../../../utils/helpers.js';
//post: /api/fintrack/account/new_account/account_type_name?user='UUID'
//use this only for ban, income_source and investment accounts
export const createBasicAccount = async (req, res, next) => {
  //basic_account_data:  userId,account_type_name,currency_code,amount,account_start_date,account_starting_amount
  //account types: bank, income_sorce, investment. Also, cash and slack attribute accounts
  //movement_type_name:'account-opening', movement_type_id: 8, transaction_type_name:deposit,

  console.log(pc.blueBright('createBasicAccount'));
  // console.log(
  //   'body:',
  //   req.body,
  //   'params:',
  //   req.params,
  //   'query:',
  //   req.query,
  //   'path:',
  //   req.path,
  //   'originalUrl:',
  //   req.originalUrl
  // );

  const client = await pool.connect();
  try {
    //implement verifyUser middleware and then get userId from res.user
    const { user: userId } = req.query;

    if (!userId) {
      const message = 'User ID is required';
      console.warn(pc.blueBright(message));
      return res.status(400).json({ status: 400, message });
    }
    //account basic data
    const {
      type: account_type_name,
      name: account_name,
      currency: currency_code,
      amount,
      date,
      transactionActualDate,
      sourceAccountId, //adaptar para cambiar a sourceAccountTypeName
    } = req.body;

    //check for the account_type_name = bank
    //check coherence of type account requested
    const typeAccountRequested = req.originalUrl.split('/').pop().split('?')[0];

//hay que decidir como introducir el tipo de cuenta, por una sola via
    if (account_type_name) {
      const checkTypeCoherence = typeAccountRequested === account_type_name;
      if (!checkTypeCoherence || !typeAccountRequested) {
        const message = `Check coherence between account type requested on url: ${typeAccountRequested.toUpperCase()} vs account type entered: ${account_type_name.toUpperCase()}`;
        console.warn('Warning:', pc.cyanBright(message));
        throw new Error(message);
      }
    }
    //---
    const account_start_date = !!date && date !== '' ? date : new Date();

    const transaction_actual_date =
      !transactionActualDate || transactionActualDate == ''
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
    const accountTypeQuery = `SELECT * FROM account_types`;
    const accountTypeResult = await pool.query(accountTypeQuery);
    const accountTypeArr = accountTypeResult.rows;

    // console.log('🚀 ~ createAccount ~ accountTypeArr:', accountTypeArr,  accountTypeArr[0]);

    const accountTypeIdReqObj = accountTypeArr.filter(
      (type) => type.account_type_name == account_type_name.trim()
    )[0];

    const accountTypeIdReq = accountTypeIdReqObj.account_type_id;

    console.log('🚀 ~ createAccount ~ account_type_id:', accountTypeIdReq);
    //---
    //verify account existence in user_accounts by userId and account name
    //verification of account_type_name should be here

    const accountExistQuery = {
      text: `SELECT ua.* FROM user_accounts ua
      JOIN account_types act ON ua.account_type_id = act.account_type_id
      WHERE ua.user_id = $1 AND ua.account_name ILIKE $2 AND act.account_type_name ILIKE $3`,
      values: [userId, `%${account_name}%`, `%${account_type_name}%`],
    };

    const accountExistResult = await pool.query(accountExistQuery);
    const accountExist = accountExistResult.rows.length > 0;
    console.log('🚀 ~ createAccount ~ accountExist:', accountExist);

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

    console.log('🚀 ~ createAccount ~ currencyIdReq:', currencyIdReq);

    //pg transaction to insert data  in user_accounts
    await client.query('BEGIN');
    // console.log({ account_start_date });

    const account_balance = account_starting_amount;
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

    // values should be considered validated from frontend since they 're input by a controlled option selection
    const message = `${account_name} account of type ${account_type_name} with ${account_id} id was successfully created `;
    console.log('🚀 ~ createAccount ~ message:', message);

    //----------------------------------------------------

    //-----------Register transaction
    //Add deposit transaction
    //movement_type_name:receive, movement_type_id: 8, transaction_type_name:deposit/account-opening, transaction_type_id: 2/5
    //nombre de la cuenta principal- tipo de cuenta -initial Deposit

    const transactionTypeDescription = determineTransactionType(
      account_balance,
      account_type_name
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

    // const movement_type_id = 8; //account opening
    // console.log(
    //   // userId,
    //   // account_id,
    //   // transactionDescription,
    //   // movement_type_id,
    //   // transaction_type_id,
    //   // status,
    //   // account_balance,
    //   // currencyIdReq,
    //   // source_account_id,
    //   // destination_account_id,
    //   // transaction_actual_date
    // );

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

    //registrar movements

    await client.query('COMMIT');

    return res.status(201).json({
      status: 201,
      data: {
        account_basic_data: {
          ...account_basic_data,
          account_type_name,
          currency_code,
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

    //data from debt new profile form
    const {
      debtor_lastname,
      debtor_name,
      value,
      selected_account_name, //QUE ES ESTA CUENTA EN DEBTOR INPUT?
      sourceAccountId, //optional
      type: debtor_transaction_type, //aqui type es el tipo de transaction, mientras que en los otras cuentas es el tipo de cuenta OJO!!! VERIFICAR COMO SERA EN EL FRONTEND
    } = req.body;

    const selected_account_id = 0; //ESCOGER ACOUNT ID SEGUN EL SELECTED ACCOUNT NAME

    const account_type_name = 'debtor';

    const debtorTypeTransactionInput = { lending: 'lend', borrowing: 'borrow' };

    const debtor_transaction_type_name =
      debtorTypeTransactionInput[debtor_transaction_type];

    //check coherence of type account requested
    const typeAccountRequested = req.originalUrl.split('/').pop().split('?')[0];
    const checkTypeCoherence = typeAccountRequested === account_type_name;
    if (!checkTypeCoherence) {
      const message = `Check coherence between account type requested on url: ${typeAccountRequested.toUpperCase()} vs account type entered: ${account_type_name.toUpperCase()}`;
      console.warn('Warning:', pc.cyanBright(message));
      throw new Error(message);
    }

    //----
    //account basic data
    const { currency, date, transactionActualDate } = req.body;
    const currency_code = currency ? currency : 'usd';
    const account_name = `${debtor_lastname}, ${debtor_name}`;
    const account_starting_amount = value ? parseFloat(value) : 0.0;

    //definir como se introduce la fecha y aque no esta contemplado en el input de fintrack para debtor
    const account_start_date = !!date && date !== '' ? date : new Date(); //in case it received a date
    const transaction_actual_date =
      !transactionActualDate || transactionActualDate == ''
        ? new Date()
        : transactionActualDate;

    //------------------
    console.log(pc.cyan(`userId: ${userId}`));

    //----------------------------------
    //currency and account_type data, are better defined by frontend
    if (!account_type_name || !currency_code || !account_name) {
      const message =
        'Currency_code, account name and account type name fields are required';
      console.warn(pc.blueBright(message));
      return res.status(400).json({ status: 400, message });
    }

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
    console.log('🚀 ~ createAccount ~ accountExist:', accountExist);

    if (accountExist) {
      const message = `${accountExistResult.rows.length} account(s) found with a similar name ${account_name} of type ${account_type_name}. Try again`;
      console.log(pc.blueBright(message));
      throw new Error(message);
    }

    //get currency id from currency_code requested
    const currencyQuery = `SELECT * FROM currencies`;
    const currencyResult = await pool.query(currencyQuery);
    const currencyArr = currencyResult?.rows;
    const currencyIdReq = currencyArr.filter(
      (currency) => currency.currency_code === currency_code
    )[0].currency_id;

    // console.log('🚀 ~ createAccount ~ currencyIdReq:', currencyIdReq);
    //---debtor_initial_balance
    const account_balance =
      debtor_transaction_type_name === 'borrow'
        ? account_starting_amount * -1
        : account_starting_amount;

    //transaction to insert data
    await client.query('BEGIN');
    // console.log({ account_start_date });

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
    const account_id = accountResult.rows[0].account_id;
    const account_basic_data = accountResult.rows[0];

    // values will be considered validated from frontend since they 're input by a controlled option selection

    // insert data
    const debtor_insertQuery = {
      text: `INSERT INTO debtor_accounts (account_id,debtor_lastname,debtor_name,value,selected_account_name,selected_account_id,account_start_date) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      values: [
        account_id,
        debtor_lastname,
        debtor_name,
        account_balance, //value,
        selected_account_name,
        selected_account_id,
        account_start_date,
      ],
    };
    const debtor_accountResult = await pool.query(debtor_insertQuery);
    const debtor_account = {
      ...debtor_accountResult.rows[0],
      currency_code,
      account_type_name,
    };

    const message = `${account_name} account of type ${account_type_name} was successfully created `;
    console.log('🚀 ~ createAccount ~ message:', message);

    //-----------Register transaction
    //Add deposit transaction
    //movement_type_name:account-opening, movement_type_id: 8,  transaction_type_name:lend/borrow/account-opening, transaction_type_id: 2/3/4/5
    //nombre de la cuenta principal- tipo de cuenta -initial-transaction type name

    //*************************************
    //tratar de tomar los valores dinamicamente de la consulta de base de datos sobre tipo de transaccion y tipo de movimiento en cuanto a id y a name

    console.log(
      'en debtor se introduce el transaction type name',
      debtor_transaction_type_name
    );

    //*************************************

    const transactionTypeDescription = determineTransactionType(
      account_balance,
      account_type_name
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

    return res.status(201).json({
      status: 201,
      data: {
        account_basic_data: {
          ...account_basic_data,
          account_type_name,
          currency_code,
        },
        debtor_account,
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

    if (amount < 0) {
      const message = 'Amount must be >= 0. Tray again!';
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
