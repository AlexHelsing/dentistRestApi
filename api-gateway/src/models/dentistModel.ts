import { Schema, Types, Document } from "mongoose";
import mongoose from "mongoose";

interface Dentist extends Document{
    firstname: String,
    lastname: String,
    phone_number: Number,
    email: String,
    password: String,
    location: {
        lat: Number,
        lng: Number
    },
    DOB: Date

}

const dentistSchema = new Schema<Dentist>({
    _id: {type: Types.ObjectId, auto: true},
    firstname: {type: String, required: true, minlength: 1, maxlength: 255},
    lastname: {type: String, required: true, minlength: 1, maxlength: 255},
    phone_number: {type: Number, required: true},
    email: {type: String, required: true, maxlength:255},
    password: {type: String, required: true, minlength:5, maxlength:255},
    location: {
        lat: {type: Number, required: true},
        lng: {type: Number, required: true}
    },
    DOB: {type: Date, required: true}
});

export const Dentist = mongoose.model<Dentist>('Dentist', dentistSchema);