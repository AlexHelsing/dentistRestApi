import express from "express";
import { Request, Response } from "express";
import { Dentist, validateRegistration, validateUpdate } from "../../models/dentistModel";
import validateObjectId from '../../middlewares/validObjectId'
import authDentist from "../../middlewares/dentistAuth";
import asyncwrapper from "../../middlewares/asyncwrapper";
import bcrypt from 'bcrypt';
import client from "../../mqttConnection";

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

    const Reqtopic = "Dentist/get_appointments/req";
    const Restopic = "Dentist/get_appointments/res";

    // Promisify the subscribe and publish operations
    const subscribeAsync = () => new Promise<void>((resolve) => {
        client.subscribe(Restopic, (err) => {
            if (err !== null) console.log(err);
            resolve();
        });
    });

    const publishAsync = () => new Promise<void>((resolve) => {
        client.publish(Reqtopic, JSON.stringify({dentist_id: dentist?._id}), {qos: 1}, (err) => {
            if (err !== null) console.log(err);
            resolve();
        });
    });

    await Promise.all([subscribeAsync(), publishAsync()]);

    //TODO : Add a timeout mechanism if request is not resolved after 5 seconds.
    // Use Promise to handle asynchronous message handling
    const response = await new Promise<any>((resolve) => {
        client.on('message', (topic, payload, packet) => {
            if (topic === Restopic) {
                client.unsubscribe(Restopic);
                console.log(`topic: ${topic}, payload: ${payload}`);

                const parsedPayload = JSON.parse(payload.toString());
                let status = parsedPayload.pop().status;
                resolve({status, data: parsedPayload});
            }
        });
    });

    return res.status(response.status).json(response.data);
}));

router.get('/:id/appointment_slots/:appointment_id', [validateObjectId], asyncwrapper( async(req: Request, res: Response) => {
    let dentist = await Dentist.findById(req.params.id);
    if(!dentist) return res.status(404).json({"message":"Dentist with given id was not found."});
    
    if(!client.connected) return res.status(500).json({"message":"Internal server error"});

    const Reqtopic = "Dentist/get_appointments/req";
    const Restopic = "Dentist/get_appointments/res";

    // Promisify the subscribe and publish operations
    const subscribeAsync = () => new Promise<void>((resolve) => {
        client.subscribe(Restopic, (err) => {
            if (err !== null) console.log(err);
            resolve();
        });
    });

    const publishAsync = () => new Promise<void>((resolve) => {
        client.publish(Reqtopic, JSON.stringify({dentist_id: dentist?._id}), {qos: 1}, (err) => {
            if (err !== null) console.log(err);
            resolve();
        });
    });

    await Promise.all([subscribeAsync(), publishAsync()]);
    // TODO: Add a timout for unresolved requests after 5 sec.
    const response = await new Promise<any>((resolve) => {
        client.on('message', (topic, payload, packet) => {
            if (topic === Restopic) {
                client.unsubscribe(Restopic);
                console.log(`topic: ${topic}, payload: ${payload}`);

                const parsedPayload = JSON.parse(payload.toString());
                let status = parsedPayload.pop().status;
                resolve({status, data: parsedPayload});
            }
        });
    });

    let appointment = response.data.find((appointment: any) => {
        if(appointment._id === req.params.appointment_id) return appointment;
    })

    if(appointment) return res.status(response.status).json(appointment);
    return res.status(404).json({"message": "Appointment with given id was not found."});
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
            ...appointment,
            dentist_id: dentist?._id,
            patient: null,
            isBooked: false,
        });
    })
    payload = payload + ']';

    const Reqtopic = "Dentist/add_appointment_slots/req";
    const Restopic = "Dentist/add_appointment_slots/res";

    // Publishing to the appointment service and wait for response 
    if(!client.connected) return res.status(500).json({"message": "Internal server error"});
        
    let asyncSub = () => new Promise<void>((resolve) => {
        client.subscribe(Restopic, (err) => {
            if(err !== null) console.log(err);
            resolve()
        })
    })

    let asyncPub = () => new Promise<void>((resolve) => {
        client.publish(Reqtopic, payload, {qos: 1}, (err) => {
            if(err !== null) console.log(err);
            resolve()
        });
    })

    await Promise.all([asyncSub(), asyncPub()]);
    /* 
    TODO: add some sort of timeout method in case Appointment system is not online or 
    it is taking it way to long to respond. 
    */
    const response = await new Promise<any> ((resolve) => {
        client.on('message', (topic, payload, packet) => {
            if(topic === Restopic) {
                console.log(`topic: ${topic} , payload: ${payload}, packet: ${packet}`)
                let response = JSON.parse(payload.toString());
                resolve(response)
            }
        });
    }); 

    return res.status(response.status).json({"message": response.message})
}));

// PUT Requests
router.put('/:id', [validateObjectId, authDentist], asyncwrapper( async(req: Request, res: Response) => {

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
router.delete('/:id', [validateObjectId], asyncwrapper( async(req: Request, res: Response) => {
    let dentist = await Dentist.findByIdAndDelete(req.params.id).select('email firstname lastname phone_number');

    if(!dentist) return res.status(404).json({"message": "Dentist with givne id was not found"});

    return res.status(200).json(dentist);
}));

router.delete('/:id/appointment_slots/:appointment_id', [validateObjectId, authDentist],asyncwrapper(async(req:Request, res:Response) => {
    // TODO: Implement the cancellation of an appointment here
}));

// Exporting the router object
export default router;