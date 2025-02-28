//createAccount
//addMoneyToAccount
//deleteAccount
//getAccount

import { validateAndNormalizeDate } from '../../utils/helpers.js';
import { pool } from '../db/configDB.js';
import {
  createError,
  handlePostgresErrorEs,
} from '../../utils/errorHandling.js';

//endpoint :  http://localhost:5000/api/accounts/?user=userId&account_type=all&limit=0&offset=0
//before calling getAccount user must be verified with verifyUser() authmiddleware; in that case take userId from req.user

export const createAccount = async (req, res, next) => {
  console.log('createAccount');
  console.log('req.query;', req.query);
  const client = await pool.connect(); // Get a client from the pool
  try {
    const { user: userId } = req.query;

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
    const { code, message } = handlePostgresErrorEs(error);

    // Send response to frontend
    next(error);
    return next(createError(code, message));
  } finally {
    client.release(); //always release the client back to the pool
  }
};
