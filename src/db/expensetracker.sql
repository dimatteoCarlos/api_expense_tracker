-- "Get all users' info, except for passwords and account IDs."
SELECT username, email, user_firstname,user_role_name,  currency_code FROM users 
JOIN currencies ON users.currency_id = currencies.currency_id
JOIN user_roles ON users.user_role_id = user_roles.user_role_id
ORDER BY username ASC

-- Get user by id
SELECT u.user_id, u.username,
u.email, 
u.user_firstname, 
u.user_lastname, 
u.user_contact, 
currencies.currency_name as user_currency, user_accounts.account_id , user_roles.user_role_name as user_role  FROM users u
JOIN user_accounts ON user_accounts.user_id = u.user_id
JOIN currencies ON currencies.currency_id = u.currency_id
JOIN user_roles ON user_roles.user_role_id = u.user_role_id
WHERE u.user_id = $1
ORDER BY account_id ASC

-- Check user existence by id
 SELECT 1
    FROM users u
    JOIN user_accounts ON user_accounts.user_id = u.user_id
    JOIN currencies ON currencies.currency_id = u.currency_id
    JOIN user_roles ON user_roles.user_role_id = u.user_role_id
    WHERE u.user_id = $1
    LIMIT 1.rows[0]

-- Get all user id accounts by user id 
SELECT  account_id, account_name
    account_type_id
    currency_id
    account_starting_amount
    account_balance
    account_start_date
    created_at
    updated_at
     FROM user_accounts 
    WHERE user_id = $1
    ORDER BY account_id ASC

-- Get all user account info by user id and account name,
SELECT * FROM users_accounts WHERE user_id = $1 AND account_name ILIKE $2 ORDER BY account_name;

-- {text:`SELECT * FROM users_accounts WHERE user_id = $1 AND account_name ILIKE $2  ORDER BY account_name`, values: [userId, `%${account_name}%`]}

-- get all user sources income by user id


-- get all user accounts  by user_id and account type id
SELECT * FROM user_accounts WHERE user_id ='430e5635-d1e6-4f53-a104-5575c6e60c81'
AND account_type_id = 2

-- get currency_id from currencies by currency_code
SELECT currency_id  FROM currencies WHERE currency_code= $1

-- get transactions by user_id and between start and today/end dates and search on description, status or account_id
SELECT * FROM transactions WHERE user_id=$1 AND created_at BETWEEN $2 AND $3 
      AND (description ILIKE '%'||$4||'%' OR status ILIKE '%'||$4||'%' OR CAST(account_id AS TEXT) ILIKE '%'||$4||'%')

--get the total amount of type tr, from transactions by a specific user_id,  grouped by movement_type_id
SELECT  tr.movement_type_id as id_type, mt.movement_type_name as name_type, SUM(tr.amount) AS totalAmount
FROM transactions tr
JOIN movement_types AS mt ON tr.movement_type_id = mt.movement_type_id
WHERE tr.user_id='430e5635-d1e6-4f53-a104-5575c6e60c81'
GROUP BY tr.movement_type_id, mt.movement_type_name

--get the total amount of type tr, from transactions by a specific user_id between specific dates  grouped by month and movement_type_id
SELECT EXTRACT(MONTH FROM created_at) AS month, 
tr.movement_type_id, mt.movement_type_name, 
SUM(amount) AS totalAmount
FROM transactions tr
JOIN movement_types mt ON tr.movement_type_id = mt.movement_type_id
WHERE user_id = '430e5635-d1e6-4f53-a104-5575c6e60c81'
AND created_at BETWEEN '2024-01-01' AND '2025-12-31'
GROUP BY
EXTRACT(MONTH FROM created_at), tr.movement_type_id, mt.movement_type_name


-- change the check restriction on movement_types table
ALTER TABLE movement_types
DROP CONSTRAINT movement_types_movement_type_name_check

ALTER TABLE movement_types
ADD CONSTRAINT movment_types_movement_type_name_check
CHECK (movement_type_name IN ('expense', 'income', 'investment', 'debt', 'pocket', 'transfer', 'receive'));

--get the account info from user_id, account_type_name and account_name
SELECT ua.* FROM user_accounts ua
JOIN account_types act ON ua.account_type_id = act.account_type_id
WHERE ua.user_id = '6e0ba475-bf23-4e1b-a125-3a8f0b3d352c' AND ua.account_name = $2
AND act.account_type_name = 'bank'

--usage in: movement expense, 
--get user account name and account id by user_id and account_type_name ='bank'
SELECT ua.account_id, ua.account_name, ua.account_balance,  ct.currency_code, act.account_type_id, act.account_type_name 
      FROM user_accounts ua
      JOIN account_types act ON ua.account_type_id = act.account_type_id
      JOIN currencies ct ON ua.currency_id = ct.currency_id
      WHERE ua.user_id = $1
      AND act.account_type_name = $2 AND ua.account_name != $3
      ORDER BY ua.account_balance DESC


--get user account info by user_id and account_type_name ='category_budget'
SELECT ua.account_id, ua.account_name, ua.account_balance, 
act.account_type_name,
ct.currency_code, cba.budget, cnt.category_nature_type_name
FROM user_accounts ua
JOIN account_types act ON ua.account_type_id = act.account_type_id
JOIN currencies ct ON ua.currency_id = ct.currency_id
JOIN category_budget_accounts cba ON ua.account_id = cba.account_id
JOIN category_nature_types cnt ON cba.category_nature_type_id = cnt.category_nature_type_id
WHERE ua.user_id = '6e0ba475-bf23-4e1b-a125-3a8f0b3d352c'
AND act.account_type_name = 'category_budget' AND ua.account_name != 'slack'
ORDER BY ua.account_balance DESC

-- TO GET THE RESTRICTION NAME
SELECT constraint_name
FROM information_schema.table_constraints
WHERE table_name = 'movement_types' AND constraint_type = 'CHECK';

--

--TO ADD CONSTRAINT
-- ALTER TABLE transactions
-- ADD CONSTRAINT REFERENES user_accounts(account_id) ON DELETE SET NULL ON UPDATE CASCADE,
-- FOREIGN KEY account_id
-- REFERENCES tabla_destino (columna_destino);

-- TO RENAME A COLUMN
-- ALTER TABLE transactions
-- RENAME COLUMN create_at TO created_at;




