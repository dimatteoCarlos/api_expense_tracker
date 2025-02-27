import express from 'express';
import authRoutes from './authRoutes.js';
import userRoutes from './userRoutes.js';
import accountRoutes from './accountRoutes.js';
// import transactionRoutes from './transactionRoutes.js'

const router = express.Router(); //es la misma aplicacion o es otra, como es el flujo ?
console.log('en el index de routes');
router.use('/auth', authRoutes);
router.use('/user', userRoutes);
router.use('/accounts', accountRoutes);

export default router;
