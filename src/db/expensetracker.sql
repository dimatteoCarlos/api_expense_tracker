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

-- Get all user accounta info by user id and account name,
SELECT * FROM users_accounts WHERE user_id = $1 AND account_name ILIKE $2 ORDER BY account_name;

-- {text:`SELECT * FROM users_accounts WHERE user_id = $1 AND account_name ILIKE $2  ORDER BY account_name`, values: [userId, `%${account_name}%`]}

-- get all user sources income by user id


-- get all user accounts  by user_id and account type id
SELECT * FROM user_accounts WHERE user_id ='430e5635-d1e6-4f53-a104-5575c6e60c81'
AND account_type_id = 2

-- get currency_id from currencies by currency_code
SELECT currency_id  FROM currencies WHERE currency_code= $1



-- de interes
-- ALTER TABLE transactions
-- RENAME COLUMN create_at TO created_at;




