import express from 'express';
import { signUpUser, signInUser } from '../controllers/authController.js';
const router = express.Router();

console.log('authRoutes.js');

//api/auth/sign-up
router.post('/sign-up', signUpUser); //register
//api/auth/sign-in
router.post('/sign-in', signInUser); // login

export default router;


