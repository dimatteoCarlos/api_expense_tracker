//addMoneyToAccount
//deleteAccount
//getAccount

import { validateAndNormalizeDate } from '../../utils/helpers.js';
import { pool } from '../db/configDB.js';
import {
  createError,
  handlePostgresError,
  handlePostgresErrorEs,
} from '../../utils/errorHandling.js';

//endpoint :  http://localhost:5000/api/accounts/?user=userId&account_type=all&limit=0&offset=0
//before calling getAccount user must be verified with verifyUser() authmiddleware; in that case take userId from req.user

//createAccount
export const createAccount = async (req, res, next) => {
  console.log('createAccount');
  console.log('req.query;', req.query);
  const client = await pool.connect(); // Get a client from the pool
  try {
    const { user: userId } = req.query;
    if (!userId) {
      return res
        .status(400)
        .json({ status: 400, message: 'User ID is required.' });
    }
    //que pasa si el user es undefined o si no existe en las tablas de user? creo que para llegar aqui, dberia pasarse por verifyUser

    await client.query('BEGIN');
    const {
      name: account_name,
      type: account_type_name,
      currency: currency_code,
      amount: account_starting_amount,
      date: account_start_date,
    } = req.body;

    const accountStartDateNormalized =
      validateAndNormalizeDate(account_start_date);

    console.log(
      '🚀 ~ createAccount ~ accountStartDateNormalized:',
      accountStartDateNormalized
    );

    if (
      !account_name ||
      !account_type_name ||
      !currency_code ||
      !account_starting_amount ||
      !accountStartDateNormalized
    ) {
      const message = 'All fields are required';
      console.log(message);
      return res.status(400).json({ status: 400, message });
    }

    //search for existent user_accounts by userId and account name
    const accountExistQuery = {
      text: `SELECT * FROM user_accounts WHERE user_id = $1 AND account_name ILIKE $2`,
      values: [userId, `%${account_name}%`],
    };

    const accountExistResult = await pool.query(accountExistQuery);
    const accountExist = accountExistResult.rows.length > 0;

    console.log(
      '🚀 ~ createAccount ~ accountExist:',
      accountExist
      // accountExistResult.rows[0].account_name ?? 'non exists'
    );

    if (accountExist) {
      await pool.query('ROLLBACK');
      return res.status(409).json({
        status: 409,
        message: `${accountExistResult.rows.length} account(s) found with a similar name`,
        account_found: [accountExistResult.rows[0].account_name],
      });
    }

    //currency and account type ids handling (since theses are chosen from a select on the browser frontend, existence should be warant)
    const currencyIdResult = await pool.query({
      text: `SELECT currency_id FROM currencies WHERE currency_code = $1`,
      values: [currency_code],
    });

    if (currencyIdResult.rows.length === 0) {
      await client.query('ROLLBACK');
      const message = `Currency with code ${currency_code} was not found.`;
      console.log(message);
      return res.status(404).json({ status: 404, message });
    }

    const accountTypeIdResult = await pool.query({
      text: `SELECT account_type_id FROM account_types WHERE account_type_name = $1`,
      values: [account_type_name],
    });

    if (accountTypeIdResult.rows.length === 0) {
      await client.query(`ROLLBACK`);
      const message = `Account type with name ${account_type_name} was not found`;
      console.log(message);
      // return res.status(404).json({
      //   status: 404,
      //   message,
      // });
      // Send response to frontend
      next(createError(404, message));
    }

    const currencyId = currencyIdResult.rows[0].currency_id,
      accountTypeId = accountTypeIdResult.rows[0].account_type_id;

    console.log('🚀 ~ createAccount ~ currencyId:', currencyId);
    console.log('🚀 ~ createAccount ~ accountTypeId:', accountTypeId);

    //update user_accounts by inserting the new account
    //existence of user_accounts must be checked
    const createAccountResult = await pool.query({
      text: `INSERT INTO user_accounts(user_id, account_name,
       account_type_id, currency_id,
       account_starting_amount, account_balance, account_start_date)
        VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      values: [
        userId,
        account_name,
        accountTypeId,
        currencyId,
        account_starting_amount,
        account_starting_amount, //initial account balance is equal to starting amount
        accountStartDateNormalized,
      ],
    });

    //Add initial deposit transaction
    const newAccount = createAccountResult.rows[0];
    const description = `${newAccount.account_name} - (initial Deposit)`;
    const movement_type_id = 2; // represents "income" type movement

    //BUSCAR currncy_id, source_id con base en los datos suministrados en el body
    //Search currency_id and source_id base on body data
    const initialDepositQuery = {
      text: `INSERT INTO transactions(user_id, description, movement_type_id, status,  amount, currency_id,  account_name ) VALUES($1,$2,$3,$4,$5,$6,$7)`,
      values: [
        userId,
        description,
        movement_type_id,
        'completed',
        account_starting_amount,
        currencyId,
        newAccount.account_name,
      ],
    };

    await pool.query(initialDepositQuery);

    //opcion de crear cuentas en un arreglo y guardarlo en users
    //UPDATE users SET accounts_id = array_cat(accounts, $1), update_dat = CURRENT_TIMESTAMP id=$2 RETURNING *, values:[accounts, userId]

    //transaction confirmed
    await client.query('COMMIT');

    //Successfull answer
    res.status(200).json({
      message: `${newAccount.account_name} Account created successfully`,
      data: newAccount,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(
      'when creating account:',
      error.message || 'something went wrong'
    );
    // Handle PostgreSQL error
    const { code, message } = handlePostgresError(error);

    // Send response to frontend
    // next(error);
    return next(createError(code, message));
  } finally {
    client.release(); //always release the client back to the pool
  }
};

//*********** */
//getAccount
export const getAccount = async (req, res, next) => {
  console.log('getAccount');

  try {
    console.log('req.query;', req.query);
    const { user: userId } = req.query;
    if (!userId) {
      return res
        .status(400)
        .json({ status: 400, message: 'User ID is required.' });
    }
    const { type } = req.query;
    // si type no existe, se tomaran todos los tipos. si existe, hay que verificar si esta catalogado, si no lo esta, seria un error. Si esta catalogado, recuperar el ac type id, para hacer la busqueda por el id.

    //si type existe , query de account_type_id segun el name, y luego el query de los account_type segun el user y el type_id.
    //si type no existe , query de account segun el user de todos los tipos de cuenta.
    // se hace el query seleccion, y si no existen valores, se despacha un error de registros not found

    if (type) {
      const typeAccountIdResult = await pool.query({
        text: `SELECT account_type_id FROM account_types WHERE account_type_name = $1`,
        values: [type],
      });
      console.log(
        '🚀 ~ getAccount ~ typeAccountIdResult:',
        typeAccountIdResult.rows
      );

      const typeAccountIdExists = typeAccountIdResult.rows.length > 0;
      console.log(
        '🚀 ~ getAccount ~ typeAccountIdExists:',
        typeAccountIdExists
      );
      const typeAccountId = typeAccountIdResult.rows[0].account_type_id;

      console.log('🚀 ~ getAccount ~ typeAccountId:', typeAccountId);

      if (!typeAccountIdExists) {
        const message = `Account type ${type} was not found.`;
        console.log(message);
        return res.status(404).json({ status: 404, message });
      }

      const accountsByTypeResult = await pool.query({
        text: `SELECT * FROM user_accounts WHERE user_id = $1 AND account_type_id = $2`,
        values: [userId, typeAccountId],
      });

      const accountsByTypeResultExists = accountsByTypeResult.rows.length > 0;

      if (!accountsByTypeResultExists) {
        const message = `No account of ${type} type for the user ${userId} was found.`;
        console.log(message);
        return res.status(404).json({ status: 404, message });
      }

      //Successfull answer. user accounts of user by type

      console.log(
        `${accountsByTypeResult.rows.length} account(s) successfully found of type ${type} for user ${userId}`
      );

      return res.status(200).json({
        message: `${accountsByTypeResult.rows.length} Account(s) successfully found of type ${type} for user ${userId}`,
        data: accountsByTypeResult.rows,
      });
    } else {
      const userAccountsResult = await pool.query({
        text: `SELECT * FROM user_accounts WHERE user_id = $1`,
        values: [userId],
      });

      const userAccountsResultExists = userAccountsResult.rows.length > 0;

      if (!userAccountsResultExists) {
        const message = `No account was found.`;
        console.log(message);
        return res.status(404).json({ status: 404, message });
      }

      //Successfull answer
      return res.status(200).json({
        message: `${userAccountsResult.rows.length} account(s) found`,
        data: userAccountsResult.rows,
      });
    }
  } catch (error) {
    console.error(
      'when getting the accounts:',
      error.message || 'something went wrong'
    );
    // Handle PostgreSQL error
    const { code, message } = handlePostgresErrorEs(error);

    // Send response to frontend
    return next(createError(code, message));
  }
};
