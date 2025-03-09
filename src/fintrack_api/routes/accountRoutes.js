import express from 'express';
//controllers
import {
  createBasicAccount,
  createDebtorAccount,
  createPocketAccount,
  // createCategoryBudget,
} from '../controllers/accountController.js';
const router = express.Router();

router.post('/new_account/basic', createBasicAccount); //bank, income_source, investment
router.post('/new_account/income_source', createBasicAccount); //bank, income_source, investment
router.post('/new_account/investment', createBasicAccount); //bank, income_source, investment
router.post('/new_account/debtor', createDebtorAccount);
router.post('/new_account/pocket_saving', createPocketAccount);
// router.post('/new_account/category_budget', createCategoryBudget);

export default router;
