import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
dotenv.config();

export async function hashPassword(password) {
    const saltRounds = 10

    try {
        const hash = await bcrypt.hash(password, saltRounds);
        
        return hash;
    } catch (err) {
        console.log(err);
        throw err;
    }
}

export async function comparePassword(password, hashedPassword) {

    try{
        const result = await bcrypt.compare(password, hashedPassword);

        return result;
    }
    catch (err){
        console.log(err);
        throw err;
    }
}



import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET ;

export function createToken(data){

    const payload = {
        userData : data,
    }

    const options = {
        expiresIn: "24h",
    }

    const token = jwt.sign(payload, SECRET, options)

    console.log(token);

    return token
}


export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ message: 'Access Denied' });

  jwt.verify(token, SECRET, (err, user) => {
    if (err) {
      console.log("Invalid Token");
      return res.status(403).json({ message: 'Invalid Token' });
    }

    console.log("JWT PASSED");
    console.log('JWT payload:', user); 
    req.user = user;
    next();
  });
}

export function decodeToken(token){
    const decodedToken = jwt.decode(token)

    return decodedToken;
}




