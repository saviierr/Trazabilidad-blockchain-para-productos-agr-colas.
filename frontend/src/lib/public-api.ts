import axios from 'axios'

// WP-23 §2.6: cliente sin interceptores de auth. El cliente `api` de
// api.ts redirige a /login ante cualquier 401 — comportamiento correcto
// para el resto de la app, pero incorrecto para una página a la que se
// llega escaneando un QR sin haber iniciado sesión nunca.
export const publicApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000',
})
