import express from 'express';
import { createClient } from 'redis';
//const {hashPassword, comparePassword,createToken, decodeToken, authenticateToken}= require('./encryption')
import cors from 'cors';
import dotenv from 'dotenv';
import {  getUserData, 
  getLeaderboard,updateUserStageProgress,getUserStageProgress,UpdateProfile } from './info.js';
 import { register,login } from './auth.js';
 import{generateOtp,sendOtpEmail,verifyOtp,checkOtpVerified,} from './otp.js'
 import{resetPassword}from './recovery.js'
import { authenticateToken } from './encryption.js';
dotenv.config();
import { startMQTT } from './mqtt.js';
const app = express();
const port = 3000;
startMQTT();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));




app.get('/',  (req, res) => {
  res.send('Hello World!');
  console.log("ENV DB_NAME:", process.env.DB_NAME);
});


app.post('/register',checkOtpVerified,async (req,res)=>
  
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
    if (!username || !username.trim() || !password || !password.trim()) {
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





app.post('/send-otp', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ success: false, error: 'Email is required' });

  try {
    const otp = await generateOtp(email);
    await sendOtpEmail(email, otp, "Your OTP Code for Register", `<p>Your OTP code is: <strong>${otp}</strong></p><p>This code will expire in 5 minutes.</p>`);

    res.json({ success: true, message: 'OTP sent to email' });
  } catch (err) {
    console.error("Error sending OTP:", err);
    res.status(500).json({ success: false, message: 'Failed to send OTP' });
  }
});


app.post('/otp-forget', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  const otp = await generateOtp(email);
  await sendOtpEmail(email, otp,"Your OTP Code for Reset password",`<p>Your OTP code is: <strong>${otp}</strong></p><p>This code will expire in 5 minutes.</p>`);

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





app.post('/forget-password', checkOtpVerified, async (req, res) => {
  const { email, newPassword, confirmPassword } = req.body;

  const result = await resetPassword(email, newPassword, confirmPassword);

  if (result === true) {
    res.json({ success: true, message: "Password reset successful" });
  } else {
    res.status(400).json({ success: false, message: result });
  }
});




const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://redis:6379'
});

 redisClient.on('error', (err) => console.error('❌ Redis Error:', err));
 redisClient.on('connect', () => console.log('✅ Redis connected'));

await  redisClient.connect();

const pong = await  redisClient.ping();
console.log('📡 Redis PING response:', pong);






app.get("/getdata",authenticateToken,getUserData);
app.get('/leaderboard', authenticateToken, getLeaderboard);
app.post('/update-progress',authenticateToken, updateUserStageProgress);
app.get('/stage-progress/:user_id',authenticateToken, getUserStageProgress);
app.put("/updateprofile", authenticateToken, UpdateProfile);



app.get("/api/:cat/:sub", async (req, res) => {
  const topic = `${req.params.cat}/${req.params.sub}`;
  const key = `mqtt:${topic}`;

  try {
    const data = await  redisClient.get(key);
    if (data) {
      res.json({ topic, data });
    } else {
      res.status(404).json({ error: "No data found or expired" });
    }
  } catch (err) {
    res.status(500).json({ error: "Redis error", details: err.message });
  }
});





app.listen(3000, '0.0.0.0', () => {
  console.log('Server running on http://0.0.0.0:3000');
});