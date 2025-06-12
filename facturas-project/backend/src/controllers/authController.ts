import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import prisma from "../prisma/client";
import { OAuth2Client } from "google-auth-library";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const generateToken = (userId: number) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET!, { expiresIn: "7d" });
};

export const register = async (req: Request, res: Response) => {
  const { email, name, password } = req.body;

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    res.status(409).json({ message: "Email ya registrado" });
    return;
  }

  const user = await prisma.user.create({ data: { email, name, password } });
  const token = generateToken(user.id);
  res.json({ token, user });
};

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.password !== password) {
    res.status(401).json({ message: "Credenciales incorrectas" });
    return;
  }

  const token = generateToken(user.id);
  res.json({ token, user });
};

export const loginWithGoogle = async (req: Request, res: Response) => {
  const { idToken } = req.body;

  const ticket = await client.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();
  if (!payload?.email) {
    res.status(400).json({ message: "Token no válido" });
    return;
  }

  let user = await prisma.user.findUnique({ where: { email: payload.email } });

  if (!user) {
    user = await prisma.user.create({
      data: { email: payload.email, name: payload.name || "Sin nombre" },
    });
  }

  const token = generateToken(user.id);
  res.json({ token, user });
};
