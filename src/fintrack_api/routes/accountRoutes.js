import express from 'express'
//controllers
import {createAccount} from '../controllers/accountController.js'
const router = express.Router();

router.post('/new_account',createAccount)

export default router;

