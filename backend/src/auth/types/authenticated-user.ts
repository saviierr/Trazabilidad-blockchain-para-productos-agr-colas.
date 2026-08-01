import { RolNombre } from '@prisma/client';

export interface AuthenticatedUser {
  id: string;
  email: string;
  rol: RolNombre;
  organizacionId: string | null;
}
