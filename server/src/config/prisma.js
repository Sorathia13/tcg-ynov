// Client Prisma en singleton (évite d'ouvrir plusieurs pools de connexions).
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();
