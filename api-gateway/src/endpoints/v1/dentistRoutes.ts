import express from "express";
import { Request, Response } from "express";
import { Dentist, validateRegistration, validateUpdate } from "../../models/dentistModel";
import validateObjectId from '../../middlewares/validObjectId'
import authDentist from "../../middlewares/dentistAuth";
import asyncwrapper from "../../middlewares/asyncwrapper";
import bcrypt from 'bcrypt';
import {client, handleMqtt} from "../../mqttConnection";

const router = express.Router() 

// Dentist HTTP Handlers

// GET Requests
router.get('/', asyncwrapper( async(req: Request, res: Response) => {
    let dentists = await Dentist.find().select('-password');
    
    res.status(200).send(dentists); 
}));

router.get('/:dentist_id', [validateObjectId, authDentist], asyncwrapper( async(req: Request, res: Response) => {
    let dentist = await Dentist.findById(req.params.dentist_id).select('-password');

    if(!dentist) return res.status(404).json({"message": "Dentist with given id was not found"});

    return res.status(200).json(dentist);
}));

router.get('/:dentist_id/appointment_slots', [validateObjectId], asyncwrapper(async (req: Request, res: Response) => {

    let dentist = await Dentist.findById(req.params.dentist_id);
    if (!dentist) return res.status(404).json({"message": "Dentist with given id was not found"});

    if (!client.connected) return res.status(500).json({"message": "Internal server error"});

    let response = await handleMqtt(`Dentist/${dentist.email}/get_appointments/req`, `Dentist/${dentist.email}/get_appointments/res`, {dentist_id: dentist._id})
    // Expected response is an array of appointments [Last element in array is response status]

    let status = response.pop().status;
    return res.status(status).json(response); 
}));

router.get('/:dentist_id/appointment_slots/:appointment_id', [validateObjectId], asyncwrapper( async(req: Request, res: Response) => {
    let dentist = await Dentist.findById(req.params.dentist_id);
    if(!dentist) return res.status(404).json({"message":"Dentist with given id was not found."});
    
    if(!client.connected) return res.status(500).json({"message":"Internal server error"});

    let response

    try {
        response = await handleMqtt(`Dentist/${dentist.email}/get_appointments/req`, `Dentist/${dentist.email}/get_appointments/res`, {dentist_id: dentist._id})
        // Expected response is an array of appointments [Last element in array is response status]
    }
    catch(err) {
        return res.status(500).json({"message":"Internal server error"});
    }

    let appointment = response.find((appointment: any) => {
        if(appointment._id === req.params.appointment_id) return appointment;
    })

    if(appointment) return res.status(response.pop().status).json(appointment);
    return res.status(404).json({"message": "Appointment with given id was not found."});
}));

// POST Requests
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

// PUT 
router.put('/:dentist_id', [validateObjectId, authDentist], asyncwrapper( async(req: Request, res: Response) => {

    let { error } = validateUpdate(req.body);
    if(error) return res.status(403).json('Invalid update format for dentist' + error.details[0].message);

    if(req.body.password){
        let hashed = await bcrypt.hash(req.body.password, 10);
        req.body.password = hashed;
    }   

    let result = await Dentist.findByIdAndUpdate(req.params.dentist_id, req.body, {new: true})
    if(!result) return res.status(404).json({"message":"Dentist with given id was not found"});
 
    res.status(200).json(result);
}));

// DELETE 
router.delete('/:dentist_id/appointment_slots/:appointment_id', [validateObjectId, authDentist], asyncwrapper(async(req:Request, res:Response) => {
    let dentist = await Dentist.findById(req.params.dentist_id);
    if(!dentist) return res.status(404).json({"message":"Dentist with given id was not found"});

    if(!client.connected) return res.status(500).json({"message":"Internal server error"});
    
    let response

    try {
        response = await handleMqtt(`Dentist/${dentist.email}/cancel_appointment/req`, `Dentist/${dentist.email}/cancel_appointment/res`, {dentist_id: dentist._id, appointment_id: req.params.appointment_id});
        // Expected response is an response objecy[With statue field]
    }
    catch(err) {
        return res.status(500).json({"message":"Internal server error"});
    }

    return res.status(response.status).json({"message":response.message});
}));

// Exporting the router object
export default router;