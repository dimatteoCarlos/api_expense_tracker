export const createTables = `
CREATE TABLE users(
user_id UUID PRIMARY KEY NOT NULL, username VARCHAR(50) UNIQUE NOT NULL, email VARCHAR(50) UNIQUE NOT NULL, user_firstname VARCHAR(25) NOT NULL,  user_lastname VARCHAR(25)  NOT NULL, user_contact VARCHAR(25), password_hashed VARCHAR(255) NOT NULL, currency_id INT DEFAULT 1 REFERENCES currencies(currency_id) ON DELETE SET NULL ON UPDATE CASCADE, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

user_role_id INT DEFAULT REFERENCES user_roles(user_ IF NOT EXISTSrole_id) ON DELETE SET NULL ON UPDATE CASCADE,
) 

ALTER TABLE users ADD COLUMN user_role_id INT REFERENCES user_roles(user_role_id) ON DELETE SET NULL ON UPDATE CASCADE

CREATE TABLE user_roles (user_role_id SERIAL PRIMARY KEY  NOT NULL, user_role_name VARCHAR(8) NOT NULL CHECK (user_role_name IN ('user', 'admin', 'superadmin') ) ), 

CREATE TABLE currencies (currency_id SERIAL PRIMARY KEY NOT NULL,
currency_code VARCHAR(3) NOT NULL ,
currency_name VARCHAR(10) NOT NULL '
)

CREATE TABLE account_types (
    account_type_id SERIAL PRIMARY KEY NOT NULL,
    account_type_name VARCHAR(50) NOT NULL
)

CREATE TABLE IF NOT EXISTS user_accounts (
account_id SERIAL PRIMARY KEY NOT NULL, 
user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE ON UPDATE CASCADE,
account_name VARCHAR(50) NOT NULL,
account_type_id INT  REFERENCES account_types(account_type_id) ON DELETE SET NULL ON UPDATE CASCADE, 
currency_id INT NOT NULL REFERENCES currencies(currency_id) ON DELETE RESTRICT ON UPDATE CASCADE, 
 account_starting_amount DECIMAL(15,2) NOT NULL,
 account_balance DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    account_start_date TIMESTAMPTZ NOT NULL CHECK (account_start_date <= NOW()) , 
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
)

CREATE TABLE movement_types (
movement_type_id SERIAL PRIMARY KEY NOT NULL, movement_type_name VARCHAR(15) NOT NULL CHECK (movement_type_name IN ('expense', 'income', 'investment', 'debt', 'pocket', 'transfer', 'receive')
))

CREATE TABLE IF NOT EXISTS movements (
    movement_id SERIAL PRIMARY KEY NOT NULL,
    movement_type_id INT NOT NULL REFERENCES movement_types(movement_type_id) ON DELETE SET NULL ON UPDATE CASCADE,
    user_id UUID NOT NULL REFERENCES "users"(user_id) ON DELETE CASCADE ON UPDATE CASCADE,
    currency_id INT  REFERENCES currencies(currency_id) ON DELETE SET NULL ON UPDATE CASCADE, 
    amount DECIMAL(15,2) NOT NULL,
    description VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
)

CREATE TABLE IF NOT EXISTS expense_movements (
    movement_id INT PRIMARY KEY NOT NULL REFERENCES movements(movement_id) ON DELETE CASCADE ON UPDATE CASCADE,
    category_id INT NOT NULL REFERENCES expense_categories(category_id) ON DELETE CASCADE ON UPDATE CASCADE,
    account_id INT NOT NULL REFERENCES user_accounts(account_id) ON DELETE CASCADE ON UPDATE CASCADE
)

CREATE TABLE IF NOT EXISTS expense_categories ( 
    category_id SERIAL PRIMARY KEY NOT NULL,
    category_name VARCHAR(50) NOT NULL,
    nature_name VARCHAR(8) NOT NULL CHECK (nature_name IN ('must', 'need', 'other', 'want')),
    budget DECIMAL(15,2) NOT NULL
)

CREATE TABLE IF NOT EXISTS income_movements (
    movement_id INT PRIMARY KEY NOT NULL REFERENCES movements(movement_id) ON DELETE CASCADE ON UPDATE CASCADE,
    source_id INT NOT NULL REFERENCES expense_categories(category_id) ,
    account_id INT NOT NULL REFERENCES user_accounts(account_id) ON DELETE CASCADE ON UPDATE CASCADE
)

CREATE TABLE IF NOT EXISTS income_sources (
    source_id SERIAL PRIMARY KEY NOT NULL,
     user_id UUID NOT NULL REFERENCES "users"(user_id) ON DELETE CASCADE ON UPDATE CASCADE,
    source_name VARCHAR(50) NOT NULL
)

CREATE TABLE IF NOT EXISTS investment_movements (
    movement_id INT PRIMARY KEY NOT NULL REFERENCES movements(movement_id) ON DELETE CASCADE ON UPDATE CASCADE,
    transaction_type VARCHAR(10) NOT NULL CHECK (transaction_type IN ('deposit', 'withdraw')),
    transaction_investment_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    account_id INT NOT NULL REFERENCES user_accounts(account_id) ON DELETE CASCADE ON UPDATE CASCADE
)

CREATE TABLE IF NOT EXISTS debt_movements (
    movement_id INT PRIMARY KEY NOT NULL REFERENCES movements(movement_id) ON DELETE CASCADE ON UPDATE CASCADE,
    debtor_id INT NOT NULL REFERENCES debt_debtors(debtor_id) ON DELETE CASCADE ON UPDATE CASCADE,
    debt_transaction_type VARCHAR(8) NOT NULL CHECK (debt_transaction_type IN ('lend', 'borrow')),
    transaction_debt_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)

CREATE TABLE IF NOT EXISTS debt_debtors (
    debtor_id SERIAL PRIMARY KEY NOT NULL,
    debtor_name VARCHAR(25) NOT NULL,
    debtor_lastname VARCHAR(25) NOT NULL
)

CREATE TABLE IF NOT EXISTS pocket_movements (
    pocket_id SERIAL PRIMARY KEY NOT NULL,
    movement_id INT NOT NULL REFERENCES movements(movement_id) ON DELETE CASCADE ON UPDATE CASCADE,
    pocket_name VARCHAR(50) NOT NULL,
    target_amount DECIMAL(15,2),
    pocket_note VARCHAR(50),
    desired_date TIMESTAMPTZ,
)

CREATE TABLE IF NOT EXISTS transactions(
transaction_id SERIAL PRIMARY KEY,
user_id UUID NOT NULL,
description TEXT,
amount DECIMAL(15,2) NOT NULL, 
movement_type_id INTEGER NOT NULL,
transaction_type_id INTEGER NOT NULL,
currency_id INTEGER NOT NULL, 
 source_account_id INT  REFERENCES user_accounts(account_id) ON DELETE SET NULL ON UPDATE CASCADE,
destination_account_id INT  , 
status VARCHAR(50) NOT NULL, 
transaction_actual_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
)

CREATE TABLE IF NOT EXISTS transaction_types(
transaction_type_id SERIAL PRIMARY KEY NOT NULL,
transation_type_name VARCHAR(50) NOT NULL CHECK(transation_type_name IN ('withdraw', 'deposit', 'lend', 'borrow'))
)
`;

