import mongoose from "mongoose";
import express from "express";
import { Request, Response } from "express";
import { Dentist, validateRegistration } from "../../models/dentistModel";
import validateObjectId from '../../middlewares/validObjectId'
import asyncwrapper from "../../middlewares/asyncwrapper";

const router = express.Router() 

router.get('/', asyncwrapper( async(req: Request, res: Response) => {
    let dentists = await Dentist.find();
    
    res.status(200).send(dentists); 
}));

router.get('/:id', [validateObjectId], asyncwrapper( async(req: Request, res: Response) => {
    let dentist = await Dentist.findById(req.params.id);

    if(!dentist) return res.status(404).json({"message": "Dentist with given id was not found"});

    return res.status(200).json(dentist);
}));

router.post('/', asyncwrapper(async(req: Request, res: Response) => {

    let { error } = validateRegistration(req.body);
    if(error) return res.status(403).json({"message": "Invalid dentist information"});

    let dentist = await Dentist.findOne({email: req.body.email});
    if(dentist) return res.status(409).json({"message": "Dentit with given id already exists"});

    dentist = new Dentist(req.body);
    await dentist.hashPassword()
    let token = await dentist.signJWT();

    return res.status(201).json({"token": token, dentist})

}));

router.put('/:id', [validateObjectId], async(req: Request, res: Response) => {
    //TODO
});

router.delete('/:id', [validateObjectId], asyncwrapper((req: Request, res: Response) => {
    let dentist = Dentist.findByIdAndDelete(req.params.id);

    if(!dentist) return res.status(404).json({"message": "Dentist with givne id was not found"});

    return res.status(200).json({dentist, "message": "Dentist was deleted successfully"});
}));

router.get('/:id/location', asyncwrapper((req: Request, res: Response) => {
    //TODO: Needs map service through mqtt
}));
