// Logique métier d'authentification (register / login).
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma.js';
import { config } from '../config/env.js';
import { ApiError } from '../middleware/errorHandler.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function signToken(user) {
  return jwt.sign(
    { sub: user.id, pseudo: user.pseudo, email: user.email },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn },
  );
}

// Ne jamais renvoyer le hash du mot de passe au client.
function publicUser(user) {
  return { id: user.id, pseudo: user.pseudo, email: user.email, createdAt: user.createdAt };
}

export async function register({ pseudo, email, password }) {
  if (!pseudo || !email || !password) {
    throw new ApiError(400, 'pseudo, email et password sont requis');
  }
  if (!EMAIL_RE.test(email)) throw new ApiError(400, 'Email invalide');
  if (password.length < 6) throw new ApiError(400, 'Mot de passe trop court (min. 6 caractères)');

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new ApiError(409, 'Un compte existe déjà avec cet email');

  const hash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({ data: { pseudo, email, password: hash } });

  return { user: publicUser(user), token: signToken(user) };
}

export async function login({ email, password }) {
  if (!email || !password) throw new ApiError(400, 'email et password sont requis');

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new ApiError(401, 'Identifiants invalides');

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) throw new ApiError(401, 'Identifiants invalides');

  return { user: publicUser(user), token: signToken(user) };
}

export async function me(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new ApiError(404, 'Utilisateur introuvable');
  return publicUser(user);
}
