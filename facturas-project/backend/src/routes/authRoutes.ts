import { Router } from "express";
import { login, register, loginWithGoogle } from "../controllers/authController";

const router = Router();
router.post("/login", login);
router.post("/register", register);
router.post("/google-login", loginWithGoogle);
export default router;
