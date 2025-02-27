import express from 'express';

const router = express.Router();

router.get('/', getAccount);
router.post('/', createAccount);
// router.get('/:id', getAccount)

export default router;

// const select = true;
// const middlewareFn = select ? verifyUser : verifyHeaderAuth;
// import { verifyHeaderAuth, verifyUser } from '../middlewares/authMiddleware.js';
