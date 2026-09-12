import bcrypt from "bcrypt";

export async function getHashedPassword(password) {
    return await bcrypt.hash(password, 10);
}

export function comparePassword(password, hashedPassword) {
    return bcrypt.compare(password, hashedPassword);
}
export function randomString(length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}
