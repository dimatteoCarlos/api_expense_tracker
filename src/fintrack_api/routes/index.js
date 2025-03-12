import express from 'express'

import accountRoutes from './accountRoutes.js'
import typeListRoutes from './typeListRoutes.js'
import transactionRoutes from './transactionRoute.js'
const router = express.Router();

router.use('/type',typeListRoutes)
router.use('/account',accountRoutes)
router.use('/transaction', transactionRoutes)

export default router;