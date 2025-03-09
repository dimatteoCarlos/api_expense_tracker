//accountController.js

import pc from 'picocolors';
import {
  createError,
  handlePostgresError,
} from '../../../utils/errorHandling.js';
import { pool } from '../../db/configDB.js';
//import { validateAndNormalizeDate } from '../../../utils/helpers.js';
//post: /api/fintrack/account/new_account/?user='UUID'

export const createBasicAccount = async (req, res, next) => {
  //basic_account_data:  userId,account_type_name,currency_code,amount,account_start_date,account_starting_amount,

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
    //check for the account_type_name = bank

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
    } = req.body;

    const typeAccountRequested = req.originalUrl.split('/').pop().split('?')[0];
    const checkTypeCoherence = typeAccountRequested === account_type_name;

    //check coherence of type account requested
    if (!checkTypeCoherence) {
      const message = `Check coherence between account type requested on url: ${typeAccountRequested.toUpperCase()} vs account type entered: ${account_type_name.toUpperCase()}`;
      console.warn('Warning:', pc.cyanBright(message));
      throw new Error(message);
    }

    const account_start_date = !!date && date !== '' ? date : new Date();
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

    // console.log('🚀 ~ createAccount ~ accountTypeArr:', accountTypeArr);

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
    //---
    //transaction to insert data
    await client.query('BEGIN');
    console.log({ account_start_date });

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
        account_starting_amount, //initial balance
        account_start_date,
      ],
    };
    const accountResult = await pool.query(insertQuery);
    const account_basic_data = accountResult.rows[0];
    const account_id = accountResult.rows[0].account_id;

    // values should be considered validated from frontend since they 're input by a controlled option selection
    const message = `${account_name} account of type ${account_type_name} was successfully created `;
    console.log('🚀 ~ createAccount ~ message:', message);

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
//--------------------
export const createDebtorAccount = async (req, res, next) => {
  //basic_account_data:  userId,account_type_name,currency_code,amount,account_start_date,account_starting_amount,
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
      selected_account_name,
      selected_account_id,
      debtor_transaction_type_name,
    } = req.body;

    //account basic data
    const { currency: currency_code, date } = req.body;

    const account_name = `${debtor_lastname},
    ${debtor_name}`;
    const account_type_name = 'debtor';

    const account_start_date = !!date && date !== '' ? date : new Date();

    const account_starting_amount = value ? parseFloat(value) : 0.0;

    //------------------
    console.log(pc.bgCyan('userId', userId));
    console.log(
      '🚀 ~ createAccount ~ account_start_date:',
      account_start_date,
      date
    );

    console.log(
      '🚀 ~ createAccount ~ account_start_date:',
      account_start_date,
      account_starting_amount
    );

    console.log(
      account_type_name,
      account_type_name.length,
      account_type_name === 'category_budget'
    );
    //----------------------------------

    //category_budget account
    // let account_name =
    // account_type_name === 'category_budget'
    //   ? name + '_' + req.body.nature
    //   : name;
    //-----------------------

    //----
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
    console.log('🚀 ~ createAccount ~ accountTypeArr:', accountTypeArr);

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

    //check data for creating: category_budget,income_source, pocket_saving, debtor, investment, bank

    //---
    //get currency id from currency_code requested
    const currencyQuery = `SELECT * FROM currencies`;
    const currencyResult = await pool.query(currencyQuery);
    const currencyArr = currencyResult?.rows;
    const currencyIdReq = currencyArr.filter(
      (currency) => currency.currency_code === currency_code
    )[0].currency_id;

    console.log('🚀 ~ createAccount ~ currencyIdReq:', currencyIdReq);
    //---

    //transaction to insert data
    await client.query('BEGIN');
    const debtor_balance =
      debtor_transaction_type_name === 'borrow'
        ? account_starting_amount * -1
        : account_starting_amount;

    console.log({ account_start_date });

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
        debtor_balance, //initial balance
        account_start_date,
      ],
    };

    const accountResult = await pool.query(insertQuery);
    const account_basic_data = accountResult.rows[0];
    const account_id = accountResult.rows[0].account_id;

    console.log(
      '🚀 ~ createAccount ~ account_id:',
      accountResult.rows[0].account_id,
      account_basic_data,
      account_id
    );

    // values will be considered validated from frontend since they 're input by a controlled option selection

    // insert data
    const debtor_accountQuery = {
      text: `INSERT INTO debtor_accounts (account_id,debtor_lastname,debtor_name,value,selected_account_name,
selected_account_id,debtor_transaction_type_name) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      values: [
        account_id,
        debtor_lastname,
        debtor_name,
        value,
        selected_account_name,
        selected_account_id,
        debtor_transaction_type_name,
      ],
    };

    await client.query('COMMIT');

    const debtor_accountResult = await pool.query(debtor_accountQuery);

    const debtor_account = {
      ...debtor_accountResult.rows[0],
      currency_code,
      account_type_name,
    };

    const message = `${account_name} account of type ${account_type_name} was successfully created `;
    console.log('🚀 ~ createAccount ~ message:', message);

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
//---
export const createPocketAccount = async (req, res, next) => {
  //basic_account_data:  userId,account_type_name,currency_code,amount,account_start_date,account_starting_amount,
  console.log(pc.blueBright('createPocketAccount'));
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

    //data from new pocket saving form
    let { note, desired_date, target, name, amount, type } = req.body;

    //account basic data
    const { currency: currency_code, date } = req.body;

    const account_name = `${name}`;
    const account_type_name = 'pocket_saving';

    const account_start_date = !!date && date !== '' ? date : new Date();
    const account_starting_amount = amount ? parseFloat(amount) : 0.0;
    target = target ? parseFloat(target) : 0.0;

    //if there is not a desired date then consider one year from now
    if (!desired_date) {
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

    //get all account types and then get the account type id requested
    const accountTypeQuery = `SELECT * FROM account_types`;
    const accountTypeResult = await pool.query(accountTypeQuery);
    const accountTypeArr = accountTypeResult.rows;

    // console.log('🚀 ~ createAccount ~ accountTypeArr:', accountTypeArr);

    const accountTypeIdReqObj = accountTypeArr.filter(
      (type) => type.account_type_name == account_type_name.trim()
    )[0];

    const accountTypeIdReq = accountTypeIdReqObj.account_type_id;
    // console.log('🚀 ~ createAccount ~ account_type_id:', accountTypeIdReq);

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
    // console.log('🚀 ~ createAccount ~ accountExist:', accountExist);

    if (accountExist) {
      const message = `${accountExistResult.rows.length} account(s) found with a similar name ${account_name} of type ${account_type_name}. Try again`;
      console.log(pc.blueBright(message));
      throw new Error(message);
    }

    //check data for creating: category_budget,income_source, pocket_saving, debtor, investment, bank

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
        account_starting_amount, //initial balance
        account_start_date,
      ],
    };

    const accountResult = await pool.query(insertQuery);
    const account_basic_data = {
      ...accountResult.rows[0],
      currency_code,
      account_type_name,
    };
    const account_id = accountResult.rows[0].account_id;

    // console.log(
    //   '🚀 ~ createAccount ~ account_id:',
    //   accountResult.rows[0].account_id,
    //   account_basic_data,
    //   account_id
    // );

    // values will be considered validated from frontend since they 're input by a controlled option selection
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
    };

    await client.query('COMMIT');

    const message = `Pocket saving ${account_name} account was successfully created`;
    console.log('🚀 ~ createAccount ~ message:', message);

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

//--------------------
export const createCategoryBudgetAccount = async (req, res, next) => {
  //basic_account_data:  userId,account_type_name,currency_code,amount,account_start_date,account_starting_amount,
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
    } = req.body;

    //account basic data
    const { currency, date, amount } = req.body;
    const currency_code = currency ? currency : 'usd';
    const account_start_date = !!date && date !== '' ? date : new Date();
    const account_starting_amount = amount ? parseFloat(amount) : 0.0; //initial value already spent

    //category_budget account
    const account_type_name = 'category_budget';
    const account_name =
      account_type_name === 'category_budget'
        ? req.body.name + '_' + req.body.nature
        : req.body.name;

    const category_nature_budget = budget ? parseFloat(budget) : 0.0;
    //-------------------------------------------
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
        account_starting_amount, //initial balance
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
