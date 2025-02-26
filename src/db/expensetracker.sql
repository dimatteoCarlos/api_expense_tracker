-- "Get all users' info, except for passwords and account IDs."
SELECT username, email, user_firstname,user_role_name,  currency_code FROM users 
JOIN currencies ON users.currency_id = currencies.currency_id
JOIN user_roles ON users.user_role_id = user_roles.user_role_id
ORDER BY username ASC

-- get user by id
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

-- check user existence by id
 SELECT 1
    FROM users u
    JOIN user_accounts ON user_accounts.user_id = u.user_id
    JOIN currencies ON currencies.currency_id = u.currency_id
    JOIN user_roles ON user_roles.user_role_id = u.user_role_id
    WHERE u.user_id = $1
    LIMIT 1.rows[0]

-- get all user id accounts by user id 
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

-- get all user account info by user id and account id, 

-- get all user sources income by user id

-- get all user account info by user id account id and account type id
