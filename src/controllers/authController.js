import { createToken, hashed, isRight } from '../../utils/authFn.js';
import { createError } from '../../utils/errorHandling.js';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../db/configDB.js';

//--sign-up or register
export const signUpUser = async (req, res, next) => {
  console.log('sign-up entered');
  try {
    const { username, user_firstname, user_lastname, email } = req.body;
    // console.log(req.body);
    if (
      !(
        username &&
        email &&
        req.body.password &&
        user_firstname &&
        user_lastname
      )
    ) {
      return next(createError(404, 'all fields must be provided'));
    }

    const userExists = await pool.query({
      text: `SELECT EXISTS (SELECT 1 FROM users WHERE username=$1 OR email = $2)`,
      values: [username, email],
    });

    if (userExists.rows[0].exists) {
      return next(
        createError(
          409,
          'username or email address already exist. Try Login with sign-in'
        )
      );
    }

    //que pasa si username existe pero el email no coincide o viceversa?

    let hashedPassword = await hashed(req.body.password);
    req.body.password = undefined;

    const newUserId = uuidv4();
    // console.log('hashedPwd:', hashedPassword.length);
    // console.log('testUUID:', newUserId);

    const userData = await pool.query({
      text: `INSERT INTO users(user_id, username,email,password_hashed,user_firstname,user_lastname ) VALUES ($1, $2, $3,$4,$5, $6) RETURNING user_id, username, email, user_firstname, user_lastname;`,
      values: [
        newUserId,
        username,
        email,
        hashedPassword,
        user_firstname,
        user_lastname,
      ],
    });
    // console.log('pwd:', userData.rows);
    hashedPassword = undefined;

    res.status(201).json({
      status: 201,
      message: `User account created successfully. Username: ${username} email: ${email}`,
      user: userData.rows[0], //que hay aqui
    });
  } catch (error) {
    console.log('auth error:', error);
    next(createError(500, error.message || 'internal signup user error'));
  }
};

//--login
/* get the req.body info - whith username and or email get the user info from the db  - check if not found - check the hashed pwd with userpwd - compare if !isRight - generate a token with the user info required - get the user info from db - message status - res .cookie('acces_token...*/

export const signInUser = async (req, res, next) => {
  const { username, email } = req.body;
  try {
    const userData = (
      await pool.query({
        text: `SELECT username, email, password_hashed, user_id , user_role_id FROM users WHERE username = $1 OR email = $2`,
        values: [username, email],
      })
    ).rows;

    if (!userData[0]) {
      return next(createError(404, 'failed', 'user not found'));
    }

    if (userData.length > 1) {
      console.error(
        'accounts:',
        'there are more than one account with these data'
      );
      return next(createError(400, 'more than one user account found')); //then what to do in this case?
    }
    console.log(req.body.password, userData[0].password_hashed);
    const isCorrect = await isRight(
      req.body.password,
      userData[0].password_hashed
    );
    // console.log("🚀 ~ signInUser ~ isCorrect:", isCorrect)

    if (!isCorrect) {
      console.log('no authenticated:', 'wrong password');
      return next(
        createError(401, 'unauthorized. Wrong password or user data')
      );
    }

    const result = await pool.query({
      text: `SELECT user_role_name FROM user_roles WHERE user_role_id = $1`,
      values: [1],
    });

    const userRole = result ? result.rows[0].user_role_name : '';

    const token = createToken(userData[0].user_id, userRole);

    // console.log( userRole.rows[0].user_role_name ,token);

    req.body.password = undefined;

    userData[0].password_hashed = undefined;

    console.log(
      'you are logged in',
      username,
      email,
      userData[0].user_id

      // req.body.password,
      // userData[0].password_hashed
    );

    return res
      .cookie('access_token', token, { httpOnly: true })
      .status(200)
      .json({
        message: 'successfully logged in',
        username,
        email,
        role: userRole,
        userId: userData[0].user_id,
      });
  } catch (error) {
    console.log('auth error:', error);
    next(createError(500, error.message || 'internal sign-in user error'));
  }
};
