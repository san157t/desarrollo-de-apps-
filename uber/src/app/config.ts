/** IP del servidor backend (Laravel). Es lo único que hay que cambiar si el servidor se mueve. */
export const API_HOST = '20.20.1.51';

/** URL base de la API Laravel. */
export const API_URL = `http://${API_HOST}:8000/api`;

/** Ubicación de respaldo si el navegador no entrega GPS (Bogotá, como en la documentación). */
export const DEFAULT_CENTER = { lat: 4.6766, lng: -74.0483 };

const money = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
export const cop = (n: unknown) => money.format(Number(n) || 0);

export const num = (v: unknown): number => (v === null || v === undefined || v === '' ? NaN : Number(v));

export const STATUS: Record<string, string> = {
  requested: 'Buscando conductor',
  assigned: 'Conductor asignado',
  driver_arrived: 'Conductor en el punto',
  in_progress: 'En curso',
  completed: 'Completado',
  cancelled: 'Cancelado',
};

export const tone = (s: string) => (s === 'completed' ? 'green' : s === 'cancelled' ? 'red' : 'blue');

export const list = (x: any): any[] => (Array.isArray(x) ? x : x?.data ?? []);

export function when(iso?: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

export function errMsg(e: any): string {
  const b = e?.error;
  if (b?.errors) {
    const first = Object.values(b.errors)[0] as any;
    return Array.isArray(first) ? first[0] : String(first);
  }
  if (b?.message) return b.message;
  if (e?.status === 0) return `No se pudo conectar con el servidor (${API_HOST}). Revisa que el backend esté encendido y que estés en la misma red.`;
  return 'Ocurrió un error inesperado. Intenta de nuevo.';
}
