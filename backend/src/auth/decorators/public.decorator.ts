import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

// Marca una ruta como accesible sin JWT (ej. login, y el QR público en WP-23).
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
