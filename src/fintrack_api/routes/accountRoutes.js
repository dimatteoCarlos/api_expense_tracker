import express from 'express';
//controllers
import {
  createBasicAccount,
  createDebtorAccount,
  createPocketAccount,
  createCategoryBudgetAccount,
} from '../controllers/accountCreationController.js';

import { getAccountByType } from '../controllers/getAccountController.js';
const router = express.Router();

//create account by type
router.post('/new_account/bank', createBasicAccount); //bank
router.post('/new_account/income_source', createBasicAccount);
router.post('/new_account/investment', createBasicAccount);
router.post('/new_account/debtor', createDebtorAccount);
router.post('/new_account/pocket_saving', createPocketAccount);
router.post('/new_account/category_budget', createCategoryBudgetAccount);

//get accounts by account type
//expense: bank and category_budget account types
router.get('/type', getAccountByType);

export default router;

// const select = true;
// import { verifyHeaderAuth, verifyUser } from '../middlewares/authMiddleware.js';
// router.post('/new_account/bank',verifyUser ,createBasicAccount);
