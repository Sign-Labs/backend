import { hashPassword, comparePassword, createToken, decodeToken, authenticateToken } from './encryption.js';
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();
import bcrypt from 'bcrypt';
import jkg from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import { createClient } from 'redis';

const jwt = jkg;
const JWT_SECRET = process.env.JWT_SECRET;

export const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_DATABASE,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: {
    rejectUnauthorized: false
  },
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















