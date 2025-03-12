import express from 'express';
import { transferBetweenAccounts } from '../controllers/transactionController.js';

const router = express.Router();

router.use('/transfer-between-accounts', transferBetweenAccounts);
// router.use('/transfer-between-accounts/?movement', transferBetweenAccounts);
// router.use('/transfer-between-accounts/?movement', transferBetweenAccounts);
// router.use('/transfer-between-accounts/?movement', transferBetweenAccounts);
// router.use('/transfer-between-accounts/?movement', transferBetweenAccounts);

export default router;
