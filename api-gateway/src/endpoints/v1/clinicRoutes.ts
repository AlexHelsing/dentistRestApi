import expresss from 'express';
import { Request, Response } from "express";
import validateObjectId from '../../middlewares/validObjectId'
import asyncwrapper from "../../middlewares/asyncwrapper";

const router = expresss.Router();

// Handlers

// GET 

router.get('/', asyncwrapper( async(req: Request, res: Response) => {
    // TODO
}));

router.get('/:id', asyncwrapper( async(req: Request, res: Response) => {
    // TODO
}));

router.get('/:id/appointment_slots', asyncwrapper( async(req: Request, res: Response) => {
    // TODO
}));

// POST
router.post('/', asyncwrapper( async(req: Request, res: Response) => {
    // TODO : This probably will be deleted since we don't want allow users to make a new dentistry at all
}));

router.post('/login_admin', asyncwrapper( async(req: Request, res: Response) => {
    // TODO
}));

router.post('/:id/dentists', asyncwrapper( async(req: Request, res: Response) => {
    // TODO: for adding new dentists to a clinic
}));

// PUT
router.put('/:id', asyncwrapper( async(req: Request, res: Response) => {
    // TODO: Once clinics are made they can't be modified so this probably will be omitted.
}));

// DELETE
router.delete('/:id/dentists/:dentist_id', asyncwrapper(async(req: Request, res: Response) => {
    // TODO
}));
// exporting router
export default router;
