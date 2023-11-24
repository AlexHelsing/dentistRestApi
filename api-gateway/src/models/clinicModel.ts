import { Schema, Types, Document } from "mongoose";
import mongoose from "mongoose";
import { Dentist } from "./dentistModel";

interface Admin extends Document {
    username: String,
    password: String
}

const adminSchema = new Schema<Admin>({
    username: {type: String, minlength: 3, maxlength: 255, required: true},
    password: {type: String, minlength: 5, maxlength: 255, required: true}
})

interface Clinic extends Document {
    name: String,
    dentists: Types.Array<typeof Dentist>,
    coordinates: {
        lat: Number,
        lng: Number
    },
    admin: Admin
}

const clinicSchema = new Schema<Clinic>({
    _id: {type: Types.ObjectId, auto: true},
    name: {type: String, required: true, minlength: 3, maxlength: 255},
    dentists: [ {type: Types.ObjectId, ref: 'Dentist'} ],
    coordinates:
    {
        lat: {type: Number, required: true},
        lng: {type: Number, required: true}
    },
    admin: {type: adminSchema, required: true}
});

export const Clinic = mongoose.model<Clinic>('Clinic', clinicSchema);
