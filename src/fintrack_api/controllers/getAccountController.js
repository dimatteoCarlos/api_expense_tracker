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

export const getAccountByType = async (req, res, next) => {
  console.log(pc[backendColor]('getAccountByType'));
  try {
    const { type, user: userId } = req.query;

    const accountType = type.trim().toLowerCase();

    if (!accountType || !userId) {
      const message = `User ID and bank type are required.Try again.`;
      console.warn(pc[backendColor](message));
      return res.status(400).json({ status: 400, message });
    }

    //check account type on ddbb
    //es necesario chequear si el usuario tiene ese tipo de cuentas?

    const accountTypeQuery = {
      text: `SELECT ua.account_id, ua.account_name, ua.account_balance,  ct.currency_code, act.account_type_id, act.account_type_name 
      FROM user_accounts ua
      JOIN account_types act ON ua.account_type_id = act.account_type_id
      JOIN currencies ct ON ua.currency_id = ct.currency_id
      WHERE ua.user_id = $1
      AND act.account_type_name = $2 AND ua.account_name != $3
      ORDER BY ua.account_balance DESC
      `,
      values: [userId, accountType, 'slack'],
    };

    const accountListResult = await pool.query(accountTypeQuery);

    if (accountListResult.rows.length === 0) {
      const message = `No accounts of type: "${accountType}" available`;
      console.warn(pc[backendColor](message));
      return res.status(400).json({ status: 400, message });
    }

    const accountList = accountListResult.rows;

    // console.log('🚀 ~ getAccountByType ~ accountList:', accountList);

    //devolver el nombre de la cuenta, (balance actual), currency_code

    const data = accountList;

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
