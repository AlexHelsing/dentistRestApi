import mongoose from "mongoose";
import express from "express";
import { Request, Response } from "express";
import { Dentist } from "../../models/dentistModel";

const router = express.Router() 

router.get('/', async(req: Request, res: Response, next) => {
    //TODO
});

router.get('/:id', async(req: Request, res: Response, next) => {
    //TODO
});

router.post('/', async(req: Request, res: Response, next) => {
    //TODO
});

router.put('/:id', async(req: Request, res: Response, next) => {
    //TODO
});

router.delete('/:id', async(req: Request, res: Response) => {
    //TODO
});

