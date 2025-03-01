//transactionController

import { pool } from '../db/configDB.js';
import {
  createError,
  handlePostgresError,
  handlePostgresErrorEs,
} from '../../utils/errorHandling.js';
import { getMonthName, validateAndNormalizeDate } from '../../utils/helpers.js';
import pc from 'picocolors';

//*********** */
//getDashboardInformation
//addTransaction
//transferMoneyToAccount

//endpoint :  http://localhost:5000/api/transaction/?user=userIdl&startD=sd&endD=ed&search=s&limit=0&offset=0
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
    const { user: userId, startD, endD, search } = req.query;

    // const {userId} = req.body.userId

    const startDate = new Date(startD || sevenDaysAgo);
    const endDate = new Date(endD || today); //dt <= today
    console.log(startDate, endDate, typeof startDate);
    /*%: Es un comodín en SQL que representa cero o más caracteres. Cuando se usa con LIKE, permite buscar patrones parciales. ||: Es el operador de concatenación en PostgreSQL. Se usa para unir cadenas de texto. $4: Representa un parámetro posicional (en este caso, el cuarto parámetro de la consulta).*/

    const transactionsInfoResult = await pool.query({
      text: `SELECT * FROM transactions WHERE user_id=$1 AND created_at BETWEEN $2 AND $3 
      AND (description ILIKE '%'||$4||'%' OR status ILIKE '%'||$4||'%' OR CAST(account_id AS TEXT) ILIKE '%'||$4||'%')`,
      values: [userId, startDate, endDate, search],
    });

    if (!userId) {
      return res
        .status(400)
        .json({ status: 400, message: 'User ID is required.' });
    }

    //Successfull response
    const message = `${transactionsInfoResult.rows.length} transaction(s) found`;
    console.warn(pc.blueBright(message));
    return res.status(200).json({
      message,
      data: transactionsInfoResult.rows,
    });
    // }
  } catch (error) {
    console.error(
      pc.redBright('when getting transactions:'),
      error.message || 'something went wrong'
    );
    // Handle PostgreSQL error
    const { code, message } = handlePostgresError(error);
    // Send response to frontend
    return next(createError(code, message));
  }
};

//http://localhost:5000/api/transaction/account/:id?user=430e5635-d1e6-4f53-a104-5575c6e60c81&account=1
//addTransaction
export const addTransaction = async (req, res, next) => {
  console.log('addTransaction');
  const client = await pool.connect(); // Get a client from the pool
  try {
    const { user: userId } = req.query;
    const { account: accountId } = req.params;
    const { desc, amount, source } = req.body;
    //arreglar la tabla de transactions para incluir el source. Arreglar los queries de get transaction y todos los demas para incorporar source

    if (!userId) {
      return res
        .status(400)
        .json({ status: 400, message: 'User ID is required.' });
    }
    //que pasa si el user es undefined o si no existe en las tablas de user? creo que para llegar aqui, dberia pasarse por verifyUser

    // console.log(
    //   '🚀 ~ createAccount ~ accountStartDateNormalized:',
    //   accountStartDateNormalized
    // );

    if (!accountId || !desc || !amount || !source) {
      const message = 'All fields are required';
      console.warn(pc.greenBright(message));
      return res.status(400).json({ status: 400, message });
    }

    if (parseFloat(amount) <= 0) {
      const message = 'Amount should be greater then 0';
      console.warn(pc.redBright(message));
      return res.status(400).json({ status: 400, message });
    }

    const accountResult = await pool.query({
      text: `SELECT  * FROM user_accounts WHERE account_id = $1`,
      values: [accountId],
    });

    const accountInfo = accountResult.rows[0];

    if (!accountInfo) {
      const message = 'Invalid account information';
      console.warn(pc.redBright(message));
      return res.status(400).json({ status: 400, message });
    }

    if (
      accountInfo.account_balance <= 0 ||
      accountInfo.account_balance < parseFloat(amount)
    ) {
      const message = 'Transaction fialed. Insufficient account balance';
      console.warn(pc.redBright(message));
      return res.status(403).json({ status: 403, message });
    }

    await client.query('BEGIN');
    await pool.query({
      text: `UPDATE user_accounts SET account_balance=(account_balance - $1), updated_at = CURRENT_TIMESTAMP WHERE account_id= $2`,
      values: [amount, accountId],
    });

    await pool.query({
      text: `INSERT INTO transactions(user_id, description, type, status, amount, account_id) VALUES($1,$2,$3,$4,$5,$6) `,
      values: [userId, desc, 'expense', 'completed', amount, accountId],
    });
    //temporary account_id for source

    await pool.query({
      text: `UPDATE user_accounts SET account_balance=(account_balance + $1), updated_at = CURRENT_TIMESTAMP WHERE account_id= $2`,
      values: [amount, accountId],
    });

    await client.query('COMMIT');

    const message = 'Transaction completed successfully.';
    console.log(pc.greenBright(message));
    res.status(200).json({ status: 200, message });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(
      pc.redBright('Error occured on getting Dashboard Information'),
      pc.greenBright(error.message || 'something went wrong')
    );
    const { code, message } = handlePostgresError(error);
    return next(createError(code, message));
  }
};

