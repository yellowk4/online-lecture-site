// PrismaClient를 한 번만 만들어 공유 (싱글턴)
import { PrismaClient } from '@prisma/client';
export const prisma = new PrismaClient();