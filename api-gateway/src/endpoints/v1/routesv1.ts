import { Express } from "express";
import dentistRoutes from "./dentistRoutes";
import dentistCurrent from './dentistCurrent'

// All api routes will be added here 
export function routerV1(app: Express) {
    app.use('/api/v1/dentists/current-user', dentistCurrent)
    app.use('/api/v1/dentists', dentistRoutes);
}