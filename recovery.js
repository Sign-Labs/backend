import { pool } from "./database.js";
import {hashPassword, comparePassword,createToken, decodeToken, authenticateToken} from './encryption.js';
import dotenv from 'dotenv';
import { createClient } from 'redis';
import jkg from 'jsonwebtoken';
const jwt = jkg;
const JWT_SECRET = process.env.JWT_SECRET ;
dotenv.config();

const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://redis:6379'
});
await redisClient.connect();





export async function resetPassword(email, newPassword, confirmPassword) {
  const client = await pool.connect();

  if (!email || !newPassword || !confirmPassword) {
    return "All fields are required";
  }

  if (newPassword !== confirmPassword) {
    return "Passwords do not match";
  }

  const data = await redisClient.get(`otp:${email}`);
  if (!data) {
    return "OTP not correct or expired";
  }

  const parsed = JSON.parse(data);
  if (!parsed.verified) {
    return "Email not verified via OTP";
  }

  try {
    const passwordHash = await hashPassword(newPassword);
    const result = await client.query(
      `UPDATE users SET password = $1 WHERE email = $2 RETURNING id`,
      [passwordHash, email]
    );

    if (result.rowCount === 0) {
      return "User not found";
    }

    await redisClient.del(`otp:${email}`);
    return true;

  } catch (err) {
    console.error("DB error:", err);
    return "Internal server error";
  } finally {
    client.release();
  }
}