//get: //http://localhost:5000/api/fintrack/dashboard/balance

import {
  createError,
  handlePostgresError,
} from '../../../utils/errorHandling.js';
import pc from 'picocolors';
import { pool } from '../../db/configDB.js';

//total asset balance: total bank + total investment accounts
//total liquidity: bank
//total investment: investment
//total expense vs budget
//total debtors balance
//total payable balance
//total receivable balance
//total income
//total budget
//total target -> saving goal in pockets

//*********** */
//por cada uno de los anteriores, mostrar la lista de cuentas que componen los balances y despues mostrar cuenta detallada, con sus movimientos.

//monthly average por cada uno

//balance per period

//------
//empezar con el frontend de la aplicacion de espenses tipo sitio web, y dejar fintrack para cuando quieran reunirse para aclarar lo que hace falta definiri y se hagan los disenios que faltan. Asi, avanzo en aplicar mantine y otras tecnologias como next js con backend y type script.
//----------otro tipo de aplicaciones

// get: //http://localhost:5000/api/fintrack/dashboard/balance

export const dashboardTotalBalanceAccounts = async (req, res, next) => {
  const RESPONSE = (res, status, message, data = null) => {
    console.log(pc[backendColor](message));

    res.status(status).json({ status, message, data });
  };

  const backendColor = 'green';
  const errorColor = 'red';
  console.log(pc[backendColor]('dashboardTotalBalanceAccountByType'));

  try {
    const { user: userId } = req.query;

    if (!userId) {
      return RESPONSE(res, 400, 'User ID is required');
    }

    const successMsg = `Total balance accounts were successfully calculated`;

    const TOTAL_BALANCE_QUERY = {
      text: `SELECT act.account_type_name, SUM(ua.account_balance) as total_balance, ct.currency_code FROM user_accounts ua
JOIN account_types act ON ua.account_type_id = act.account_type_id
JOIN currencies ct ON ua.currency_id = ct.currency_id
WHERE user_id = $1 AND ua.account_name!=$2
GROUP BY act.account_type_name, ct.currency_code
ORDER BY account_type_name ASC
`,
      values: [userId, 'slack'],
    };

    const accountTotalBalanceResult = await pool.query(TOTAL_BALANCE_QUERY);
    if (accountTotalBalanceResult.rows.length === 0) {
      const message = `No available accounts or something went wrong`;
      console.warn(pc[errorColor](message));
      return RESPONSE(res, 400, message);
    }

    const accountTotalBalance = accountTotalBalanceResult.rows;
    const data = {
      rows: accountTotalBalanceResult.rows.length,
      accountTotalBalance,
    };
    console.log(data);
    return RESPONSE(res, 200, successMsg, data);
  } catch (error) {
    if (error instanceof Error) {
      console.error(pc.red('Error while getting account balances'));

      if (process.env.NODE_ENV === 'development') {
        console.log(error.stack);
      }
    } else {
      console.error(
        pc.red('Something went wrong'),
        pc[errorColor]('Unknown error occurred')
      );
    }
    // Manejo de errores de PostgreSQL
    const { code, message } = handlePostgresError(error);
    next(createError(code, message));
    // return ERROR_RESPONSE(error, next)
  }
};

