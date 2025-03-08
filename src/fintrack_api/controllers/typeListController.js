//typeListController.js

import pc from 'picocolors';
import {
  createError,
  handlePostgresError,
} from '../../../utils/errorHandling.js';
import { pool } from '../../db/configDB.js';

//typeListController/createIncomeSourceTypes
//post: http://localhost:5000/api/fintrack/account/income_source?user=430e5635-d1e6-4f53-a104-5575c6e60c81

export const createIncomeSourceTypes = async (req, res, next) => {
  console.log(pc.blueBright('createIncomeSourceTypes'));
  console.log(req.body, req.params, req.query);
  //implement verifyUser and then get userId from res.user

  try {
    const { user: userId } = req.query;

    console.log('🚀 ~ createIncomeSourceTypes ~ userId:', userId);

    if (!userId) {
      const message = 'User ID is required';
      console.warn(pc.blueBright(message));
      return res.status(400).json({ status: 400, message });
    }

    const { source_name } = req.body;

    if (!source_name) {
      const message = `Source name is required`;
      console.warn(pc.blueBright(message));
      return res.status(400).json({ status: 400, message });
    }

    //table IncomeSources must exist - created at db initialization
    //verify source_name does not exist

    const sourceNameExistResult = await pool.query({
      text: `SELECT * FROM income_sources WHERE user_id = $1 AND source_name ILIKE $2`,
      values: [userId, `%${source_name}%`],
    });

    if (sourceNameExistResult.rows.length > 0) {
      throw new Error(
        `${sourceNameExistResult.rows.length} income souce(s) found with a similar name. Try again`
      );
    }

    const sourceNameCreated = await pool.query({
      text: `INSERT INTO income_sources(user_id,source_name) VALUES($1,$2) RETURNING *`,
      values: [userId, source_name],
    });

    console.log(sourceNameCreated.rows[0]);

    return res.status(200).json({
      message: `${sourceNameCreated.rows[0].source_name} income source with the id ${sourceNameCreated.rows[0].source_id} was successfully  created`,
      data: sourceNameCreated.rows[0],
    });
  } catch (error) {
    console.error(
      pc.red('when creating income source list type:'),
      error.message || 'something went wrong'
    );
    //handle pg errors
    const { code, message } = handlePostgresError(error);
    return next(createError(code, message));
  }
};
