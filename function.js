const {hashPassword, comparePassword,createToken, decodeToken, authenticateToken}= require('./encryption')

const register = async (userData) => {
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

module.exports ={register}