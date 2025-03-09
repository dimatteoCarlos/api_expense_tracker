//accountController.js
//lo mas recomendable es un controlador para crear segun cada tipo de cuenta, con una routa especifica.
import pc from 'picocolors';
import {
  createError,
  handlePostgresError,
} from '../../../utils/errorHandling.js';
import { pool } from '../../db/configDB.js';
import { validateAndNormalizeDate } from '../../../utils/helpers.js';

//incomeSourceController
//post: /api/fintrack/account/new_account?user='UUID'

export const createBasicAccount = async (req, res, next) => {
  //basic_account_data:  userId,account_type_name,currency_code,amount,account_start_date,account_starting_amount,
  console.log(pc.blueBright('createBasicAccount'));
  console.log(req.body, req.params, req.query);

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

    const account_start_date = !!date && date !== '' ? date : new Date();

    const account_starting_amount = amount ? parseFloat(amount) : 0.0;

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
    // (amount =
    //   account_type_name === 'pocket_saving'
    //     ? parseFloat(req.body.target)
    //     : account_starting_amount);

    // account_start_date =account_type_name === 'pocket_saving' ? new Date() : account_start_date;

    //category_budget account
    // let account_name =
    // account_type_name === 'category_budget'
    //   ? name + '_' + req.body.nature
    //   : name;
    //-----------------------

    //attribute convention for each account type
    //debtor
    // account_name=,
    // accountTypeIdReq,
    // currencyIdReq,
    // account_starting_amount,
    // account_starting_amount, //initial balance
    // account_start_date,
    //pocket_saving
    //Deberia contemplar un amount como monto inicial de la cuenta de ahorro y sobre este hacer balance.

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

    console.log(
      '🚀 ~ createAccount ~ account_id:',
      accountResult.rows[0].account_id,
      account_basic_data,
      account_id
    );

    // values will be considered validated from frontend since they 're input by a controlled option selection

    //category_budget_account

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
    // }
    //--------------------
    //pocket_saving_accounts
    //pocket_saving
    // if (accountTypeIdReq === 4) {
    //   let { note, desired_date, target } = req.body;
    //   note = note ?? 'pockect saving note';

    //   //if not a desired date then consider one year from now
    //   if (!desired_date) {
    //     const newDate = new Date(account_start_date);
    //     newDate.setFullYear(newDate.getFullYear() + 1);
    //     desired_date = newDate.toISOString();
    //   }

    //   console.log(
    //     'just checking target:',
    //     target === amount,
    //     account_starting_amount,
    //     amount,
    //     desired_date
    //   );

    //   // insert data
    //   const pocket_saving_accountQuery = {
    //     text: `INSERT INTO pocket_saving_accounts (account_id,target,desired_date,account_start_date) VALUES ($1,$2,$3,$4) RETURNING *`,
    //     values: [account_id, target, desired_date, account_start_date],
    //   };

    //   await client.query('COMMIT');

    //   const pocket_saving_accountResult = await pool.query(
    //     pocket_saving_accountQuery
    //   );

    //   const pocket_saving_account = {
    //     pocket_saving_account: {
    //       ...pocket_saving_accountResult.rows[0],
    //       currency_code,
    //       account_type_name,
    //     },
    //   };

    //   console.log(
    //     '🚀 ~ createAccount ~ pocket_saving_account:',
    //     pocket_saving_account
    //   );

    //   const message = `Pocket saving ${account_name} account was successfully created`;
    //   console.log('🚀 ~ createAccount ~ message:', message);

    //   return res.status(201).json({
    //     status: 201,
    //     data: { pocket_saving_account, account_basic_data },
    //     message,
    //   });
    // }
    // console.log('🚀 ~ createAccount ~ accountTypeIdReq:', accountTypeIdReq);

    // //debtor_accounts
    // //debtor
    // if (accountTypeIdReq === 3) {
    //   const {
    //     debtor_lastname,
    //     debtor_name,
    //     value,
    //     selected_account_name,
    //     selected_account_id,
    //     debtor_transaction_type_name,
    //   } = req.body;
    // }

    //bank_account: bank or investment
    // if (accountTypeIdReq === 2) {
    //   const { nature, subcategory } = req.body;
    // }

    // bank_account:
    // if (!source_name) {
    //   const message = `Source name is required`;
    //   console.warn(pc.blueBright(message));
    //   return res.status(400).json({ status: 400, message });
    // }

    //table IncomeSources must exist - created at db initialization
    //verify source_name does not exist

    // const sourceNameExistResult = await pool.query({
    //   text: `SELECT * FROM income_sources WHERE user_id = $1 AND source_name ILIKE $2`,
    //   values: [userId, `%${source_name}%`],
    // });

    // if (sourceNameExistResult.rows.length > 0) {
    //   throw new Error(
    //     `${sourceNameExistResult.rows.length} income souce(s) found with a similar name. Try again`
    //   );
    // }

    // const sourceNameCreated = await pool.query({
    //   text: `INSERT INTO income_sources(user_id,source_name) VALUES($1,$2) RETURNING *`,
    //   values: [userId, source_name],
    // });

    // console.log(sourceNameCreated.rows[0]);

    // return res.status(200).json({
    //   message: `${account_name} account with the id ${account_id} was successfully  created`,
    //   data: aqui hay que regresar todos los datos de account? y account especifico, pero si son los mismos que entrego el frontend,
    //
    //  });
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

export const createDebtorAccount = async (req, res, next) => {
  //basic_account_data:  userId,account_type_name,currency_code,amount,account_start_date,account_starting_amount,
  console.log(pc.blueBright('createBasicAccount'));
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

    //data from new profile form
    const {
      debtor_lastname,
      debtor_name,
      value,
      selected_account_name,
      selected_account_id,
      debtor_transaction_type_name,
    } = req.body;

    // estos datos se enviaran desde el frontend.

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
    // (amount =
    //   account_type_name === 'pocket_saving'
    //     ? parseFloat(req.body.target)
    //     : account_starting_amount);

    // account_start_date =account_type_name === 'pocket_saving' ? new Date() : account_start_date;

    //category_budget account
    // let account_name =
    // account_type_name === 'category_budget'
    //   ? name + '_' + req.body.nature
    //   : name;
    //-----------------------

    //attribute convention for each account type
    //debtor
    // account_name=,
    // accountTypeIdReq,
    // currencyIdReq,
    // account_starting_amount,
    // account_starting_amount, //initial balance
    // account_start_date,
    //pocket_saving
    //Deberia contemplar un amount como monto inicial de la cuenta de ahorro y sobre este hacer balance.

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

    // }
    //--------------------
    //pocket_saving_accounts
    //pocket_saving
    // if (accountTypeIdReq === 4) {
    //   let { note, desired_date, target } = req.body;
    //   note = note ?? 'pockect saving note';

    //   //if not a desired date then consider one year from now
    //   if (!desired_date) {
    //     const newDate = new Date(account_start_date);
    //     newDate.setFullYear(newDate.getFullYear() + 1);
    //     desired_date = newDate.toISOString();
    //   }

    //   console.log(
    //     'just checking target:',
    //     target === amount,
    //     account_starting_amount,
    //     amount,
    //     desired_date
    //   );

    //   // insert data
    //   const pocket_saving_accountQuery = {
    //     text: `INSERT INTO pocket_saving_accounts (account_id,target,desired_date,account_start_date) VALUES ($1,$2,$3,$4) RETURNING *`,
    //     values: [account_id, target, desired_date, account_start_date],
    //   };

    //   await client.query('COMMIT');

    //   const pocket_saving_accountResult = await pool.query(
    //     pocket_saving_accountQuery
    //   );

    //   const pocket_saving_account = {
    //     pocket_saving_account: {
    //       ...pocket_saving_accountResult.rows[0],
    //       currency_code,
    //       account_type_name,
    //     },
    //   };

    //   console.log(
    //     '🚀 ~ createAccount ~ pocket_saving_account:',
    //     pocket_saving_account
    //   );

    //   const message = `Pocket saving ${account_name} account was successfully created`;
    //   console.log('🚀 ~ createAccount ~ message:', message);

    //   return res.status(201).json({
    //     status: 201,
    //     data: { pocket_saving_account, account_basic_data },
    //     message,
    //   });
    // }
    // console.log('🚀 ~ createAccount ~ accountTypeIdReq:', accountTypeIdReq);

    // //debtor_accounts
    // //debtor
    // if (accountTypeIdReq === 3) {
    //   const {
    //     debtor_lastname,
    //     debtor_name,
    //     value,
    //     selected_account_name,
    //     selected_account_id,
    //     debtor_transaction_type_name,
    //   } = req.body;
    // }

    //bank_account: bank or investment
    // if (accountTypeIdReq === 2) {
    //   const { nature, subcategory } = req.body;
    // }

    // bank_account:
    // if (!source_name) {
    //   const message = `Source name is required`;
    //   console.warn(pc.blueBright(message));
    //   return res.status(400).json({ status: 400, message });
    // }

    //table IncomeSources must exist - created at db initialization
    //verify source_name does not exist

    // const sourceNameExistResult = await pool.query({
    //   text: `SELECT * FROM income_sources WHERE user_id = $1 AND source_name ILIKE $2`,
    //   values: [userId, `%${source_name}%`],
    // });

    // if (sourceNameExistResult.rows.length > 0) {
    //   throw new Error(
    //     `${sourceNameExistResult.rows.length} income souce(s) found with a similar name. Try again`
    //   );
    // }

    // const sourceNameCreated = await pool.query({
    //   text: `INSERT INTO income_sources(user_id,source_name) VALUES($1,$2) RETURNING *`,
    //   values: [userId, source_name],
    // });

    // console.log(sourceNameCreated.rows[0]);

    // return res.status(200).json({
    //   message: `${account_name} account with the id ${account_id} was successfully  created`,
    //   data: aqui hay que regresar todos los datos de account? y account especifico, pero si son los mismos que entrego el frontend,
    //
    //  });
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
