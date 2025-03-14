//recordTransaction.js

import pc from 'picocolors';
import { pool } from '../src/db/configDB.js';
import { handlePostgresError } from './errorHandling.js';

export async function recordTransaction(options) {
  try {
    const {
      userId,
      description,
      movement_type_id,
      status,
      amount,
      currency_id,
      source_account_id,
      transaction_type_id,
      destination_account_id,
      transaction_actual_date,
    } = options;
    console.log('🚀 ~ recordTransaction ~ options:', options);

    //start the transaction
    // await client.pool.query('BEGIN');

    const transactionResult = await pool.query({
      text: `INSERT INTO transactions(user_id, description, movement_type_id, status, amount,currency_id, source_account_id,transaction_type_id,destination_account_id, transaction_actual_date) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      values: [
        userId,
        description,
        movement_type_id,
        status,
        amount,
        currency_id,
        source_account_id,
        transaction_type_id,
        destination_account_id,
        transaction_actual_date,
      ],
    });
    // console.log(transactionResult.rows[0]);
    // await client.query('COMMIT');
    const message = 'Transaction successfully completed.';
    console.log(pc.yellowBright(message));

    return transactionResult.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    const message = error.message || `Error when recording transaction.`;
    console.error(pc.redBright(message), 'from record transaction');
    throw handlePostgresError(error);
  }
}
