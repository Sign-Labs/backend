import { pool } from "./database.js";
import {hashPassword, comparePassword,createToken, decodeToken, authenticateToken} from './encryption.js';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import { createClient } from 'redis';
import jkg from 'jsonwebtoken';
const jwt = jkg;
const JWT_SECRET = process.env.JWT_SECRET ;

export async function register(userData) {
  const client = await pool.connect();

  try {
    const { username, name, surname, tel, sex, birthday, email, password } = userData;
    const hashpassword = await hashPassword(password);
    const point = 0;

    // 🔍 ตรวจสอบว่า username มีอยู่แล้วหรือไม่
    const checkUser = await client.query(
      "SELECT id FROM users WHERE username = $1",
      [username]
    );

    if (checkUser.rowCount > 0) {
      return { success: false, message: "Username already exists" };
    }

    
    const insertQuery = `
      INSERT INTO users (username, name, surname, tel, sex, birthday, email, password, point)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, username, name, surname, tel, sex, birthday, email, point
    `;

    const values = [username, name, surname, tel, sex, birthday, email, hashpassword, point];
    const result = await client.query(insertQuery, values);
    const newUser = result.rows[0];

    return {
      success: true,
      message: "User registered successfully",
      user: newUser,
    };
  } catch (error) {
    console.error("Registration error:", error);
    throw new Error(`Registration failed: ${error.message}`);
  } finally {
    client.release();
  }
}



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

