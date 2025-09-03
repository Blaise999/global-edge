// src/routes/index.js
import express from "express";
import { geocode } from "../controllers/geocodecontroller.js";

const router = express.Router();
router.get("/geocode", geocode);
export default router;
