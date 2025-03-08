import express from 'express'
//controllers
import {createIncomeSourceTypes} from '../controllers/typeListController.js'
const router = express.Router();

router.post('/income_source',createIncomeSourceTypes)

export default router;