export const createTables = `
CREATE TABLE users(
user_id UUID PRIMARY KEY NOT NULL, username VARCHAR(50) UNIQUE NOT NULL, email VARCHAR(50) UNIQUE NOT NULL, user_firstname VARCHAR(25) NOT NULL,  user_lastname VARCHAR(25)  NOT NULL, user_contact VARCHAR(25), password_hashed VARCHAR(255) NOT NULL, currency_id INT DEFAULT 1 REFERENCES currencies(currency_id) ON DELETE SET NULL ON UPDATE CASCADE, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

user_role_id INT DEFAULT REFERENCES user_roles(user_role_id) ON DELETE SET NULL ON UPDATE CASCADE,
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

CREATE TABLE user_accounts (
account_id SERIAL PRIMARY KEY NOT NULL, 
user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE ON UPDATE CASCADE,
account_name VARCHAR(50) NOT NULL,
account_type_id INT  REFERENCES account_types(account_type_id) ON DELETE SET NULL ON UPDATE CASCADE, 
currency_id INT NOT NULL REFERENCES currencies(currency_id) ON DELETE RESTRICT ON UPDATE CASCADE, 
 account_starting_amount DECIMAL(15,2) NOT NULL,
 account_balance DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    account_start_date TIMESTAMPTZ NOT NULL CHECK (account_start_date <= NOW()) , 
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMPT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMPT
)

CREATE TABLE movement_types (
movement_type_id SERIAL PRIMARY KEY NOT NULL, movement_type_name VARCHAR(50) NOT NULL CHECK (movement_type_name IN ('expense', 'income', 'investment', 'debt', 'pocket')
))

CREATE TABLE movements (
    movement_id SERIAL PRIMARY KEY NOT NULL,
    movement_type_id INT NOT NULL REFERENCES movement_types(movement_type_id) ON DELETE CASCADE ON UPDATE CASCADE,
    user_id UUID NOT NULL REFERENCES "users"(user_id) ON DELETE CASCADE ON UPDATE CASCADE,
    currency_id INT  REFERENCES currencies(currency_id) ON DELETE SET NULL ON UPDATE CASCADE, 
    amount DECIMAL(15,2) NOT NULL,
    description VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
)

CREATE TABLE expense_movements (
    movement_id INT PRIMARY KEY NOT NULL REFERENCES movements(movement_id) ON DELETE CASCADE ON UPDATE CASCADE,
    category_id INT NOT NULL REFERENCES expense_category(category_id) ON DELETE CASCADE ON UPDATE CASCADE,
    account_id INT NOT NULL REFERENCES user_accounts(account_id) ON DELETE CASCADE ON UPDATE CASCADE
)

CREATE TABLE expense_categories ( 
    category_id SERIAL PRIMARY KEY NOT NULL,
    category_name VARCHAR(50) NOT NULL,
    nature_name VARCHAR(8) NOT NULL CHECK (nature_name IN ('must', 'need', 'other', 'want')),
    budget DECIMAL(15,2) NOT NULL
)

CREATE TABLE income_movements (
    movement_id INT PRIMARY KEY NOT NULL REFERENCES movements(movement_id) ON DELETE CASCADE ON UPDATE CASCADE,
    source_id INT NOT NULL REFERENCES expense_categories(category_id) ,
    account_id INT NOT NULL REFERENCES user_accounts(account_id) ON DELETE CASCADE ON UPDATE CASCADE
)

CREATE TABLE income_sources (
    source_id SERIAL PRIMARY KEY NOT NULL,
    source_name VARCHAR(50) NOT NULL
)

CREATE TABLE investment_movements (
    movement_id INT PRIMARY KEY NOT NULL REFERENCES movements(movement_id) ON DELETE CASCADE ON UPDATE CASCADE,
    transaction_type VARCHAR(10) NOT NULL CHECK (transaction_type IN ('deposit', 'withdraw')),
    transaction_investment_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    account_id INT NOT NULL REFERENCES user_accounts(account_id) ON DELETE CASCADE ON UPDATE CASCADE
)

CREATE TABLE debt_movements (
    movement_id INT PRIMARY KEY NOT NULL REFERENCES movements(movement_id) ON DELETE CASCADE ON UPDATE CASCADE,
    debtor_id INT NOT NULL REFERENCES debt_debtor(debtor_id) ON DELETE CASCADE ON UPDATE CASCADE,
    debt_transaction_type VARCHAR(8) NOT NULL CHECK (debt_transaction_type IN ('lend', 'borrow')),
    transaction_debt_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
)

CREATE TABLE debt_debtor (
    debtor_id SERIAL PRIMARY KEY NOT NULL,
    debtor_name VARCHAR(25) NOT NULL,
    debtor_lastname VARCHAR(25) NOT NULL
)

CREATE TABLE pocket_movements (
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
transaction_type_id INTEGER NOT NULL
currency_id INTEGER NOT NULL, 
origin_account_id INT  REFERENCES user_accounts(account_id) ON DELETE SET NULL ON UPDATE CASCADE, 
destine_account_id INT  REFERENCES user_accounts(account_id) ON DELETE SET NULL ON UPDATE CASCADE, 
status VARCHAR(50) NOT NULL, 
created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
)
`;


