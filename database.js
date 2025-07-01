import {hashPassword, comparePassword,createToken, decodeToken, authenticateToken} from './encryption.js';
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();
import bcrypt from 'bcrypt';
import jkg from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import { createClient } from 'redis';

const jwt = jkg;
const JWT_SECRET = process.env.JWT_SECRET ;

  const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_DATABASE,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// Test database connection
pool.connect((err, client, release) => {
  if (err) {
    console.error('Error connecting to PostgreSQL database:', err);
    return;
  }
  console.log('Connected to PostgreSQL database successfully');
  release();
});


export async function register(userData)  {
  const client = await pool.connect();
  
  try {
    const {
      username,name,surname,tel,sex,birthday, email,password } = userData;
    
    const hashpassword = await hashPassword(password);
    const point = 0;

    const values = [
      username,
      name,
      surname,
      tel,
      sex,
      birthday,
      email,
      hashpassword,
      point
    ];

    const insertQuery = `
      INSERT INTO users (username, name, surname, tel, sex, birthday, email, password, point)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, username, name, surname, tel, sex, birthday, email, point
    `;

    const result = await client.query(insertQuery, values);
    const newUser = result.rows[0];

    return {
      success: true,
      message: 'User registered successfully',
      user: {
        id: newUser.id,
        username: newUser.username,
        name: newUser.name,
        surname: newUser.surname,
        tel: newUser.tel,
        sex: newUser.sex,
        birthday: newUser.birthday,
        email: newUser.email,
        point: newUser.point
      }
    };

  } catch (error) {
    console.error('Registration error:', error);
    throw new Error(`Registration failed: ${error.message}`);
  } finally {
    client.release();
  }
};


export async function login(loginData) {
  if (!pool) {
    throw new Error('Database pool not initialized');
  }

  const client = await pool.connect();
  
  try {
    const { username, password } = loginData; // username can be username or email
    
    // Input validation
    if (!username || !password) {
      throw new Error('Username/email and password are required');
    }

    // Check if username is email or username
    const isEmail = username.includes('@');
    
    // Query to find user by either username or email
    const findUserQuery = isEmail 
      ? `SELECT id, username, name, surname, tel, sex, birthday, email, password, point 
         FROM users WHERE email = $1`
      : `SELECT id, username, name, surname, tel, sex, birthday, email, password, point 
         FROM users WHERE username = $1`;

    const result = await client.query(findUserQuery, [username]);
    
    // Check if user exists
    if (result.rows.length === 0) {
      throw new Error('Invalid credentials');
    }

    const user = result.rows[0];
    
    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      throw new Error('Invalid credentials');
    }

    // Generate JWT token
    const token = jwt.sign(
  { id: user.id, username: user.username }, // ต้องมี id!
  process.env.JWT_SECRET,
  { expiresIn: '1h' }
);

    // Return user data (without password) and token
    return {
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        surname: user.surname,
        tel: user.tel,
        sex: user.sex,
        birthday: user.birthday,
        email: user.email,
        point: user.point
      }
    };

  } catch (error) {
    console.error('Login error:', error);
    throw new Error(`Login failed: ${error.message}`);
  } finally {
    client.release();
  }
}




const redisClient = createClient();
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


export async function resetPassword(email, newPassword, confirmPassword) {
   const client = await pool.connect();
  if (!email || !newPassword || !confirmPassword) {
    return res.status(400).json({ error: 'all field required' });
  }

  if (newPassword !== confirmPassword) {
   return res.status(400).json({ error: 'password not match' });
  }

  const data = await redisClient.get(`otp:${email}`);
  if (!data) {
   return res.status(400).json({ error: 'OTP not correct or expired' });
  }

  const parsed = JSON.parse(data);
  if (!parsed.verified) {
    return res.status(403).json({ error: 'Email not verified via OTP' });
  }

  
  const passwordHash = await hashPassword(newPassword); 

  // update password ใน DB
const updateQuery = `
    UPDATE users SET password = $1 WHERE email = $2
    RETURNING id
  `;

  

  try {
    const result = await client.query(updateQuery, [passwordHash, email]);

    if (result.rowCount === 0) {
      throw new Error('User not found');
    }

    // ✅ ลบ OTP key ออก (ความปลอดภัย)
    await redisClient.del(`otp:${email}`);
    return true;

  } finally {
     await redisClient.del(`otp:${email}`);
     client.release(); 
  return true;
  
  }


 
}



export async function changePassword(userId, currentPassword, newPassword) {
  const client = await pool.connect();
  try {
    // 1. Get current hashed password from DB
    const result = await client.query(
      'SELECT password FROM users WHERE id = $1',
      [userId]
    );

    if (result.rowCount === 0) {
      throw new Error('User not found');
    }

    const user = result.rows[0];

    // 2. Compare current password
    const isMatch = await comparePassword(currentPassword, user.password);
    if (!isMatch) {
      throw new Error('Current password is incorrect');
    }

    // 3. Hash new password
    const newHashed = await hashPassword(newPassword);

    // 4. Update password in DB
    await client.query(
      'UPDATE users SET password = $1 WHERE id = $2',
      [newHashed, userId]
    );

    return true;
  } finally {
    client.release();
  }
}











