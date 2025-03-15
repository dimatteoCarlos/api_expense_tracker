import express from 'express';
import { dashboardTotalBalanceAccount } from '../controllers/dashboardController.js';

const router = express.Router();

router.get('/balance', dashboardTotalBalanceAccount);

export default router;