//===========================================================
//get: //http://localhost:5000/api/fintrack/dashboard/balance/type
export const dashboardTotalBalanceAccountByType = async (req, res, next) => {
  const backendColor = 'cyan';
  const errorColor = 'red';
  const RESPONSE = (res, status, message, data = null) => {
    console.log(pc[backendColor](message));
    res.status(status).json({ status, message, data });
  };

  console.log(pc[backendColor]('dashboardTotalBalanceAccountByType'));

  try {
    const { type, user: userId } = req.query;

    const accountType = type.trim().toLowerCase();

    if (!accountType || !userId) {
      return RESPONSE(res, 400, 'User ID and account TYPE are required');
    }

    const successMsg = `Total balance account of account type ${accountType} successfully calculated`;

    const TOTAL_BALANCE_QUERY = {
      text: `SELECT SUM(ua.account_balance) as total_balance FROM user_accounts ua
JOIN account_types act ON ua.account_type_id = act.account_type_id
WHERE user_id = $1 AND act.account_type_name = $2 AND ua.account_name!=$3
`,
      values: [userId, accountType, 'slack'],
    };

    const TOTAL_BALANCE_AND_GOAL_BY_TYPE = {
      category_budget: {
        text: `SELECT SUM(ua.account_balance) as total_balance,  SUM(st.budget) AS total_budget FROM user_accounts ua
JOIN account_types act ON ua.account_type_id = act.account_type_id
JOIN category_budget_accounts st ON ua.account_id = st.account_id
WHERE user_id = $1 AND act.account_type_name = $2 AND ua.account_name!=$3
`,
        values: [userId, accountType, 'slack'],
      },

      pocket_saving: {
        text: `SELECT SUM(ua.account_balance) as total_balance, SUM(st.target) as total_target FROM user_accounts ua
JOIN account_types act ON ua.account_type_id = act.account_type_id
JOIN pocket_saving_accounts st ON ua.account_id = st.account_id
WHERE user_id = $1 AND act.account_type_name = $2 AND ua.account_name!=$3
`,
        values: [userId, accountType, 'slack'],
      },
      debtor: {
        text: `SELECT SUM(ua.account_balance) as total_debt_balance, SUM(CASE WHEN ua.account_balance > 0 THEN ua.account_balance ELSE 0 END) AS debt_receivable,  SUM(CASE WHEN ua.account_balance < 0 THEN ua.account_balance ELSE 0 END) as debt_payable,

        COUNT(CASE WHEN ua.account_balance>0 THEN 1 ELSE NULL END) AS debtors, 
        COUNT(*) FILTER (WHERE ua.account_balance<0) AS creditors, 
        COUNT(*) FILTER (WHERE ua.account_balance=0) AS debtors_without_Debt
        
        FROM user_accounts ua
JOIN account_types act ON ua.account_type_id = act.account_type_id
JOIN debtor_accounts st ON ua.account_id = st.account_id
WHERE user_id = $1 AND act.account_type_name = $2 AND ua.account_name!=$3
`,
        values: [userId, accountType, 'slack'],
      },
    };
    //------queries
    //WRITE VALIDATION OF ACCOUNTTYPE HERE
    if (
      accountType == 'bank' ||
      accountType == 'investment' ||
      accountType === 'income_source'
    ) {
      const query = TOTAL_BALANCE_QUERY;
      console.log('🚀 ~ dashboardTotalBalanceAccount ~ query:', query);

      if (!query) {
        const message = `Invalid account type "${accountType}" check endpoint queries.`;
        console.warn(pc.red(message));
        return RESPONSE(res, 400, message);
      }

      const accountTotalBalanceResult = await pool.query(query);

      if (accountTotalBalanceResult.rows.length === 0) {
        const message = `No available accounts of type ${accountType}`;
        return RESPONSE(res, 400, message);
      }

      const data = accountTotalBalanceResult.rows[0];
      console.log(data);

      return RESPONSE(res, 200, successMsg, data);
    }
    //-------
    //INCOME SOURCE ACCOUNTS JUST NEGATIVe VALUES
    if (accountType === 'income_source') {
      //check negative values
      const query = TOTAL_BALANCE_QUERY;
      if (!query) {
        const message = `Invalid account type "${accountType}" check endpoint queries.`;
        console.warn(pc.red(message));
        return RESPONSE(res, 400, message);
      }

      const accountTotalBalanceResult = await pool.query(query);

      if (accountTotalBalanceResult.rows.length === 0) {
        const message = `No available account(s) of type ${accountType}`;
        return ERROR_RESPONSE(res, 400, message);
      }

      const data = accountTotalBalanceResult.rows[0];
      console.log(data);
      return RESPONSE(res, 200, successMsg, data);
    }

    //---total balance and goals or limit

    if (
      accountType == 'category_budget' ||
      accountType == 'debtor' ||
      accountType == 'pocket_saving'
    ) {
      const query = TOTAL_BALANCE_AND_GOAL_BY_TYPE[accountType];
      if (!query) {
        const message = `Invalid account type "${accountType}" check endpoint queries.`;
        console.warn(pc.red(message));
        return ERROR_RESPONSE(res, 400, message);
      }

      const accountTotalBalanceResult = await pool.query(query);

      if (accountTotalBalanceResult.rows.length === 0) {
        const message = `No available accounts of type ${accountType}`;
        return ERROR_RESPONSE(res, 400, message);
      }

      const data = accountTotalBalanceResult.rows;
      console.log(data);

      return RESPONSE(res, 200, successMsg, data);
    }
    //in case accountType does not exist
    const message = `No available accounts of type ${accountType}`;
    return RESPONSE(res, 400, message);
  } catch (error) {
    if (error instanceof Error) {
      console.error(pc.red('Error while getting account balances'));
      if (process.env.NODE_ENV === 'development') {
        console.log(error.stack);
      }
    } else {
      console.error(
        pc.red('Something went wrong'),
        pc[errorColor]('Unknown error occurred')
      );
    }
    // Manejo de errores de PostgreSQL
    const { code, message } = handlePostgresError(error);
    next(createError(code, message));
    // return ERROR_RESPONSE(error, next)
  }
};
