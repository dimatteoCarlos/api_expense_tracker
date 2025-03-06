import express from 'express'
//controllers
import {createIncomeSource} from '../controllers/accountController.js'
const router = express.Router();

router.post('/income_source',createIncomeSource)

export default router;