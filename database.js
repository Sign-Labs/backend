import {hashPassword, comparePassword,createToken, decodeToken, authenticateToken} from './encryption.js';
import pkg from 'pg';
const { Pool } = pkg;

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

