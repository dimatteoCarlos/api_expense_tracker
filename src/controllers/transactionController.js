//transactionController

import { pool } from '../db/configDB.js';
import {
  createError,
  handlePostgresError,
  handlePostgresErrorEs,
} from '../../utils/errorHandling.js';
import { validateAndNormalizeDate } from '../../utils/helpers.js';
import pc from 'picocolors';

//*********** */
//getDashboardInformation
//addTransaction
//transferMoneyToAccount

//endpoint :  http://localhost:5000/api/transaction/?user=userIdl&limit=0&offset=0
//getTransaction

export const getTransaction = async (req, res, next) => {
  console.log(pc.blueBright('getTransaction'));

  try {
    const today = new Date();
    const _sevenDaysAgo = new Date(today);
    //dateObj.getDate(number): An integer, between 1 and 31, representing the day of the month for the given date according to local time. Returns NaN if the date is invalid.
    _sevenDaysAgo.setDate(today.getDate(-7));

    //The toISOString() method of Date instances returns a string representing this date in the date time string format, a simplified format based on ISO 8601, which is always 24 or 27 characters long (YYYY-MM-DDTHH:mm:ss.sssZ or ±YYYYYY-MM-DDTHH:mm:ss.sssZ, respectively). The timezone is always UTC, as denoted by the suffix Z.
    const sevenDaysAgo = _sevenDaysAgo.toISOString().split('T')[0];

    console.log('req.query;', req.query);
    const { user: userId, df, dt, search } = req.query;

    // const {userId} = req.body.userId

    const startDate = new Date(df || sevenDaysAgo);
    const endDate = new Date(dt || today); //dt <= today
    console.log(startDate, endDate, typeof startDate);
    /*%: Es un comodín en SQL que representa cero o más caracteres. Cuando se usa con LIKE, permite buscar patrones parciales. ||: Es el operador de concatenación en PostgreSQL. Se usa para unir cadenas de texto. $4: Representa un parámetro posicional (en este caso, el cuarto parámetro de la consulta).*/

    const transactionsInfoResult = await pool.query({
      text: `SELECT * FROM transactions WHERE user_id=$1 AND created_at BETWEEN $2 AND $3 
      AND (description ILIKE '%'||$4||'%' OR status ILIKE '%'||$4||'%' OR CAST(account_id AS TEXT) ILIKE '%' || $4 || '%')`,
      values: [userId, startDate, endDate, search],
    });

    if (!userId) {
      return res
        .status(400)
        .json({ status: 400, message: 'User ID is required.' });
    }

    //   //Successfull response
    const message = `${transactionsInfoResult.rows.length} transaction(s) found`;
    console.warn(pc.blueBright(message));
    return res.status(200).json({
      message,
      data: transactionsInfoResult.rows,
    });
    // }
  } catch (error) {
    console.error(
      pc.redBright('when getting the transaction:'),
      error.message || 'something went wrong'
    );
    // Handle PostgreSQL error
    const { code, message } = handlePostgresError(error);
    // Send response to frontend
    return next(createError(code, message));
  }
};
