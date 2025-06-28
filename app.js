import express from 'express';
import pg from 'pg';
const { Pool } = pg;
//const {hashPassword, comparePassword,createToken, decodeToken, authenticateToken}= require('./encryption')
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// PostgreSQL connection pool
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



app.get('/',  (req, res) => {
  res.send('Hello World!');
  console.log("ENV DB_NAME:", process.env.DB_NAME);
});


app.post('/register',async (req,res)=>
  
{
   const client = await pool.connect();
   const {
      username,name,surname,tel,sex,birthday,email,password} = req.body;
    const hashpassword  = await hashPassword(password)

      const values =[
      username,
      name,
      surname,
      tel,
      sex,birthday,email,hashpassword 
      ,point=0

      ]

      

  const insertQuery = `
      INSERT INTO users (username, name, surname, tel, sex, birthday, email, password, point)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING  username, name, surname, tel, sex, birthday, email, point
    `;

    const result = await client.query(insertQuery, values);
    const newUser = result.rows[0];

    // Success response
    res.status(201).json({
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
        
      } })

      client.release();
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