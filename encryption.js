import bcrypt from 'bcrypt';

export async function hashPassword(password) {
    const saltRounds = 10

    try {
        const hash = await bcrypt.hash(password, saltRounds);
        // console.log("Hashed password is:", hash);
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



const jwt = require('jsonwebtoken');

const SECRET = "your_secret_key";

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
    const token = authHeader && authHeader.split(' ')[1]

    console.log(token)

    if (!token) return res.status(401).json({ message: 'Access Denied' });

    jwt.verify(token, SECRET, { expiresIn: '24h' },(err, user) => {
        if (err) {
            console.log("Invaild Token")
            return res.status(403).json({message: 'Invalid Token'});
        }
        console.log("JWT PASSED")
        req.user = user;
        next();
    });
}

function decodeToken(token){
    const decodedToken = jwt.decode(token)

    return decodedToken;
}




//module.exports = {hashPassword, comparePassword,createToken, decodeToken, authenticateToken};