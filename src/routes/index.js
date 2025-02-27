import express from 'express';
import authRoutes from './authRoutes.js';
import userRoutes from './userRoutes.js';
import accountRoutes from './accountRoutes.js';
// import transactionRoutes from './transactionRoutes.js'

const router = express.Router(); //es la misma aplicacion o es otra, como es el flujo ?
console.log('index routes');
router.use('/auth', authRoutes);
router.use('/user', userRoutes);
router.use('/account', accountRoutes);

export default router;
