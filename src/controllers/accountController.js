//createAccount
//addMoneyToAccount
//deleteAccount
//getAccount
//endpoint :  http://localhost:5000/api/accounts/?user=userId&account_type=all&limit=50&offset=0
console.log(`getAccount`);
console.log(req.query);
//before calling getAccount user must be verified with verifyUser() authmiddleware; in that case take userId from req.user
// const isAdmin = userRole === 'admin' || userRole === 'superadmin';
const { userId } = req.query;
// export const getAccount = async (req, res, next) => {
export const createAccount = async (req, res, next) => {
  try {
    // const userId = req.query.userId;
    const {
      name: account_name,
      type: account_type_name,
      currency: currency_code,
      amount: account_starting_amount,
      // amount: account_balance,
      date: account_start_date,
    } = req.body;

    //search user_accounts b userId and account name
    const accountExistQuery = {
      text: `SELECT * FROM users_accounts WHERE user_id = $1 AND account_name ILIKE '%$2%'`,
      values: [userId, `%${account_name}%`],
    };

    const accountExistResult = await pool.query(accountExistQuery);
    const accountExist = accountExistResult.rows.length > 0;

    if (accountExist) {
      return res.status(409).json({
        status: 409,
        message: ` ${accountExistResult.rows.length} account found with similar name`,
      });
    }

    //currency and account type ids handling (since theses are chosen from a select, non existence should not be an issue)
    const currencyIdResult = await pool.query({
      text: `SELECT currency_id FROM currencies WHERE currency_code = $1`,
      values: [currency_code],
    });

    const accountTypeIdResult = await pool.query({
      text: `SELECT account_id FROM account_types WHERE account_name = $1`,
      values: [account_name],
    });

    const currencyId = currencyIdResult.rows[0],
      accountTypeId = accountTypeIdResult.rows[0];

    const createAccountResult = await pool.query({
      text: `INSERT INTO user_accounts ( user_id, account_name,
       account_type_id, currency_id,
       account_starting_amount, account_start_date, account_balance)
        VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      values: [
        userId,
        account_name,
        accountTypeId,
        currencyId,
        account_starting_amount,
        account_start_date,
        account_starting_amount,
      ],
    });

    //Add initial deposit transaction
    const newAccount = createAccountResult.rows[0];
    const description = newAccount.account_name + '- (initial Deposit)';
    const movement_type_id = 2; //income

    //BUSCAR currncy_id, source_id con base en los datos suministrados en el body
    const initialDepositQuery = {
      text: `INSERT INTO transaction(user_id, description, movement_type_id, status,  amount, currency_id,  account_name ) VALUES($1,$2,$3,$4,$5,$6,$7)  `,
      values: [
        userId,
        description,
        movement_type_id,
        'completado',
        account_starting_amount,
        currencyId,
        newAccount.account_name,
      ],
    };

    await pool.query(initialDepositQuery);

    //opcion de crear cuentas en un arreglo y guardarlo en users
    // UPDATE users SET accounts_id = array_cat(accounts, $1), update_dat = CURRENT_TIMESTAMP id=$2 RETURNING *, values:[accounts, userId]

    res.status(200).json({
      message: `message:${newAccount.account_name} Account created successfully`,
      data: newAccount,
    });
  } catch (error) {
    console.log('error when creating account:', error);
    next(error);
  }
};