export const createMainTables = [
  // {
  //   tblName: 'users',
  //   table: `CREATE TABLE IF NOT EXISTS users(user_id UUID PRIMARY KEY NOT NULL, username VARCHAR(50) UNIQUE NOT NULL, email VARCHAR(50) UNIQUE NOT NULL, user_firstname VARCHAR(25) NOT NULL,  user_lastname VARCHAR(25)  NOT NULL, user_contact VARCHAR(25), password_hashed VARCHAR(255) NOT NULL, currency_id INT REFERENCES currencies(currency_id) ON DELETE SET NULL ON UPDATE CASCADE, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,user_role_id INT  REFERENCES user_roles(user_role_id) ON DELETE SET NULL ON UPDATE CASCADE) `,
  // },

  {
    tblName: 'user_accounts',
    table: `CREATE TABLE  IF NOT EXISTS user_accounts (account_id SERIAL PRIMARY KEY NOT NULL, 
user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE ON UPDATE CASCADE,
account_name VARCHAR(50) NOT NULL,
account_type_id INT  REFERENCES account_types(account_type_id) ON DELETE SET NULL ON UPDATE CASCADE, 
currency_id INT NOT NULL REFERENCES currencies(currency_id) ON DELETE RESTRICT ON UPDATE CASCADE, 
 account_starting_amount DECIMAL(15,2) NOT NULL,
 account_balance DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    account_start_date TIMESTAMPTZ NOT NULL CHECK (account_start_date <= NOW()), 
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
)`,
  },
  //------specific type accounts
  {
    tblName: 'bank_accounts',
    table:
      'CREATE TABLE IF NOT EXISTS bank_accounts(account_id INT PRIMARY KEY REFERENCES user_accounts(account_id), initial_deposit DECIMAL (15,2))',
  },

  {
    tblName: 'investment_accounts',
    table:
      'CREATE TABLE IF NOT EXISTS investment_accounts(account_id INT PRIMARY KEY REFERENCES user_accounts(account_id), initial_deposit DECIMAL (15,2))',
  },

  {
    tblName: 'income_source_accounts',
    table:
      'CREATE TABLE IF NOT EXISTS income_source_accounts(account_id INT PRIMARY KEY REFERENCES user_accounts(account_id), initial_deposit DECIMAL (15,2))',
  },

  {
    tblName: `category_budget_accounts`,
    table: `CREATE TABLE IF NOT EXISTS category_budget_accounts(account_id INT PRIMARY KEY REFERENCES user_accounts(account_id), category_name VARCHAR(50) NOT NULL,category_nature_type_id INT REFERENCES category_nature_types(category_nature_type_id), subcategory VARCHAR(25), budget DECIMAL(15, 2))`,
  },

  {
    tblName: `debtor_accounts`,
    table: `CREATE TABLE IF NOT EXISTS debtor_accounts (
         account_id INT PRIMARY KEY REFERENCES user_accounts(account_id),
         value DECIMAL(15, 2),
         debtor_name VARCHAR(25),
         debtor_lastname VARCHAR(25),
         selected_account_name VARCHAR(50),
          selected_account_id INT
  )`,
  },

  {
    tblName: `pocket_saving_accounts`,
    table: `CREATE TABLE IF NOT EXISTS pocket_saving_accounts (account_id INT PRIMARY KEY REFERENCES user_accounts(account_id), target DECIMAL(15, 2), desired_date TIMESTAMPTZ NOT NULL)`,
  },

  // -----
  {
    tblName: 'movements',
    table: `CREATE TABLE IF NOT EXISTS movements (
    movement_id SERIAL PRIMARY KEY NOT NULL,
    movement_type_id INT NOT NULL REFERENCES movement_types(movement_type_id) ON DELETE SET NULL ON UPDATE CASCADE,
    user_id UUID NOT NULL REFERENCES "users"(user_id) ON DELETE CASCADE ON UPDATE CASCADE,
    currency_id INT  REFERENCES currencies(currency_id) ON DELETE SET NULL ON UPDATE CASCADE, 
    amount DECIMAL(15,2) NOT NULL,
    description VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
)`,
  },
  {
    tblName: 'expense_movements',
    table: `CREATE TABLE IF NOT EXISTS expense_movements (
    movement_id INT PRIMARY KEY NOT NULL REFERENCES movements(movement_id) ON DELETE CASCADE ON UPDATE CASCADE,
    category_id INT NOT NULL REFERENCES expense_categories(category_id) ON DELETE CASCADE ON UPDATE CASCADE,
    account_id INT NOT NULL REFERENCES user_accounts(account_id) ON DELETE CASCADE ON UPDATE CASCADE
)`,
  },

  {
    tblName: 'expense_categories',
    table: `CREATE TABLE IF NOT EXISTS expense_categories( 
    category_id SERIAL PRIMARY KEY NOT NULL,
    category_name VARCHAR(50) NOT NULL,
    nature_name VARCHAR(8) NOT NULL CHECK (nature_name IN ('must', 'need', 'other', 'want')),
    budget DECIMAL(15,2) NOT NULL
)`,
  },

  {
    tblName: 'income_movements',
    table: `CREATE TABLE IF NOT EXISTS income_movements (
    movement_id INT PRIMARY KEY NOT NULL REFERENCES movements(movement_id) ON DELETE CASCADE ON UPDATE CASCADE,
    source_id INT NOT NULL REFERENCES expense_categories(category_id),
    account_id INT NOT NULL REFERENCES user_accounts(account_id) ON DELETE CASCADE ON UPDATE CASCADE
)`,
  },

  //revisar si esta hace falta income_sources
  // {
  //   tblName: 'income_sources',
  //   table: `CREATE TABLE IF NOT EXISTS income_sources (
  //   source_id SERIAL PRIMARY KEY NOT NULL,
  //    user_id UUID NOT NULL REFERENCES "users"(user_id) ON DELETE CASCADE ON UPDATE CASCADE,
  //   source_name VARCHAR(50) NOT NULL)`,
  // },
  {
    tblName: 'investment_movements',
    table: `CREATE TABLE IF NOT EXISTS investment_movements (
    movement_id INT PRIMARY KEY NOT NULL REFERENCES movements(movement_id) ON DELETE CASCADE ON UPDATE CASCADE,
    transaction_type VARCHAR(10) NOT NULL CHECK (transaction_type IN ('deposit', 'withdraw')),
    transaction_investment_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    account_id INT NOT NULL REFERENCES user_accounts(account_id) ON DELETE CASCADE ON UPDATE CASCADE
)`,
  },
  {
    tblName: 'debt_movements',
    table: `CREATE TABLE IF NOT EXISTS debt_movements (
    movement_id INT PRIMARY KEY NOT NULL REFERENCES movements(movement_id) ON DELETE CASCADE ON UPDATE CASCADE,
    debtor_id INT NOT NULL REFERENCES debt_debtors(debtor_id) ON DELETE CASCADE ON UPDATE CASCADE,
    debt_transaction_type VARCHAR(8) NOT NULL CHECK (debt_transaction_type IN ('lend', 'borrow')),
    transaction_debt_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  },
  {
    tblName: 'debt_debtors',
    table: `CREATE TABLE IF NOT EXISTS debt_debtors (
    debtor_id SERIAL PRIMARY KEY NOT NULL,
    debtor_name VARCHAR(25) NOT NULL,
    debtor_lastname VARCHAR(25) NOT NULL
    )`,
  },
  {
    tblName: 'pocket_movements',
    table: `CREATE TABLE IF NOT EXISTS pocket_movements (
    pocket_id SERIAL PRIMARY KEY NOT NULL,
    movement_id INT NOT NULL REFERENCES movements(movement_id) ON DELETE CASCADE ON UPDATE CASCADE,
    pocket_name VARCHAR(50) NOT NULL,
    target_amount DECIMAL(15,2),
    pocket_note VARCHAR(50),
    desired_date TIMESTAMP
)`,
  },
  {
    tblName: 'transactions',
    table: `CREATE TABLE IF NOT EXISTS transactions(
transaction_id SERIAL PRIMARY KEY,
user_id UUID NOT NULL,
description TEXT,
amount DECIMAL(15,2) NOT NULL, 
movement_type_id INTEGER NOT NULL,
transaction_type_id INTEGER NOT NULL,
currency_id INTEGER NOT NULL, 
 source_account_id INT  REFERENCES user_accounts(account_id) ON DELETE SET NULL ON UPDATE CASCADE,
destination_account_id INT  , 
status VARCHAR(50) NOT NULL, 
transaction_actual_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
)`,
  },
];

export const createSearchIndexes = [
  {
    tblName: 'currencies',
    index: `CREATE UNIQUE INDEX index_currency_code ON currencies(currency_code)`,
  },
  {
    tblName: 'account_types',
    index: `CREATE UNIQUE INDEX index_account_type_name ON account_types(account_type_name)`,
  },
];

// source_account_id INT  REFERENCES user_accounts(account_id) ON DELETE SET NULL ON UPDATE CASCADE,
// destination_account_id INT  REFERENCES user_accounts(account_id) ON DELETE SET NULL ON UPDATE CASCADE,

//let's create main tables
// const {
//   tblName: user_accounts,
//   tblName: movements,
//   tblName: expense_movements,
//   tblName: expense_categories,
//   tblName: income_movements,
//   tblName: income_sources,
//   tblName: investment_movements,
//   tblName: debt_movements,
//   tblName: debt_debtors,
//   tblName: pocket_movements,
//   tblName: transactions,
// } = createMainTables;