//transferMoneyToAccount
export const transferMoneyToAccount = async (req, res, next) => {
  console.log(pc.yellowBright('transferMoneyToAccount'));
  try {
    const { user: userId } = req.query;
    const { from_account, to_account, amount } = req.body;

    if (!from_account || !to_account || !amount) {
      const message = 'All fields are required';
      console.warn(pc.yellowBright(message));
      return res.status(400).json({ status: 400, message });
    }

    const numericAmount = parseFloat(amount);

    if (numericAmount <= 0) {
      const message = 'Amount should be greater then 0';
      console.warn(pc.redBright(message));
      return res.status(400).json({ status: 400, message });
    }

    //check abbount details and balance for the 'from account'
    const fromAccountResult = await pool.query({
      text: `SELECT * FROM user_accounts WHERE account_id = $1`,
      values: [from_account],
    });

    const fromAccountInfo = fromAccountResult.rows[0];

    if (!fromAccountInfo) {
      const message = 'Account Information not found';
      console.warn(pc.redBright(message));
      return res.status(404).json({ status: 404, message });
    }

    if (numericAmount > fromAccountInfo.account_balance) {
      const message = 'Transfer failed. Insufficient funds';
      console.warn(pc.redBright(message));
      return res.status(404).json({ status: 404, message });
    }

    //Begin transaction
    await pool.query('BEGIN');
    //Transfer from account
    await pool.query({
      text: `UPDATE user_accounts SET account_balance=(account_balance - $1), updated_at = CURRENT_TIMESTAMP WHERE account_id= $2`,
      values: [numericAmount, from_account],
    });

    //Yo  confirmaria aqui si la cuenta to_account existe?
    //Transfer to account
    const toAccountInfo = await pool.query({
      text: `UPDATE user_accounts SET account_balance=(account_balance + $1), updated_at = CURRENT_TIMESTAMP WHERE account_id= $2 RETURNING *`,
      values: [numericAmount, to_account],
    });
    //Insert transaction records
    const descriptionTransfered = `Transfered (${fromAccountInfo.account_name}-${toAccountInfo.rows[0].account_name})`;

    await pool.query({
      text: `INSERT INTO transactions(user_id, description, type, status, amount, account_id) VALUES($1,$2,$3,$4,$5,$6) `,
      values: [
        userId,
        descriptionTransfered,
        'expense',
        'completed',
        numericAmount,
        from_account,
      ],
    });
    //temporary account_id for source

    const descriptionReceived = `Received (${fromAccountInfo.account_name}-${toAccountInfo.rows[0].account_name})`;
    await pool.query({
      text: `INSERT INTO transactions(user_id, description, type, status, amount, account_id) VALUES($1,$2,$3,$4,$5,$6) `,
      values: [
        userId,
        descriptionReceived,
        'income',
        'completed',
        numericAmount,
        to_account,
      ],
    });
    //temporary account_id for source

    await client.query('COMMIT');

    const message = 'Transaction completed successfully.';
    console.log(pc.yellowBright(message));
    res.status(200).json({ status: 200, message });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(
      pc.redBright('Error occured on getting Dashboard Information'),
      pc.greenBright(error.message || 'something went wrong')
    );
    const { code, message } = handlePostgresError(error);
    return next(createError(code, message));
  }
};

