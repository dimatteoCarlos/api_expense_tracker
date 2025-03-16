import express from 'express';
import { dashboardTotalBalanceAccountByType, dashboardTotalBalanceAccounts } from '../controllers/dashboardController.js';

const router = express.Router();

router.get('/balance', dashboardTotalBalanceAccounts);
router.get('/balance/type', dashboardTotalBalanceAccountByType);

export default router;
