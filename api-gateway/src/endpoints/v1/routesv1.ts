import { Express } from "express";
import dentistRoutes from "./dentistRoutes";

// All api routes will be added here 
export function routerV1(app: Express) {
    app.use('/api/v1/dentists', dentistRoutes);
}