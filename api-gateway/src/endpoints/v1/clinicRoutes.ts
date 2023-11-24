import expresss from 'express';
import { Request, Response } from "express";
import validateObjectId from '../../middlewares/validObjectId'
import asyncwrapper from "../../middlewares/asyncwrapper";
import { Clinic } from '../../models/clinicModel';
import bcrypt from 'bcrypt';
import { Dentist, validateRegistration } from '../../models/dentistModel';
import authAdmin from '../../middlewares/adminAuth';
import { handleMqtt } from '../../mqttConnection';

const router = expresss.Router();

// Handlers
// GET 

router.get('/', asyncwrapper( async(req: Request, res: Response) => {
    let clinics = await Clinic.find().select('-dentists -admin');
    
    res.status(200).json(clinics);
}));

router.get('/:id', [validateObjectId], asyncwrapper( async(req: Request, res: Response) => {
    let clinic = await Clinic.findById(req.params.id).select('-admin');
    if(!clinic) return res.status(404).json({"message": "Clinic with given id was not found."});
    
    return res.status(200).json(clinic);
}));

// Recieving all the appointment slots of a single clinic
router.get('/:id/appointment_slots', [validateObjectId], asyncwrapper( async(req: Request, res: Response) => {
    let clinic = await Clinic.findById(req.params.id).select('-admin');
    if(!clinic) return res.status(404).json({"message": "Clinic with given id was not found"});

    // TODO: Add MQTT handler
}));

// POST
router.post('/login_admin', asyncwrapper( async(req: Request, res: Response) => {
    
    if(!req.body.username || !req.body.password) return res.status(403).json({"message": "Missing email or password"});

    let clinic = await Clinic.findOne({'admin.username': req.body.username});
    if(!clinic) return res.status(404).json({"message": "Clinic with given admin username was not found"});

    let admin = clinic.admin;
    
    let match = await bcrypt.compare(req.body.password, admin.password.toString());
    if(!match) return res.status(403).json({"message": "Incorrect password"});

    let token = await clinic.signJWT()

    res.status(201).json({"token": token});
}));

router.post('/:id/dentists', [validateObjectId, authAdmin], asyncwrapper( async(req: Request, res: Response) => {
    let clinic = await Clinic.findById(req.params.id).select('-admin').populate('dentists');
    if(!clinic) return res.status(404).json({"message": "clinic with given id was not found"});

    let { error } = validateRegistration(req.body);
    if(error) return res.status(403).json({"message": "Invalid dentist info"})

    let newDentist = new Dentist(req.body)

    let exists = clinic.dentists.some((dentist) => {
        if (newDentist.email === dentist.email) return true;
    })

    if(exists) return res.status(409).json({"message": "Dentist with given email is already registered in the clinic."});

    await newDentist.hashPassword();
    newDentist = await newDentist.save();

    clinic.dentists.push(newDentist._id);

    return res.status(201).json({"message": "Dentist was added to the clinic successfuly"});
}));

// DELETE
router.delete('/:id/dentists/:dentist_id', [validateObjectId, authAdmin], asyncwrapper(async(req: Request, res: Response) => {
    let clinic = await Clinic.findById(req.params.id);
    if(!clinic) return res.status(404).json({"message": "Clinic with given id was not found."});

    let dentistIndex = -1
    let dentist;

    clinic.dentists.forEach((doc, index) => {
        if(doc._id === req.params.dentist_id) {
            dentist = doc;
            dentistIndex = index;
            return;
        }
    })

    if(dentistIndex === -1) return res.status(404).json({"message": "Dentist with given id is not registered in the clinic."})

    // TODO: MQTT Handler for removing all the appointments regarding to the dentists
    
    // Removing the dentist from the dentists of the clinic
    clinic.dentists.splice(dentistIndex, 1);

    return res.status(200).json({"message": "Dentist was removed from the the clinic alongside all of the appointments"})
}));
// exporting router
export default router;
