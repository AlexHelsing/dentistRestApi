import {Request, Response, NextFunction} from 'express';
import jwt = require('jsonwebtoken');

export default async function authDentist (req: Request, res: Response, next: NextFunction) {
    let token: string | undefined  = req.headers['x-access-token'] as string
    
    if(!token) return res.status(401).json({"message":"Access denided, token was not provided."});
    
    try {
        if (process.env.JWT_SECRET === undefined || process.env.JWT_SECRET.trim() as string === '') {
            throw new Error("Json webtoken secret was not provided.");
        }

        let decoded = await jwt.verify(token, process.env.JWT_SECRET) as jwt.JwtPayload;
        
        if(decoded._id === req.params.id) {
            next()
        }
        else {
            return res.status(401).json({"message":"Unauthorized access"})
        }
    }
    catch(err) {
        // jwt throws an error in case of failure in verification of token.
        return res.status(401).json({"message":"Unauthorized access"})
    }

}