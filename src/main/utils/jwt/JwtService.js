import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET =  process.env.JWT_SECRET || 'your-super-secret';
const JWT_EXPIRES_IN = process.env.JWT_SECRET_EXPIRATION || '1d';

// Логирование для отладки (только в development)
if (process.env.NODE_ENV === 'development') {
  console.log('JWT_SECRET loaded:', JWT_SECRET ? '✓ (from env)' : '✗ (using default)');
}

export const generateToken = (user) => {
    return jwt.sign(
        { id: user.id, phone: user.phone, role: user.role, office_id: user.office_id },
        JWT_SECRET,
        {expiresIn: JWT_EXPIRES_IN,}
    );
};
export const setTokenCookie=(res, token) =>{
    res.cookie('token', token, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: 7 * 24 * 60 * 60 * 1000
    });
}
