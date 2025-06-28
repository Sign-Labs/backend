import express from 'express';

//const {hashPassword, comparePassword,createToken, decodeToken, authenticateToken}= require('./encryption')
import cors from 'cors';
import dotenv from 'dotenv';
import { register } from './database.js';
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


app.post('/login', async(req,res) =>{

  const client = await pool.connect();
  

})


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




app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});