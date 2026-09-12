import express from "express"
import AuthService from "../services/auth.service.js";

const router = express.Router()

router.post("/login", AuthService.login)
router.post("/send-verification-code", AuthService.sendVerificationCode)
router.post("/verify-code", AuthService.verifyCode)
router.post("/reset-password", AuthService.resetPassword)
router.post('/logout', (req, res) => {
    return  res.clearCookie('token', {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        path: '/',
    }).status(200).json({ message: 'Logged out' });
});

export default router
