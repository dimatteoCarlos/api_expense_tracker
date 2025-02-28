import express from 'express'
import {
  getTransaction,
  // createTransaction,
  // addMoneyToTransaction,
} from '../controllers/transactionController.js';

const router = express.Router()

// const select = true;
// const middlewareFn = select ? verifyUser : verifyHeaderAuth;
router.get('/', getTransaction)


export default router;
