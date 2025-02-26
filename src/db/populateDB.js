import { pool } from './configDB.js';

function isValidTableName(tableName) {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName); // Solo permite nombres de tablas válidos
}

async function tableExists(tableName) {
  if (!isValidTableName(tableName)) {
    throw new Error('Invalid table name');
  }

  // WHERE table_name = 'currencies'
  const queryText = `
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_name = '${tableName}'
    );
  `;
  const result = await pool.query(queryText);
  // console.log(tableName, ' existe? ', result.rows[0].exists);
  return result.rows[0].exists; // Devuelve true o false
}

async function isTablePopulated(tableName, minCount = 1) {
  if (!isValidTableName(tableName)) {
    throw new Error('Invalid table name');
  }
  const queryText = `SELECT COUNT(*) FROM ${tableName}`;
  const result = await pool.query(queryText);
  return result.rows[0].count > minCount;
}

//--
//currencies
export async function tblCurrencies() {
  const currenciesValues = [
    {
      currency_id: 1,
      currency_code: 'usd',
      currency_name: 'us-dollars',
    },
    { currency_id: 2, currency_code: 'eur', currency_name: 'euros' },
    { currency_id: 3, currency_code: 'cop', currency_name: 'pesos col' },
  ];

  try {
    //verify if table exists
    const exists = await tableExists('currencies');
    if (!exists) {
      // console.log('"currencies" table does not exist. Creating it...');
      const createQuery = `CREATE TABLE currencies (
  currency_id INT PRIMARY KEY NOT NULL,
  currency_code VARCHAR(3) NOT NULL ,
  currency_name VARCHAR(10) NOT NULL 
)`;
      await pool.query(createQuery);
    }

    //is it already populated
    const isPopulated = await isTablePopulated('currencies', 2);
    if (isPopulated) {
      // console.log('currencies table is already populated.');
      return;
    }

    console.log(currenciesValues);
    //initiate a transaction
    await pool.query('BEGIN');
    //run through the data and insert every tuple

    for (const currency of currenciesValues) {
      const queryText = `INSERT INTO currencies(currency_id,currency_code, currency_name) VALUES ($1,$2,$3)`;
      const values = [
        currency.currency_id,
        currency.currency_code,
        currency.currency_name,
      ];
      await pool.query(queryText, values);
      // console.log('inerted: currency', currency.currency_code);
    }

    //confirm transaction
    await pool.query('COMMIT');
    // console.log('All tuples inserted successfully.');
  } catch (
    error // Revertir la transacción en caso de error
  ) {
    await pool.query('ROLLBACK');
    console.error('Error inserting tuples:', error);
    throw error;
  }
}

// tblCurrencies();
//--
//user roles
export async function tblUserRoles() {
  const rolesValues = [
    { user_role_id: 1, user_role_name: 'user' },
    { user_role_id: 2, user_role_name: 'admin' },
    { user_role_id: 3, user_role_name: 'superadmin' },
  ];
  const tblName = 'user_roles';
  const minCount = 2;

  try {
    //verify if table exists
    if (!isValidTableName(tblName)) {
      throw new Error('Invalid table name');
    }

    const exists = await tableExists(tblName);
    if (!exists) {
      // console.log(`\" ${tblName}\" table does not exist. Creating it...`);
      const createQuery = `CREATE TABLE user_roles(user_role_id SERIAL PRIMARY KEY  NOT NULL, user_role_name VARCHAR(15) NOT NULL CHECK (user_role_name IN ('user', 'admin', 'superadmin') ) )`;
      await pool.query(createQuery);
    }

    //is it already populated
    const isPopulated = await isTablePopulated(tblName, minCount);
    if (isPopulated) {
      // console.log(`${tblName} table is already populated.`);
      return;
    }

    //initiate a transaction
    await pool.query('BEGIN');

    //run through the data and insert every tuple
    for (const role of rolesValues) {
      const queryText = `INSERT INTO user_roles(user_role_id, user_role_name) VALUES ($1,$2)`;
      const values = [role.user_role_id, role.user_role_name];
      await pool.query(queryText, values);
      // console.log('inserted: user_role', role.user_role_name);
    }

    //confirm transaction
    await pool.query('COMMIT');
    console.log('All tuples inserted successfully.');
  } catch (
    error // Revertir la transacción en caso de error
  ) {
    await pool.query('ROLLBACK');
    console.error('Error inserting tuples:', tblName, error);
  }
}

// tblUserRoles()

//--
//accountTypes
export async function tblAccountTypes() {
  const accountTypeValues = [
    { account_type_id: 1, account_type_name: 'bank' },
    { account_type_id: 2, account_type_name: 'investment' },
    { account_type_id: 3, account_type_name: 'investment_crypto' },
    { account_type_id: 4, account_type_name: 'investment_broker' },
    { account_type_id: 5, account_type_name: 'debtor' },
    { account_type_id: 6, account_type_name: 'pocket' },
    { account_type_id: 7, account_type_name: 'budget' }, //expense category
    { account_type_id: 8, account_type_name: 'cash' },
  ];
  const tblName = 'account_types';
  const minCount = 3;

  try {
    //verify if table exists
    if (!isValidTableName(tblName)) {
      throw new Error('Invalid table name');
    }
    const exists = await tableExists(tblName);

    if (!exists) {
      console.log(`${tblName} table does not exist. Creating it...'`);
      const createQuery = `CREATE TABLE account_types (
        account_type_id INT PRIMARY KEY NOT NULL,
        account_type_name VARCHAR(50) NOT NULL 
)`;
      await pool.query(createQuery);
    }

    //is it already populated
    const isPopulated = await isTablePopulated(tblName, minCount);
    if (isPopulated) {
      // console.log(`${tblName} table is already populated.`);
      return;
    }

    //initiate a transaction
    await pool.query('BEGIN');
    //run through the data and insert every tuple
    for (const type of accountTypeValues) {
      const queryText = `INSERT INTO account_types(account_type_id,
      account_type_name) VALUES ($1,$2)`;
      const values = [type.account_type_id, type.account_type_name];
      await pool.query(queryText, values);
      console.log(`inserted: ${tblName}, ${type.account_type_name}`);
    }

    //confirm transaction
    await pool.query('COMMIT');
    console.log('All tuples inserted successfully.');
  } catch (
    error // Revertir la transacción en caso de error
  ) {
    await pool.query('ROLLBACK');
    console.error('Error inserting tuples:', error);
  }
}
//tblAccountTypes();
