//accountController.js

import pc from 'picocolors';
import {
  createError,
  handlePostgresError,
} from '../../../utils/errorHandling.js';
import { pool } from '../../db/configDB.js';

//incomeSourceController
//post: /api/fintrack/account/new_account?user='UUID'

export const createAccount = async (req, res, next) => {
  console.log(pc.blueBright('createAccount'));
  console.log(req.body, req.params, req.query);

  const client = await pool.connect();
  try {
    //implement verifyUser middleware and then get userId from res.user
    const { user: userId } = req.query;

    console.log(pc.bgCyan('userId', userId));

    if (!userId) {
      const message = 'User ID is required';
      console.warn(pc.blueBright(message));
      return res.status(400).json({ status: 400, message });
    }
    //account basic data
    const {
      type: account_type_name,
      name,
      currency: currency_code,
      amount,
      date,
    } = req.body;
    const account_start_date = date ? date : new Date();
    const account_starting_amount = parseFloat(amount) ?? 0.0;
    console.log('🚀 ~ createAccount ~ account_start_date:', account_start_date);

    console.log(
      account_type_name,
      account_type_name.length,
      account_type_name === 'category_budget'
    );
    //account name convention for each account type

    const account_name =
      account_type_name === 'category_budget'
        ? name + '_' + req.body.nature
        : name;

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
    if (!account_type_name || !currency_code) {
      const message = 'Account_type_name and currency_code fields are required';
      console.warn(pc.blueBright(message));
      return res.status(400).json({ status: 400, message });
    }

    //get all account types and then get the account type id requested
    const accountTypeQuery = `SELECT * FROM account_types`;
    const accountTypeResult = await pool.query(accountTypeQuery);
    const accountTypeArr = accountTypeResult?.rows;
    console.log('🚀 ~ createAccount ~ accountTypeArr:', accountTypeArr);

    const accountTypeIdReqObj = accountTypeArr.filter(
      (type) => type.account_type_name == account_type_name.trim()
    )[0];
    const accountTypeIdReq = accountTypeIdReqObj.account_type_id;
    console.log('🚀 ~ createAccount ~ account_type_id:', accountTypeIdReq);

    //---

    //verify account existent in user_accounts by userId and account name
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

    //o se pudiera empezar preguntando por el tipo de cuent, desde el primer momento, y en funcion de eso, capturar el proximo account_id de la tabla user_accounts, y luego con ese account_id, llenar la tabla especifica, y luego al final del llenado salir, y llenar la user_account con los datos generales.
    //tratar luego con un switch

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

    console.log(account_start_date);

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

    const account_idResult = await pool.query(insertQuery);

    const account_id = account_idResult.rows[0].account_id;
    console.log(
      '🚀 ~ createAccount ~ account_id:',
      account_idResult.rows[0].account_id
      // account_id
    );

    // if (!account_id) {
    //   const message = 'error finding new account id';
    //   throw new Error(message);
    // }

    // values will be considered validated from frontend since they 're input by a controlled option selection

    //category_budget_account
    if (accountTypeIdReq === 5) {
      const {
        nature: nature_type_name_req,
        subcategory,
        name: category_name,
      } = req.body;

      //   insert later validation of nature and subcategory data
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
        const message = `Category ${category_name} with nature ${nature_type_name_req} account already exists. Try again`;
        console.warn('🚀 ~ createAccount ~ message:', message);
        throw new Error(message);
      }

      const category_nature_type_id_reqResult = await pool.query({
        text: `SELECT category_nature_type_id FROM category_nature_types WHERE category_nature_type_name = $1`,
        values: [nature_type_name_req],
      });

      const category_nature_type_id_req =
        category_nature_type_id_reqResult.rows[0].category_nature_type_id;

      console.log(
        category_nature_type_id_reqResult.rows[0].category_nature_type_id,
        category_nature_type_id_req
      );

      await client.query('COMMIT');
      console.log('🚀 ~ createAccount ~ insertQuery:', insertQuery);

      const category_budget_accountQuery = {
        text: `INSERT INTO category_budget_accounts(account_id, category_name,category_nature_type_id,subcategory,budget) VALUES($1,$2,$3,$4,$5) RETURNING *`,
        values: [
          account_id,
          category_name,
          category_nature_type_id_req,
          subcategory,
          account_starting_amount,
        ],
      };

      const category_budget_accountResult = await pool.query(
        category_budget_accountQuery
      );
      const category_budget_account = category_budget_accountResult.rows[0];

      console.log(
        '🚀 ~ createAccount ~ category_budget_accountResult:',
        category_budget_account
      );

      console.log({ accountTypeIdReq }, currencyIdReq, { account_id });

      // console.log(
      //   `Category budget account created: ${category_budget_accountResult.rows[0]}`
      // );
      const message = `Category ${category_name} with nature ${nature_type_name_req} account was create successfully`;
      console.log('🚀 ~ createAccount ~ message:', message);

      return res.status(201).json({
        status: 201,
        data: category_budget_accountResult.rows[0],
        message,
      });
    }

    //pocket_saving
    // if (accountTypeIdReq === 4) {
    //   const { note, desired_date, target } = req.body;
    // }

    //debtor
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
    client.query('ROLLBACK');
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
