import express from 'express';
import { createClient } from 'redis';
//const {hashPassword, comparePassword,createToken, decodeToken, authenticateToken}= require('./encryption')
import cors from 'cors';
import dotenv from 'dotenv';
import { register,login,generateOtp,sendOtpEmail,verifyOtp,checkOtpVerified,resetPassword,changePassword, getUserData,getQuestionsByLesson,submitAnswer,checkAndAwardLessonCompletionFast 
  ,multiplesubmitAnswers,getLeaderboard,getCorrectChoice,checkUserExists,updateUserStageProgress,getUserStageProgress,addUserPoint
 } from './database.js';
import { authenticateToken } from './encryption.js';
dotenv.config();
import mqtt from "mqtt"; // import namespace "mqtt"
let client = mqtt.connect("mqtt://test.mosquitto.org"); // create a client

const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// PostgreSQL connection pool






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


app.post('/change-password', authenticateToken, async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;
      const userId = req.user.id;
  

  if (!currentPassword || !newPassword || !confirmPassword) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({ error: 'New passwords do not match' });
  }

  try {
    await changePassword(userId, currentPassword, newPassword);
    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});


app.get("/getdata",authenticateToken,getUserData);








const redis = createClient();

redis.on('error', (err) => console.error('❌ Redis Error:', err));
redis.on('connect', () => console.log('✅ Redis connected'));

await redis.connect();

const pong = await redis.ping();
console.log('📡 Redis PING response:', pong);

await redis.quit();



app.get('/questions/:lessonId',authenticateToken ,getQuestionsByLesson);
app.post('/answer', authenticateToken,submitAnswer);
app.post('/multipleanswer', authenticateToken,multiplesubmitAnswers);



app.post('/complete-lesson', authenticateToken, async (req, res) => {
  const { lessonId } = req.body;
  const userId = req.user.id;

  try {
    const result = await checkAndAwardLessonCompletionFast(userId, lessonId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในเซิร์ฟเวอร์' });
  }
});


app.get('/leaderboard', authenticateToken, getLeaderboard);

app.get('/hint/:questionId', authenticateToken, getCorrectChoice);

app.post('/check-user', checkUserExists);

app.post('/update-progress',authenticateToken, updateUserStageProgress);
app.get('/stage-progress/:user_id',authenticateToken, getUserStageProgress);

app.post("/add-point",authenticateToken ,async (req, res) => {
  const { user_id, amount } = req.body;

  if (!user_id || typeof amount !== "number") {
    return res.status(400).json({
      success: false,
      message: "user_id and amount (number) are required",
    });
  }

  try {
    const updatedUser = await addUserPoint(user_id, amount);
    res.json({ success: true, user: updatedUser });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to add point",
    });
  }
});









app.listen(3000, '0.0.0.0', () => {
  console.log('Server running on http://0.0.0.0:3000');
});