import pc from 'picocolors';
import {
  createError,
  handlePostgresError,
} from '../../../utils/errorHandling.js';
import { pool } from '../../db/configDB.js';
import dotenv from 'dotenv';
dotenv.config();

const backendColor = 'greenBright';
const errorColor = 'red';
//get account info: id, name, type, currency and balance, by user id and account_type

//endpoint: http://localhost:5000/api/fintrack/account/type/?type=bank&user=6e0ba475-bf23-4e1b-a125-3a8f0b3d352c
//type can be: bank, category_budget,

export const getAccountByType = async (req, res, next) => {
  console.log(pc[backendColor]('getAccountByType'));

  try {
    const { type, user: userId } = req.query;

    const accountType = type.trim().toLowerCase();

    if (!accountType || !userId) {
      const message = `User ID and account type are required.Try again.`;
      console.warn(pc[backendColor](message));
      return res.status(400).json({ status: 400, message });
    }
    //type: bank = investment = income_source

    const accountTypeQuery = {
      bank: {
        typeQuery: {
          text: `SELECT ua.account_id, ua.account_name, ua.account_balance,  ct.currency_code, act.account_type_id, act.account_type_name,
          ua.account_starting_amount,  ua.account_start_date
       FROM user_accounts ua
       JOIN account_types act ON ua.account_type_id = act.account_type_id
       JOIN currencies ct ON ua.currency_id = ct.currency_id
       WHERE ua.user_id = $1
       AND act.account_type_name = $2 AND ua.account_name != $3
       ORDER BY ua.account_balance DESC
       `,
          values: [userId, accountType, 'slack'],
        },
      },

      category_budget: {
        typeQuery: {
          text: `SELECT ua.account_id, ua.account_name, ua.account_balance, 
   act.account_type_name,
   ct.currency_code, cba.budget, cnt.category_nature_type_name,
     ua.account_starting_amount,  ua.account_start_date
   FROM user_accounts ua
   JOIN account_types act ON ua.account_type_id = act.account_type_id
   JOIN currencies ct ON ua.currency_id = ct.currency_id
   JOIN category_budget_accounts cba ON ua.account_id = cba.account_id
   JOIN category_nature_types cnt ON cba.category_nature_type_id = cnt.category_nature_type_id
   WHERE ua.user_id =$1
   AND act.account_type_name = $2 AND ua.account_name != $3
   ORDER BY ABS(ua.account_balance) DESC
       `,
          values: [userId, accountType, 'slack'],
        },
      },

      income_source: {
        typeQuery: {
          text: `SELECT ua.account_id, ua.account_name, ua.account_balance, act.account_type_name, ct.currency_code, 
            ua.account_starting_amount,  ua.account_start_date
FROM user_accounts ua
JOIN account_types act ON ua.account_type_id = act.account_type_id
JOIN currencies ct ON ua.currency_id = ct.currency_id
  WHERE ua.user_id =$1
  AND act.account_type_name = $2 AND ua.account_name != $3
  ORDER BY ABS(ua.account_balance) DESC
      `,
          values: [userId, accountType, 'slack'],
        },
      },

      investment: {
        typeQuery: {
          text: `SELECT ua.account_id, ua.account_name, ua.account_balance, act.account_type_name, ct.currency_code, 
            ua.account_starting_amount,  ua.account_start_date
FROM user_accounts ua
JOIN account_types act ON ua.account_type_id = act.account_type_id
JOIN currencies ct ON ua.currency_id = ct.currency_id
  WHERE ua.user_id =$1
  AND act.account_type_name = $2 AND ua.account_name != $3
  ORDER BY ABS(ua.account_balance) DESC
      `,
          values: [userId, accountType, 'slack'],
        },
      },

      pocket_saving: {
        typeQuery: {
          text: `SELECT ua.account_id, ua.account_name, ua.account_balance, act.account_type_name, ct.currency_code, ps.target, ps.desired_date, ps.account_start_date, 
            ua.account_starting_amount,  ua.account_start_date
FROM user_accounts ua
JOIN account_types act ON ua.account_type_id = act.account_type_id
JOIN currencies ct ON ua.currency_id = ct.currency_id
JOIN pocket_saving_accounts ps ON ua.account_id = ps.account_id
  WHERE ua.user_id =$1
  AND act.account_type_name = $2 AND ua.account_name != $3
  ORDER BY ps.target DESC,  ABS(ua.account_balance) DESC
      `,
          values: [userId, accountType, 'slack'],
        },
      },

      debtor: {
        typeQuery: {
          text: `SELECT ua.account_id, ua.account_name, ua.account_balance, act.account_type_name, ct.currency_code,
          ps. value as starting_value, ps.debtor_name, ps.debtor_lastname, ps.selected_account_name,  ps.account_start_date, 
            ua.account_starting_amount,  ua.account_start_date
FROM user_accounts ua
JOIN account_types act ON ua.account_type_id = act.account_type_id
JOIN currencies ct ON ua.currency_id = ct.currency_id
JOIN debtor_accounts ps ON ua.account_id = ps.account_id
  WHERE ua.user_id =$1
  AND act.account_type_name = $2 AND ua.account_name != $3
  ORDER BY  (ua.account_balance) ASC
      `,
          values: [userId, accountType, 'slack'],
        },
      },
    };

    //check account type on ddbb
    //es necesario chequear si el usuario tiene ese tipo de cuentas?

    const accountListResult = await pool.query(
      accountTypeQuery[accountType].typeQuery
    );

    if (accountListResult.rows.length === 0) {
      const message = `No accounts of type: "${accountType}" available`;
      console.warn(pc[backendColor](message));
      return res.status(400).json({ status: 400, message });
    }

    const accountList = accountListResult.rows;

    //devolver el nombre de la cuenta, (balance actual), currency_code

    const data = { rows: accountList.length, accountList };
    const message = `Account list successfully completed `;
    console.log('success:', pc[backendColor](message));

    res.status(200).json({ status: 200, message, data });
  } catch (error) {
    if (error instanceof Error) {
      console.error(pc.red('Error while getting accounts by account type'));

      if (process.env.NODE_ENV === 'development') {
        console.log(error.stack);
      }
    } else {
      console.error(
        pc.red('Error during transfer'),
        pc[errorColor]('Unknown error occurred')
      );
    }
    // Manejo de errores de PostgreSQL
    const { code, message } = handlePostgresError(error);
    next(createError(code, message));
  }
};
//***************************************************/
//endpoint: http://localhost:5000/api/fintrack/account/allAccounts/?user=6e0ba475-bf23-4e1b-a125-3a8f0b3d352c

