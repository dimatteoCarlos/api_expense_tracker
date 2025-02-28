import express from 'express';
import { createAccount, getAccount } from '../controllers/accountController.js';
const router = express.Router();

router.post('/', createAccount);
router.get('/', getAccount);
// router.get('/:id', getAccount)

export default router;

// const select = true;
// const middlewareFn = select ? verifyUser : verifyHeaderAuth;
// import { verifyHeaderAuth, verifyUser } from '../middlewares/authMiddleware.js';
