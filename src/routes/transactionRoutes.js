import express from 'express';
import {
  getDashboardInformation,
  getTransaction,
  // createTransaction,
  // addMoneyToTransaction,
} from '../controllers/transactionController.js';

const router = express.Router();

// const select = true;
// const middlewareFn = select ? verifyUser : verifyHeaderAuth;
router.get('/', getTransaction);
router.post('/', addTransaction);
router.get('/', getDashboardInformation);

export default router;
