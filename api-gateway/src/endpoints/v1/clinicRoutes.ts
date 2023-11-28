import expresss from 'express';
import { Request, Response } from "express";
import validateObjectId from '../../middlewares/validObjectId'
import asyncwrapper from "../../middlewares/asyncwrapper";
import { Clinic } from '../../models/clinicModel';
import bcrypt from 'bcrypt';
import { Dentist, validateRegistration } from '../../models/dentistModel';
import authAdmin from '../../middlewares/adminAuth';
import { handleMqtt, client } from '../../mqttConnection';
import authDentist from '../../middlewares/dentistAuth';

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

    if(!client.connected) return res.status(500).json({"message":"Internal server error."});

    let { name, dentists } = clinic;

    let response = await handleMqtt(`Clinic/get_appointments/req`, `Clinic/${name}/get_appointments/res`, dentists);
    // Response format: [...appointment Objects, {"status": 200, "message": "some details"}]

    let { status,message } = response.pop();

    return res.status(status).json(response);
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
    // check if dentist with similar email previously exists on the systems.
    let oldDentist = await Dentist.findOne({email: newDentist.email});
    
    if(exists || oldDentist) return res.status(409).json({"message": "Dentist with given email is already registered in the clinic."});

    await newDentist.hashPassword();
    newDentist = await newDentist.save();

    clinic.dentists.push(newDentist._id);
    await clinic.save()

    return res.status(201).json({"message": "Dentist was added to the clinic successfuly"});
}));

router.post('/:id/dentists/:dentist_id/appointment_slots', [validateObjectId, authDentist],asyncwrapper( async(req: Request, res: Response) => {
    let clinic = await Clinic.findById(req.params.id).select('-admin').populate('dentists');
    if(!clinic) return res.status(404).json({"message": "Clinic with given id was not found."});

    let dentist = clinic.dentists.find((dentist) => { 
        return dentist._id.toHexString() === req.params.dentist_id;
    })
    if(!dentist) return res.status(404).json({"message": "Dentist with given id was not found."});

    if(!client.connected) return res.status(500).json({"message": "Internal server error"});

    const appointments = req.body.map((appointment: any) => ({
        ...appointment,
        dentist_id: dentist?._id,
        patient_id: null,
        isBooked: false,
    }));
    
    let response = await handleMqtt(`Clinic/post_slots/req`,`Clinic/${clinic.name}/post_slots/res`, appointments);

    return res.status(response.status).json({"message": response.message});
}));

// DELETE
router.delete('/:id/dentists/:dentist_id', [validateObjectId, authAdmin], asyncwrapper(async(req: Request, res: Response) => {
    let clinic = await Clinic.findById(req.params.id);
    if(!clinic) return res.status(404).json({"message": "Clinic with given id was not found."});

    let dentistIndex = -1

    clinic.dentists.forEach((doc: Dentist, index) => {
        if(doc._id.toHexString() === req.params.dentist_id) {
            dentistIndex = index;
            return;
        }
    })

    if(dentistIndex === -1) return res.status(404).json({"message": "Dentist with given id is not registered in the clinic."})
    
    let dentist = clinic.dentists[dentistIndex];

    let response = await handleMqtt(`Clinic/delete_dentist/req`, `Clinic/${clinic.name}/delete_dentist/res`, {dentist_id: dentist._id})
    
    if(response.status === 200) {
        await Dentist.findByIdAndDelete(dentist._id);
        clinic.dentists.splice(dentistIndex, 1);
        await clinic.save();
        
        return res.status(200).json({"message": "Dentist was removed from the the clinic alongside all of the appointments"})
    }
    
    res.status(response.status).json({"message": response.message});
}));

// exporting router
export default router;