//http://localhost:5000/api/transaction/
//getDashboardInformation
export const getDashboardInformation = async (req, res, next) => {
  console.log(pc.yellowBright('getDashboardInformation'));

  try {
    const { user: userId } = req.query;
    let totalIncome = 0,
      totalExpense = 0,
      totalBalance = 0;

    //   // get the total amount of type transaction, from transactions table by a specific user_id,  grouped by movement_type_id
    const totalAmountTransactionTypeResult = await pool.query({
      text: `SELECT tr.movement_type_id, mt.movement_type_name, CAST(SUM(tr.amount) AS DECIMAL) AS total_amount FROM transactions tr
   JOIN movement_types mt ON tr.movement_type_id = mt.movement_type_id WHERE user_id = $1 GROUP BY tr.movement_type_id, mt.movement_type_name
  `,
      values: [userId],
    });

    // console.log("🚀 ~ getDashboardInformation ~ totalAmountTransactionTypeResult:", totalAmountTransactionTypeResult)
    const totalAmountTransactionType = totalAmountTransactionTypeResult.rows;
    // console.log(
    //   '🚀 ~ getDashboardInformation ~ totalAmountTransactionType:',
    //   totalAmountTransactionType
    // );

    const totalIncomeInfo = totalAmountTransactionType.filter(
      (type) => type.movement_type_name === 'income'
    );
    console.log(
      '🚀 ~ getDashboardInformation ~ totalIncome:',
      totalIncomeInfo[0].total_amount
    );
    const totalExpenseInfo = totalAmountTransactionType.filter(
      (type) => type.movement_type_id === 1
    ); //expense
    console.log(
      '🚀 ~ getDashboardInformation ~ totalExpense:',
      totalExpenseInfo[0].total_amount
    );

    //   // totalInvestment = totalAmountTransactionType.rows.filter((type)=>(type.name_type=== 'investment')) //expense
    //   // totalDebt = totalAmountTransactionType.rows.filter((type)=>(type.name_type=== 'debt')) //debt
    //   // totalPocket = totalAmountTransactionType.rows.filter((type)=>(type.name_type=== 'debt')) //pocket

    //   //movement debts transaction_type: borrow /
    //   // debtor_lend / debtor_borrow /investment_withdraw/investment_deposit/pocket_deposit/pocket_withraw, o sea que la tranasaction tambien tiene que tener el tipo de cuenta?

    const availableBalance = totalIncome - totalExpense;
    // console.log(
    //   '🚀 ~ getDashboardInformation ~ availableBalance:',
    //   totalIncome,
    //   availableBalance
    // );

    //   //Aggregate transactions to sum by transaction movement_type and group by month
    //these are CONSTANTS
    const year = new Date().getFullYear();
    const start_date = new Date(year, 0, 1); //January 1st of the year
    const end_date = new Date(year, 11, 31, 23, 59, 59); //December 31st of the year

    const groupByMonthQuery = {
      text: `SELECT EXTRACT(MONTH FROM tr.created_at) AS month_index, CAST(SUM(tr.amount) AS DECIMAL) AS total_amount, tr.movement_type_id, mt.movement_type_name FROM transactions tr  JOIN movement_types AS mt ON tr.movement_type_id = mt.movement_type_id  WHERE tr.user_id = $1 AND created_at BETWEEN $2 and $3 GROUP BY month_index, tr.movement_type_id, mt.movement_type_name`,
      values: [userId, start_date, end_date],
    };

    const amountTypeByMonthResult = await pool.query(groupByMonthQuery);

    const amountTypeByMonth = amountTypeByMonthResult.rows;

    // console.log(
    //   '🚀 ~ getDashboardInformation ~ amountTypeByMonthResult:',
    //   amountTypeByMonthResult.rows
    // );

    // group data by month

    const data = Array.from({ length: 12 }, (_, indx) => {
      const month_index = indx + 1;
      // console.log('🚀 ~ data ~ month_index:', month_index);
      const dataByMonth = amountTypeByMonth.filter(
        (item) => parseInt(item.month_index) == month_index
      );
      const totalIncomeMonth =
        dataByMonth.find((item) => item.movement_type_name == 'income')
          ?.total_amount || 0;
      const totalExpenseMonth =
        dataByMonth.find((item) => item.movement_type_name == 'expense')
          ?.total_amount || 0;

      const totalDebtMonth =
        dataByMonth.find((item) => item.movement_type_name == 'debt')
          ?.total_amount || 0;
      const totalInvestmentMonth =
        dataByMonth.find((item) => item.movement_type_name == 'investment')
          ?.total_amount || 0;
      // console.log({
      //   label: getMonthName(Number(month_index)),
      //   totalIncomeMonth,
      //   totalExpenseMonth,
      // });

      return {
        label: getMonthName(month_index),
        totalIncomeMonth,
        totalExpenseMonth,
      };
    });

    // console.log("🚀 ~ getDashboardInformation ~ data:", data)
    //   getMonthName(9);

    const message = 'Dashboard completed successfully.';
    console.log(pc.yellowBright(message));
    res.status(200).json({ status: 200, message });
  } catch (error) {
    console.error(
      pc.redBright('Error occured on getting Dashboard Information'),
      pc.greenBright(error.message || 'something went wrong')
    );
    const { code, message } = handlePostgresError(error);
    return next(createError(code, message));
  }
};
