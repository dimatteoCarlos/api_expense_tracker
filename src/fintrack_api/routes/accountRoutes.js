import express from 'express';
//controllers
import {
  createBasicAccount,
  createDebtorAccount,
  createPocketAccount,
  // createCategoryBudgetAccount,
} from '../controllers/accountCreationController.js';

import {
  getAccounts,
  getAccountByType,
  getAccountById,
} from '../controllers/getAccountController.js';
import { createCategoryBudgetAccount } from '../controllers/accountCategoryCreationcontroller.js';

// const select = true;
// import { verifyHeaderAuth, verifyUser } from '../middlewares/authMiddleware.js';
// router.post('/new_account/bank',verifyUser ,createBasicAccount);
const router = express.Router();

//create account by type
router.post('/new_account/bank', createBasicAccount); //bank
router.post('/new_account/income_source', createBasicAccount);
router.post('/new_account/investment', createBasicAccount);
router.post('/new_account/debtor', createDebtorAccount);
router.post('/new_account/pocket_saving', createPocketAccount);
router.post('/new_account/category_budget', createCategoryBudgetAccount);
//---------------------------------------------
//tracker movements - type accounts involved
//expense: bank and category_budget account types
//income: bank and income_source_accounts
//investment: investment_accounts
//pocket_saving: pocket_saving_accounts
//debtor: debtor_accounts

router.get('/allAccounts', getAccounts);
router.get('/type', getAccountByType);
router.get('/:accountId', getAccountById);

//----------------------------------------------




export default router;
