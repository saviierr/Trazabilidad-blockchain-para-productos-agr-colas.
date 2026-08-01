import { SetMetadata } from '@nestjs/common';
import { RolNombre } from '@prisma/client';

export const ROLES_KEY = 'roles';

// Matriz de permisos C7: restringe una ruta a uno o más roles.
export const Roles = (...roles: RolNombre[]) => SetMetadata(ROLES_KEY, roles);