export const getAccounts = async (req, res, next) => {
  console.log(pc[backendColor]('getAccounts'));

  try {
    const { user: userId } = req.query;

    if (!userId) {
      const message = `User ID is required. Try again.`;
      console.warn(pc[backendColor](message));
      return res.status(400).json({ status: 400, message });
    }

    const accountTypeQuery = {
      all: {
        typeQuery: {
          text: `SELECT ua.*,  ct.currency_code,  act.account_type_name    
       FROM user_accounts ua
       JOIN account_types act ON ua.account_type_id = act.account_type_id
       JOIN currencies ct ON ua.currency_id = ct.currency_id
       WHERE ua.user_id = $1
       AND ua.account_name != $2
       ORDER BY ua.account_type_id ASC, ua.account_balance DESC
       `,
          values: [userId, 'slack'],
        },
      },
    };
    //check account type on ddbb
    //es necesario chequear si el usuario tiene ese tipo de cuentas?
    const accountListResult = await pool.query(
      accountTypeQuery['all'].typeQuery
    );
    if (accountListResult.rows.length === 0) {
      const message = `No accounts available`;
      console.warn(pc[backendColor](message));
      return res.status(400).json({ status: 400, message });
    }
    const accountList = accountListResult.rows;

    const data = { rows: accountList.length, accountList };

    const message = `Account list successfully completed `;
    console.log('success:', pc[backendColor](message));

    res.status(200).json({ status: 200, message, data });
  } catch (error) {
    if (error instanceof Error) {
      console.error(pc.red('Error while getting accounts by account type'));

      if (process.env.NODE_ENV === 'development') {
        console.log(error.stack);
      }
    } else {
      console.error(
        pc.red('Error during transfer'),
        pc[errorColor]('Unknown error occurred')
      );
    }
    // Manejo de errores de PostgreSQL
    const { code, message } = handlePostgresError(error);
    next(createError(code, message));
  }
};
//******************************************************************
//endpoint: http://localhost:5000/api/fintrack/account/all-accounts/?user=6e0ba475-bf23-4e1b-a125-3a8f0b3d352c
export const getAccountById = async (req, res, next) => {
  console.log(pc[backendColor]('getAccountByType'));

  try {
    const { user: userId } = req.query;
    const { accountId } = req.params;

    const { accountTypeName } = req.body; //Not necessary

    //======================================================
    const accountTypeNameResult = await pool.query({
      text: `SELECT act.account_type_name
    FROM account_types act
  JOIN user_accounts ua ON act.account_type_id = ua.account_type_id
    WHERE ua.account_id= $1`,
      values: [accountId],
    });

    //decidir si se queda esta opcion
    const account_type_name =
      !accountTypeName || accountTypeName == ''
        ? accountTypeNameResult.rows[0].account_type_name
        : accountTypeName;

    //======================================================

    if (!userId || !accountId) {
      const message = `User ID and account ID are required.Try again.`;
      console.warn(pc[backendColor](message));
      return res.status(400).json({ status: 400, message });
    }
    //type: bank = investment = income_source

    const accountTypeQuery = {
      //type:1 bank
      bank: {
        typeQuery: {
          text: `SELECT ua.*,  ct.currency_code, act.*
          FROM user_accounts ua
          JOIN currencies ct ON ua.currency_id = ct.currency_id
          JOIN account_types act ON ua.account_type_id = act.account_type_id
          WHERE ua.user_id = $1
          AND act.account_type_name = $2
       AND ua.account_id = $3 AND ua.account_name != $4
       `,
          values: [userId, account_type_name, accountId, 'slack'],
        },
      },

      //category_budget
      category_budget: {
        typeQuery: {
          text: `SELECT ua.*, 
   act.*,cba.*
   ct.currency_code, cnt.category_nature_type_name
   FROM user_accounts ua
   JOIN account_types act ON ua.account_type_id = act.account_type_id
   JOIN currencies ct ON ua.currency_id = ct.currency_id
   JOIN category_budget_accounts cba ON ua.account_id = cba.account_id
   JOIN category_nature_types cnt ON cba.category_nature_type_id = cnt.category_nature_type_id
   WHERE ua.user_id =$1
    AND act.account_type_name = $2
       AND ua.account_id = $3 AND ua.account_name != $4
       `,
          values: [userId, account_type_name, accountId, 'slack'],
        },
      },

      income_source: {
        typeQuery: {
          text: `SELECT ua.*, ct.currency_code, act.*,  
FROM user_accounts ua
JOIN account_types act ON ua.account_type_id = act.account_type_id
JOIN currencies ct ON ua.currency_id = ct.currency_id
  WHERE ua.user_id =$1
  AND act.account_type_name = $2 AND ua.account_name != $3
  AND ua.account_id = $4
      `,
          values: [userId, account_type_name, 'slack', accountId],
        },
      },
      //investment
      investment: {
        typeQuery: {
          text: `SELECT ua.*, act.*, ct.currency_code, cb.*
FROM user_accounts ua
JOIN account_types act ON ua.account_type_id = act.account_type_id
JOIN currencies ct ON ua.currency_id = ct.currency_id
  WHERE ua.user_id =$1
  AND act.account_type_name = $2 AND ua.account_name != $3
  AND ua.account_id = $4
      `,
          values: [userId, account_type_name, 'slack', accountId],
        },
      },

      //pocket_saving
      pocket_saving: {
        typeQuery: {
          text: `SELECT ua.*, act.account_type_name, ct.currency_code, ps.*, 
FROM user_accounts ua
JOIN account_types act ON ua.account_type_id = act.account_type_id
JOIN currencies ct ON ua.currency_id = ct.currency_id
JOIN pocket_saving_accounts ps ON ua.account_id = ps.account_id
  WHERE ua.user_id =$1
  AND act.account_type_name = $2 AND ua.account_name != $3
  AND ua.account_id = $4
  `,
          values: [userId, account_type_name, 'slack', accountId],
        },
      },

      //debtor
      debtor: {
        typeQuery: {
          text: `SELECT ua.*, act.account_type_name, ct.currency_code,
          da.*
FROM user_accounts ua
JOIN account_types act ON ua.account_type_id = act.account_type_id
JOIN currencies ct ON ua.currency_id = ct.currency_id
JOIN debtor_accounts da ON ua.account_id = da.account_id
  WHERE ua.user_id =$1
  AND act.account_type_name = $2 AND ua.account_name != $3
  AND ua.account_id = $4
  `,
          values: [userId, account_type_name, 'slack', accountId],
        },
      },
    };

    //check account type on ddbb
    //es necesario chequear si el usuario tiene ese tipo de cuentas?

    const accountListResult = await pool.query(
      accountTypeQuery[account_type_name].typeQuery
    );

    if (accountListResult.rows.length === 0) {
      const message = `No accounts available`;
      console.warn(pc[backendColor](message));
      return res.status(400).json({ status: 400, message });
    }

    const accountList = accountListResult.rows;
    //devolver el nombre de la cuenta, (balance actual), currency_code

    const data = { rows: accountList.length, accountList };

    const message = `Account list successfully completed `;
    console.log('success:', pc[backendColor](message));

    res.status(200).json({ status: 200, message, data });
  } catch (error) {
    if (error instanceof Error) {
      console.error(pc.red('Error while getting accounts by account ID'));

      if (process.env.NODE_ENV === 'development') {
        console.log(error.stack);
      }
    } else {
      console.error(
        pc.red('Error during transfer'),
        pc[errorColor]('Unknown error occurred')
      );
    }
    // Manejo de errores de PostgreSQL
    const { code, message } = handlePostgresError(error);
    next(createError(code, message));
  }
};
