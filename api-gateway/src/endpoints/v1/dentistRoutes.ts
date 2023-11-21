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

router.get('/:id', [authDentist, validateObjectId], asyncwrapper( async(req: Request, res: Response) => {
    let dentist = await Dentist.findById(req.params.id).select('-password');

    if(!dentist) return res.status(404).json({"message": "Dentist with given id was not found"});

    return res.status(200).json(dentist);
}));

router.get('/:id/location', [validateObjectId], asyncwrapper( async(req: Request, res: Response) => {
    let dentist = await Dentist.findById(req.params.id).select('-password');

    if(!dentist) return res.status(404).json({"message": "Dentist with given id was not found"});
    res.status(200).json(dentist.location)
}));

router.get('/:id/appointment_slots', [validateObjectId], asyncwrapper(async (req: Request, res: Response) => {

    let dentist = await Dentist.findById(req.params.id);
    if (!dentist) return res.status(404).json({"message": "Dentist with given id was not found"});

    if (!client.connected) return res.status(500).json({"message": "Internal server error"});

    let response

    try {
        response = await handleMqtt(client, 'Dentist/get_appointments/req', 'Dentist/get_appointments/res', {dentist_id: dentist._id})
        // Expected response is an array of appointments [Last element in array is response status]
    }
    catch(err) {
        return res.status(500).json({"message":"Internal server error"});
    }

    let status = response.pop().status;
    return res.status(status).json(response); 
}));

router.get('/:id/appointment_slots/:appointment_id', [validateObjectId], asyncwrapper( async(req: Request, res: Response) => {
    let dentist = await Dentist.findById(req.params.id);
    if(!dentist) return res.status(404).json({"message":"Dentist with given id was not found."});
    
    if(!client.connected) return res.status(500).json({"message":"Internal server error"});

    let response

    try {
        response = await handleMqtt(client, 'Dentist/get_appointments/req', 'Dentist/get_appointments/res', {dentist_id: dentist._id})
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
router.post('/', asyncwrapper(async(req: Request, res: Response) => {

    let { error } = validateRegistration(req.body);
    if(error) return res.status(403).json({"message": "Invalid dentist information" + error.details[0].message});

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

router.post('/:id/appointment_slots', [validateObjectId, authDentist], asyncwrapper(async (req: Request, res:Response) => {
    let dentist = await Dentist.findById(req.params.id);
    if(!dentist) return res.status(404).json({"message":"Dentist with given id was not found."});
    
    if(!Array.isArray(req.body)) {
        res.status(403).json({"message":"New appointment slots should be sent as an array of appointment objects."});
    }

    //Payload construction
    let payload = '[';
    payload = req.body.map((appointment: any) => {
        return payload = payload + JSON.stringify({
            ...appointment, // appointment:{ date: '2024-08-16', time: '16:00'}
            dentist_id: dentist?._id,
            patient_id: null,
            isBooked: false,
        });
    })
    payload = payload + ']';

    if(!client.connected) return res.status(500).json({"message": "Internal server error"});
        
    let response

    try {
        response = await handleMqtt(client, 'Dentist/add_appointment_slots/req', 'Dentist/add_appointment_slots/res', payload)
        // Expected response is an response objecy[With statue field]
    }
    catch(err) {
        return res.status(500).json({"message":"Internal server error"});
    }

    return res.status(response.status).json({"message": response.message})
}));

// PUT Requests
router.put('/:id', [validateObjectId, authDentist], asyncwrapper( async(req: Request, res: Response) => {

    let { error } = validateUpdate(req.body);
    if(error) return res.status(403).json('Invalid update format for dentist' + error.details[0].message);

    if(req.body.password){
        let hashed = await bcrypt.hash(req.body.password, 10);
        req.body.password = hashed;
    }   

    let result = await Dentist.findByIdAndUpdate(req.params.id, req.body, {new: true})
    if(!result) return res.status(404).json({"message":"Dentist with given id was not found"});
 
    res.status(200).json(result);
}));

// DELETE Requests
router.delete('/:id', [validateObjectId], asyncwrapper( async(req: Request, res: Response) => {
    let dentist = await Dentist.findByIdAndDelete(req.params.id).select('email firstname lastname phone_number');

    if(!dentist) return res.status(404).json({"message": "Dentist with givne id was not found"});

    return res.status(200).json(dentist);
}));

router.delete('/:id/appointment_slots/:appointment_id', [validateObjectId, authDentist], asyncwrapper(async(req:Request, res:Response) => {
    let dentist = await Dentist.findById(req.params.id);
    if(!dentist) return res.status(404).json({"message":"Dentist with given id was not found"});

    if(!client.connected) return res.status(500).json({"message":"Internal server error"});
    
    let response

    try {
        response = await handleMqtt(client, 'Dentist/cancel_appointment/req', 'Dentist/cancel_appointment/res', {dentist_id: dentist._id, appointment_id: req.params.appointment_id});
        // Expected response is an response objecy[With statue field]
    }
    catch(err) {
        return res.status(500).json({"message":"Internal server error"});
    }

    return res.status(response.status).json({"message":response.message});
}));

// Exporting the router object
export default router;