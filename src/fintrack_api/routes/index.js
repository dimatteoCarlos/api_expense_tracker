import express from 'express'

import accountRoutes from './accountRoutes.js'
import typeListRoutes from './typeListRoutes.js'
import transactionRoutes from './transactionRoute.js'
import dashboardRoutes from './dashboardRoutes.js'

const router = express.Router();

router.use('/type',typeListRoutes)
router.use('/account',accountRoutes)
router.use('/transaction', transactionRoutes)
router.use('/dashboard', dashboardRoutes)

export default router;