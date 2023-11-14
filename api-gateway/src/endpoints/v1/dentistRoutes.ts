import express from "express";
import { Request, Response } from "express";
import { Dentist, validateRegistration, validateUpdate } from "../../models/dentistModel";
import validateObjectId from '../../middlewares/validObjectId'
import asyncwrapper from "../../middlewares/asyncwrapper";
import bcrypt from 'bcrypt';

const router = express.Router() 

// Dentist HTTP Handlers

// GET Requests
router.get('/', asyncwrapper( async(req: Request, res: Response) => {
    let dentists = await Dentist.find().select('-password');
    
    res.status(200).send(dentists); 
}));

router.get('/:id', [validateObjectId], asyncwrapper( async(req: Request, res: Response) => {
    let dentist = await Dentist.findById(req.params.id).select('-password');

    if(!dentist) return res.status(404).json({"message": "Dentist with given id was not found"});

    return res.status(200).json(dentist);
}));

router.get('/:id/location', [validateObjectId], asyncwrapper( async(req: Request, res: Response) => {
    let dentist = await Dentist.findById(req.params.id).select('-password');

    if(!dentist) return res.status(404).json({"message": "Dentist with given id was not found"});
    res.status(200).json(dentist.location)
}));

// POST Requests
router.post('/', asyncwrapper(async(req: Request, res: Response) => {

    let { error } = validateRegistration(req.body);
    if(error) return res.status(403).json({"message": "Invalid dentist information"});

    let dentist = await Dentist.findOne({email: req.body.email});
    if(dentist) return res.status(409).json({"message": "Dentist with given email already exists"});

    dentist = new Dentist(req.body);
    await dentist.hashPassword()
    let token = await dentist.signJWT();

    let result = await dentist.save()

    return res.status(201).json({"token": token, dentist})    

}));

router.post('/login', asyncwrapper( async(req: Request, res: Response ) => {

    if(!req.body.password || !req.body.email){
        return res.status(403).json({"message": "Missing email or password"});
    }

    let dentist = await Dentist.findOne({email: req.body.email});
    if(!dentist) return res.status(404).json({"message": "Dentist with given email was not found"});

    let match = await bcrypt.compare(req.body.password, dentist.password.toString());
    if(match){
        let token = await dentist.signJWT();
        return res.status(201).json({"token": token});
    }

    res.status(403).json({"message": "incorrect password"});
}));

// PUT Requests
router.put('/:id', [validateObjectId], asyncwrapper( async(req: Request, res: Response) => {

    let { error } = validateUpdate(req.body);
    if(error) return res.status(403).json('Invalid update format for dentist');

    if(req.body.password){
        let hashed = await bcrypt.hash(req.body.password, 10);
        req.body.password = hashed;
    }   

    let result = await Dentist.findByIdAndUpdate(req.params.id, req.body, {new: true})
    if(!result) return res.status(404).json({"message":"Dentist with given id was not found"});
 
    res.status(200).json(result);
}));

// DELETE Requests
router.delete('/:id', [validateObjectId], asyncwrapper((req: Request, res: Response) => {
    let dentist = Dentist.findByIdAndDelete(req.params.id);

    if(!dentist) return res.status(404).json({"message": "Dentist with givne id was not found"});

    return res.status(200).json({dentist, "message": "Dentist was deleted successfully"});
}));

// Exporting the router object
export default router;