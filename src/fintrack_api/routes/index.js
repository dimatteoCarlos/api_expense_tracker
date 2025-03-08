import express from 'express'

import accountRoutes from './accountRoutes.js'
import typeListRoutes from './typeListRoutes.js'
const router = express.Router();

router.use('/type',typeListRoutes)
router.use('/account',accountRoutes)
// router.use('/account',accountRoutes)

export default router;