import express from 'express';

//const {hashPassword, comparePassword,createToken, decodeToken, authenticateToken}= require('./encryption')
import cors from 'cors';
import dotenv from 'dotenv';
import { register,login,generateOtp,sendOtpEmail,verifyOtp } from './database.js';
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// PostgreSQL connection pool






app.get('/',  (req, res) => {
  res.send('Hello World!');
  console.log("ENV DB_NAME:", process.env.DB_NAME);
});


app.post('/register',async (req,res)=>
  
{
   try {
    const result = await register(req.body);
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
  });


app.post('/login', async (req, res) => {
  try {
    // Validate request body
    if (!req.body) {
      return res.status(400).json({
        success: false,
        message: 'Request body is required'
      });
    }

    const { username, password } = req.body;

    // Additional validation
    if (!username?.trim() || !password?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Username/email and password are required'
      });
    }

    const result = await login(req.body);
    res.status(200).json(result);

  } catch (error) {
    console.error('Login endpoint error:', error);
    
    // Handle different types of errors
    if (error.message.includes('Invalid credentials')) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username/email or password'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});


app.get('/test-db', async (req, res) => {
  const client = await pool.connect();
  try {
    

    // ลองสร้างตาราง
    await client.query(`
      CREATE TABLE IF NOT EXISTS test_connection (
        id SERIAL PRIMARY KEY,
        message TEXT
      )
    `);

    // ลอง insert ข้อมูล
    const insertResult = await client.query(
      `INSERT INTO test_connection (message) VALUES ($1) RETURNING *`,
      ['Hello from Node.js']
    );

    res.json({
      success: true,
      message: 'Connected and table tested successfully',
      data: insertResult.rows[0]
    });
  } catch (err) {
    console.error('Test connection error:', err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});



app.post('/send-otp', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  const otp = await generateOtp(email);
  await sendOtpEmail(email, otp);

  res.json({ message: 'OTP sent to email' });
});

app.post('/verify-otp', async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ error: 'Email and OTP required' });

  const isValid = await verifyOtp(email, otp);
  if (isValid) {
    res.json({ success: true, message: 'OTP verified' });
  } else {
    res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
  }
});















app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});