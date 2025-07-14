import {hashPassword, comparePassword,createToken, decodeToken, authenticateToken} from './encryption.js';
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();
import bcrypt from 'bcrypt';
import jkg from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import { createClient } from 'redis';

const jwt = jkg;
const JWT_SECRET = process.env.JWT_SECRET ;

 export const pool = new Pool({
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


export async function getUserData(req, res) {
  const client = await pool.connect();
  try {
    const userId = req.user.id; // จาก token
    

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const result = await client.query(`
      SELECT id, username, name, surname, tel, sex, birthday, email, point
      FROM users
      WHERE id = $1
    `, [userId]);

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const user = result.rows[0];

    res.json({ success: true, user });

  } catch (err) {
    console.error('Error getting user data:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
  finally{
    client.release();
  }
}




export async function getQuestionsByLesson(req, res) {
  const lessonId = req.params.lessonId;
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT 
        q.id AS question_id,
        q.question_text,
        c.id AS choice_id,
        c.choice_text
      FROM questions q
      JOIN choices c ON q.id = c.question_id
      WHERE q.lesson_id = $1
      ORDER BY q.id, c.id
    `, [lessonId]);

    // แปลงผลให้ group choices ต่อคำถาม
    const questionsMap = {};

    result.rows.forEach(row => {
      const { question_id, question_text, choice_id, choice_text } = row;

      if (!questionsMap[question_id]) {
        questionsMap[question_id] = {
          question_id,
          question_text,
          choices: []
        };
      }

      questionsMap[question_id].choices.push({
        choice_id,
        choice_text
      });
    });

    res.json({ success: true, questions: Object.values(questionsMap) });

  } catch (err) {
    console.error('Error fetching questions:', err);
    res.status(500).json({ success: false, message: 'Failed to get questions' });
  }
  finally{
    client.release();
  }
}


export async function submitAnswer(req, res) {
  const { user_id, question_id, selected_choice_id } = req.body;
  const client = await pool.connect();

  if (!user_id || !question_id || !selected_choice_id) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  try {
    // 1. ตรวจสอบว่า choice ที่เลือกมีอยู่ และถูกหรือไม่
    const check = await client.query(
      `SELECT c.is_correct, q.lesson_id
       FROM choices c
       JOIN questions q ON c.question_id = q.id
       WHERE c.id = $1`,
      [selected_choice_id]
    );

    if (check.rowCount === 0) {
      return res.status(400).json({ success: false, message: 'Choice not found' });
    }

    const { is_correct, lesson_id } = check.rows[0];

    // 2. INSERT หรือ UPDATE คำตอบ พร้อม lesson_id
    await client.query(`
      INSERT INTO user_answers (user_id, lesson_id, question_id, selected_choice_id, is_correct)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_id, question_id)
      DO UPDATE SET
        selected_choice_id = EXCLUDED.selected_choice_id,
        is_correct = EXCLUDED.is_correct,
        lesson_id = EXCLUDED.lesson_id,
        answered_at = CURRENT_TIMESTAMP
    `, [user_id, lesson_id, question_id, selected_choice_id, is_correct]);

    res.json({ success: true, is_correct });

  } catch (err) {
    console.error('Error submitting answer:', err);
    res.status(500).json({ success: false, message: 'Submit failed' });
  } finally {
    client.release();
  }
}



export async function checkAndAwardLessonCompletionFast(userId, lessonId, pointToAdd = 10) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. ตรวจว่าเคยผ่านบทเรียนนี้ไปแล้วหรือยัง
    const passed = await client.query(`
      SELECT 1 FROM user_completed_lessons
      WHERE user_id = $1 AND lesson_id = $2
    `, [userId, lessonId]);

    if (passed.rowCount > 0) {
      await client.query('ROLLBACK');
      return { success: false, message: 'บทเรียนนี้ผ่านไปแล้ว ไม่สามารถรับคะแนนซ้ำได้' };
    }

    // 2. นับคำถามทั้งหมดของบทเรียน
    const totalQ = await client.query(`
      SELECT COUNT(*) FROM questions
      WHERE lesson_id = $1
    `, [lessonId]);
    const totalQuestions = Number(totalQ.rows[0].count);

    // 3. นับจำนวนคำถามที่ user ตอบ "ถูก" แล้วในบทเรียนนั้น
    const correctQ = await client.query(`
      SELECT COUNT(DISTINCT question_id) FROM user_answers
      WHERE user_id = $1 AND lesson_id = $2 AND is_correct = true
    `, [userId, lessonId]);
    const correctCount = Number(correctQ.rows[0].count);

    if (correctCount === totalQuestions && totalQuestions > 0) {
      // 4. ตอบถูกครบทุกข้อ → บันทึกว่า "ผ่าน" + ให้คะแนน
      await client.query(`
        INSERT INTO user_completed_lessons (user_id, lesson_id)
        VALUES ($1, $2)
      `, [userId, lessonId]);

      await client.query(`
        UPDATE users
        SET point = point + $1
        WHERE id = $2
      `, [pointToAdd, userId]);

      await client.query('COMMIT');
      return {
        success: true,
        message: `🎉 ผ่านบทเรียนและได้รับ ${pointToAdd} คะแนน`,
        awarded: true
      };
    } else {
      await client.query('ROLLBACK');
      return {
        success: false,
        message: `คุณตอบถูก ${correctCount}/${totalQuestions} ข้อ ยังไม่ครบ`,
        awarded: false
      };
    }

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error awarding lesson (fast version):', err);
    throw err;
  } finally {
    client.release();
  }
}


export async function multiplesubmitAnswers(req, res) {
  const { user_id, answers } = req.body;

  if (!user_id || !Array.isArray(answers) || answers.length === 0) {
    return res.status(400).json({ success: false, message: 'Invalid input' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // เตรียมคำสั่ง SQL
    const results = [];

    for (const { question_id, selected_choice_id } of answers) {
      // ตรวจสอบ choice และดึง is_correct + lesson_id
      const check = await client.query(`
        SELECT c.is_correct, q.lesson_id
        FROM choices c
        JOIN questions q ON c.question_id = q.id
        WHERE c.id = $1 AND q.id = $2
      `, [selected_choice_id, question_id]);

      if (check.rowCount === 0) {
        results.push({
          question_id,
          success: false,
          message: 'Choice or question not found'
        });
        continue;
      }

      const { is_correct, lesson_id } = check.rows[0];

      // INSERT หรือ UPDATE คำตอบ
      await client.query(`
        INSERT INTO user_answers (user_id, lesson_id, question_id, selected_choice_id, is_correct)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (user_id, question_id)
        DO UPDATE SET
          selected_choice_id = EXCLUDED.selected_choice_id,
          is_correct = EXCLUDED.is_correct,
          lesson_id = EXCLUDED.lesson_id,
          answered_at = CURRENT_TIMESTAMP
      `, [user_id, lesson_id, question_id, selected_choice_id, is_correct]);

      results.push({
        question_id,
        success: true,
        is_correct
      });
    }

    await client.query('COMMIT');
    res.json({ success: true, results });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error in submitAnswers:', err);
    res.status(500).json({ success: false, message: 'Submit failed' });
  } finally {
    client.release();
  }
}


export async function getLeaderboard(req, res) {
  const userId = req.user?.id; // ต้องมี middleware auth ก่อนหน้านี้
  const client = await pool.connect();

  try {
    // ดึง top 7
    const topUsersResult = await client.query(`
      SELECT id, username, point, RANK() OVER (ORDER BY point DESC) AS rank
      FROM users
      ORDER BY point DESC
      LIMIT 7
    `);

    const topUsers = topUsersResult.rows;

    // ดึง rank ของ user ปัจจุบัน
    let userRankResult = await client.query(`
      SELECT id, username, point, rank FROM (
        SELECT id, username, point, RANK() OVER (ORDER BY point DESC) AS rank
        FROM users
      ) AS ranked
      WHERE id = $1
    `, [userId]);

    const currentUser = userRankResult.rows[0];

    res.json({
      success: true,
      leaderboard: topUsers,
      current_user: currentUser || null
    });

  } catch (err) {
    console.error("Leaderboard error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  } finally {
    client.release();
  }
}




export async function getCorrectChoice(req, res) {
  const questionId = req.params.questionId;
  const client = await pool.connect();

  try {
    const result = await client.query(`
      SELECT 
        id AS choice_id,
        choice_text
        
      FROM choices
      WHERE question_id = $1 AND is_correct = TRUE
      LIMIT 1
    `, [questionId]);

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: "Correct choice not found" });
    }

    res.json({
      success: true,
      answer: result.rows[0]
    });

  } catch (err) {
    console.error("Error fetching correct choice:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  } finally {
    client.release();
  }
}

export async function checkUserExists(req, res) {
  const { username, email } = req.body;

  if (!username || !email) {
    return res.status(400).json({ success: false, message: "Username and email required" });
  }

  try {
    const result = await pool.query(
      `SELECT username, email FROM users WHERE username = $1 OR email = $2`,
      [username, email]
    );

    const conflicts = result.rows;

    const conflictMessages = {
      username: conflicts.find(u => u.username === username) ? 'Username already exists' : null,
      email: conflicts.find(u => u.email === email) ? 'Email already exists' : null
    };

    if (conflictMessages.username || conflictMessages.email) {
      return res.status(409).json({
        success: false,
        conflicts: conflictMessages
      });
    }

    res.json({ success: true });

  } catch (err) {
    console.error("Check user exists error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
}


export async function updateUserStageProgress(req, res) {
  const { user_id, stage_id } = req.body;
  const client = await pool.connect();

  try {
    // ตรวจสอบ stage ปัจจุบันที่เคยบันทึกไว้
    const existing = await client.query(
      `SELECT last_stage_id FROM user_stage_progress WHERE user_id = $1`,
      [user_id]
    );

    if (existing.rowCount > 0) {
      const currentStage = existing.rows[0].last_stage_id;

      // ถ้า stage เดิมหรือย้อนหลัง ไม่ต้อง update
      if (stage_id <= currentStage) {
        return res.json({ success: false, message: "Stage is not newer than current progress" });
      }
    }

    // บันทึกหรืออัปเดต stage ที่ใหม่กว่า
    await client.query(`
      INSERT INTO user_stage_progress (user_id, last_stage_id)
      VALUES ($1, $2)
      ON CONFLICT (user_id)
      DO UPDATE SET last_stage_id = EXCLUDED.last_stage_id
    `, [user_id, stage_id]);

    res.json({ success: true, message: "Progress updated" });

  } catch (err) {
    console.error('Error updating progress:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  } finally {
    client.release();
  }
}


export async function getUserStageProgress(req, res) {
  const user_id = parseInt(req.params.user_id);
  const client = await pool.connect();

  try {
    const result = await client.query(`
      SELECT 
        usp.last_stage_id, 
        s.chapter_number, 
        s.stage_number, 
        s.title
      FROM user_stage_progress usp
      JOIN stages s ON usp.last_stage_id = s.id
      WHERE usp.user_id = $1
      ORDER BY s.chapter_number DESC, s.stage_number DESC
      LIMIT 1
    `, [user_id]);

    if (result.rowCount === 0) {
      return res.json({ success: true, progress: null });
    }

    res.json({ success: true, progress: result.rows[0] });

  } catch (err) {
    console.error('Error fetching user stage progress:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  } finally {
    client.release();
  }
}


export async function addUserPoint(user_id, amount) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // อัปเดตคะแนน
    const result = await client.query(
      `UPDATE users
       SET point = point + $1
       WHERE id = $2
       RETURNING id, username, point`,
      [amount, user_id]
    );

    await client.query('COMMIT');
    return result.rows[0];

  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Error adding points:", err);
    throw err;
  } finally {
    client.release();
  }
}