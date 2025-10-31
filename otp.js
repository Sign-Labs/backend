import dotenv from 'dotenv';
dotenv.config();
import { createClient } from 'redis';
import nodemailer from 'nodemailer';

const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://redis:6379'
});
await redisClient.connect();

export async function generateOtp(email) {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const key = `otp:${email}`;
  await redisClient.set(`otp:${email}`, JSON.stringify({ otp, verified: false }), { EX: 300 });
  return otp;
}


export async function verifyOtp(email, inputOtp) {
  const key = `otp:${email}`;
  const data = await redisClient.get(key);
  if (!data) return false;

  const record = JSON.parse(data);
  if (inputOtp === record.otp) {
    record.verified = true;
    await redisClient.set(key, JSON.stringify(record), { EX: 300 });
    return true; 
  }

  return false;
}



const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false, // TLS
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendOtpEmail(to, otp, subject, html) {
  const info = await transporter.sendMail({
    from: `"SignLab" <${process.env.SMTP_USER}>`,
    to,
    subject: subject,
    html: html,
  });

  console.log(" Email sent:", info.messageId);
}


export async function checkOtpVerified(req, res, next) {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });

  const data = await redisClient.get(`otp:${email}`);
  if (!data) return res.status(400).json({ error: 'OTP not correct or expired' });

  const parsed = JSON.parse(data);
  if (!parsed.verified) return res.status(403).json({ error: 'Email not verified via OTP' });

  next();
}