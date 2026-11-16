/**
 * MODO DEMO — backend simulado dentro de la app.
 *
 * Cuando USE_MOCK = true (src/app/config.ts) este interceptor responde todas las
 * llamadas a API_URL sin salir a la red, imitando la API Laravel:
 *   · auth, cliente, conductor y administrador
 *   · un conductor simulado atiende los viajes del cliente (asignado → llegó → en curso → completado)
 *   · si entras como conductor, aparecen solicitudes de pasajeros simulados
 * Los datos se guardan en localStorage ('mockdb_v1'). Para reiniciarlos, ejecuta en la
 * consola del navegador:  resetDemo()
 */
import { HttpErrorResponse, HttpInterceptorFn, HttpParams, HttpResponse } from '@angular/common/http';
import { delay, mergeMap, of, throwError } from 'rxjs';
import { API_URL, DEFAULT_CENTER, USE_MOCK } from '../config';

/* ----------------------------- Utilidades ----------------------------- */
class ApiError {
  constructor(public status: number, public body: any) {}
}
const fail = (status: number, message: string, extra: object = {}): never => {
  throw new ApiError(status, { message, ...extra });
};
const invalid = (field: string, message: string): never => {
  throw new ApiError(422, { message, errors: { [field]: [message] } });
};

const KEY = 'mockdb_v1';
const iso = (ms: number) => new Date(ms).toISOString();
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const digits = (s: string) => String(s ?? '').replace(/\D/g, '');

function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/* ----------------------------- Datos base ----------------------------- */
interface Place { name: string; lat: number; lng: number; }
const PLACES: Place[] = [
  { name: 'Parque de la 93, Chapinero', lat: 4.6764, lng: -74.0483 },
  { name: 'Centro Andino, Chapinero', lat: 4.6667, lng: -74.0526 },
  { name: 'Zona T, Chapinero', lat: 4.6679, lng: -74.0549 },
  { name: 'Parque de Usaquén', lat: 4.6949, lng: -74.0306 },
  { name: 'Centro Comercial Unicentro', lat: 4.7016, lng: -74.0414 },
  { name: 'Universidad Nacional', lat: 4.6382, lng: -74.084 },
  { name: 'Parque Simón Bolívar', lat: 4.6587, lng: -74.0934 },
  { name: 'Plaza de Bolívar, La Candelaria', lat: 4.5981, lng: -74.076 },
  { name: 'Base de Monserrate', lat: 4.6058, lng: -74.056 },
  { name: 'Terminal de Transporte Salitre', lat: 4.656, lng: -74.117 },
  { name: 'Aeropuerto El Dorado', lat: 4.7016, lng: -74.1469 },
];
const FAKE_CLIENTS = [
  { name: 'María Fernanda López', phone: '3105550101' },
  { name: 'Juan Camilo Torres', phone: '3115550102' },
  { name: 'Diana Rojas', phone: '3125550103' },
  { name: 'Sebastián Moreno', phone: '3135550104' },
  { name: 'Valentina Ruiz', phone: '3145550105' },
];

const T_ASSIGN = 6;   // s: un conductor acepta
const T_ARRIVE = 18;  // s: el conductor llega al punto de recogida
const T_START = 24;   // s: inicia el recorrido
const FINAL = ['completed', 'cancelled'];

/* ----------------------------- Base de datos ----------------------------- */
interface Db {
  seq: number;
  users: any[];
  drivers: any[];
  fares: any[];
  rides: any[];
  incoming: any[];
  ratings: any[];
  driverLoc: Record<string, { lat: number; lng: number }>;
  lastSpawn: number;
}

function seed(): Db {
  const now = Date.now();
  const day = 86400000;
  const db: Db = {
    seq: 100,
    users: [
      { id: 1, name: 'Administrador', email: 'admin@demo.com', phone: '3000000001', password: '123456', role: 'admin' },
      { id: 2, name: 'Cliente Demo', email: 'cliente@demo.com', phone: '3000000002', password: '123456', role: 'client' },
      { id: 3, name: 'Carlos Ramírez', email: 'conductor@demo.com', phone: '3000000003', password: '123456', role: 'driver' },
      { id: 4, name: 'Andrés Pérez', email: 'andres@demo.com', phone: '3000000004', password: '123456', role: 'driver' },
      { id: 5, name: 'Laura Gómez', email: 'laura@demo.com', phone: '3000000005', password: '123456', role: 'driver' },
    ],
    drivers: [
      { id: 1, user_id: 3, license_number: 'LIC-40213', approval_status: 'approved', availability: 'unavailable', rating_average: 4.8,
        vehicle: { brand: 'Chevrolet', model: 'Spark GT', year: 2021, color: 'Blanco', plate: 'TRK123', capacity: 4 } },
      { id: 2, user_id: 4, license_number: 'LIC-51877', approval_status: 'approved', availability: 'unavailable', rating_average: 4.6,
        vehicle: { brand: 'Renault', model: 'Logan', year: 2020, color: 'Gris', plate: 'WXY456', capacity: 4 } },
      { id: 3, user_id: 5, license_number: 'LIC-60932', approval_status: 'pending', availability: 'unavailable', rating_average: 0,
        vehicle: { brand: 'Kia', model: 'Picanto', year: 2022, color: 'Rojo', plate: 'ABC789', capacity: 4 } },
    ],
    fares: [
      { id: 1, name: 'Tarifa estándar', base_fare: 3500, price_per_km: 1500, price_per_minute: 200, minimum_fare: 6500, surge_multiplier: 1, active: true },
      { id: 2, name: 'Hora pico', base_fare: 4500, price_per_km: 1900, price_per_minute: 280, minimum_fare: 7500, surge_multiplier: 1.5, active: false },
    ],
    rides: [], incoming: [], ratings: [], driverLoc: {}, lastSpawn: 0,
  };
  // historial de ejemplo para el cliente demo
  const hist = [
    { o: PLACES[0], d: PLACES[3], fare: 14800, ago: 2, driver: 1 },
    { o: PLACES[5], d: PLACES[7], fare: 11200, ago: 6, driver: 2 },
    { o: PLACES[2], d: PLACES[4], fare: 12600, ago: 9, driver: 1 },
  ];
  hist.forEach((h, i) => {
    const t = now - h.ago * day;
    db.rides.push({
      id: 10 + i, source: 'sim', client_id: 2, driver_id: h.driver, status: 'completed',
      origin_name: h.o.name, origin_latitude: h.o.lat, origin_longitude: h.o.lng,
      destination_name: h.d.name, destination_latitude: h.d.lat, destination_longitude: h.d.lng,
      estimated_distance_km: +(km(h.o, h.d) * 1.3).toFixed(2), estimated_duration_min: 15,
      estimated_fare: h.fare, final_fare: h.fare, created_at: iso(t), completed_at: iso(t + 18 * 60000), t0: t,
    });
  });
  return db;
}

function load(): Db {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Db;
  } catch { /* se regenera abajo */ }
  const db = seed();
  save(db);
  return db;
}
function save(db: Db) {
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* sin almacenamiento */ }
}
(window as any).resetDemo = () => { localStorage.removeItem(KEY); location.reload(); };

/* ----------------------------- Lógica de negocio ----------------------------- */
const pub = (u: any) => ({ id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role });
const userOf = (db: Db, id: number) => db.users.find(u => u.id === id);
const driverOfUser = (db: Db, userId: number) => db.drivers.find(d => d.user_id === userId);
const activeFare = (db: Db) => db.fares.find(f => f.active) ?? db.fares[0];

function price(db: Db, distance: number, minutes: number) {
  const f = activeFare(db);
  const distFare = distance * f.price_per_km;
  const timeFare = minutes * f.price_per_minute;
  const raw = f.base_fare + distFare + timeFare;
  const fare = Math.round((Math.max(f.minimum_fare, raw) * f.surge_multiplier) / 100) * 100;
  return {
    fare,
    breakdown: {
      base_fare: f.base_fare, distance_fare: Math.round(distFare), time_fare: Math.round(timeFare),
      minimum_fare: f.minimum_fare, surge_multiplier: Number(f.surge_multiplier),
    },
  };
}

function estimate(db: Db, b: any) {
  const o = { lat: Number(b.origin_latitude), lng: Number(b.origin_longitude) };
  const d = { lat: Number(b.destination_latitude), lng: Number(b.destination_longitude) };
  if (![o.lat, o.lng, d.lat, d.lng].every(isFinite)) invalid('destination_latitude', 'Faltan las coordenadas del recorrido.');
  const distance = +(km(o, d) * 1.3).toFixed(2);
  const minutes = Math.max(1, Math.round((distance / 25) * 60));
  const p = price(db, distance, minutes);
  return { distance_km: distance, duration_min: minutes, estimated_fare: p.fare, fare_breakdown: p.breakdown };
}

const rideFields = (r: any) => ({
  origin_name: r.origin_name, origin_latitude: r.origin_latitude, origin_longitude: r.origin_longitude,
  destination_name: r.destination_name, destination_latitude: r.destination_latitude, destination_longitude: r.destination_longitude,
});

/* Simulación en el tiempo de los viajes del cliente */
function simStatus(r: any, now: number): string {
  const e = (now - r.t0) / 1000;
  if (e < T_ASSIGN) return 'requested';
  if (e < T_ARRIVE) return 'assigned';
  if (e < T_START) return 'driver_arrived';
  if (e < T_START + r.sim_dur) return 'in_progress';
  return 'completed';
}
function simLoc(r: any, now: number) {
  const e = (now - r.t0) / 1000;
  const o = { lat: r.origin_latitude, lng: r.origin_longitude };
  const d = { lat: r.destination_latitude, lng: r.destination_longitude };
  if (e < T_ARRIVE) {
    const k = clamp((e - T_ASSIGN) / (T_ARRIVE - T_ASSIGN));
    return { lat: lerp(r.drv0.lat, o.lat, k), lng: lerp(r.drv0.lng, o.lng, k) };
  }
  if (e < T_START) return o;
  const k = clamp((e - T_START) / r.sim_dur);
  return { lat: lerp(o.lat, d.lat, k), lng: lerp(o.lng, d.lng, k) };
}

function advance(db: Db, now: number) {
  for (const r of db.rides) {
    if (r.source !== 'sim' || FINAL.includes(r.status) || r.sim_dur === undefined) continue;
    const s = simStatus(r, now);
    if (s === r.status) continue;
    r.status = s;
    if (s !== 'requested' && !r.driver_id) r.driver_id = r.sim_driver_id;
    if (s === 'completed') {
      r.final_fare = r.estimated_fare;
      r.completed_at = iso(now);
    }
  }
  // las solicitudes simuladas para conductores caducan a los 90 s
  db.incoming = db.incoming.filter(i => now - i.t0 < 90000);
}

function tripView(db: Db, r: any, now: number) {
  const dr = db.drivers.find(d => d.id === r.driver_id);
  const du = dr ? userOf(db, dr.user_id) : null;
  const loc = r.source === 'sim' && !FINAL.includes(r.status) ? simLoc(r, now) : null;
  return {
    id: r.id, status: r.status, estimated_fare: r.estimated_fare, final_fare: r.final_fare ?? null,
    estimated_distance_km: r.estimated_distance_km, created_at: r.created_at, completed_at: r.completed_at ?? null,
    ...rideFields(r),
    request: { id: r.id, ...rideFields(r) },
    driver: dr && du ? {
      id: dr.id, rating_average: dr.rating_average,
      user: { id: du.id, name: du.name, phone: du.phone },
      latest_location: loc ? { latitude: loc.lat, longitude: loc.lng } : null,
    } : null,
    vehicle: dr?.vehicle ?? null,
  };
}

function activeRide(db: Db, userId: number) {
  return db.rides.find(r => r.client_id === userId && !FINAL.includes(r.status));
}

function spawnIncoming(db: Db, driverId: number, now: number) {
  const empty = db.incoming.length === 0 && now - db.lastSpawn > 3000;
  const more = db.incoming.length < 3 && now - db.lastSpawn > 12000;
  if (!empty && !more) return;
  const center = db.driverLoc[String(driverId)] ?? DEFAULT_CENTER;
  const near = [...PLACES].sort((a, b) => km(center, a) - km(center, b)).slice(0, 4);
  const o = pick(near);
  const reach = PLACES.filter(p => p !== o && km(o, p) < 16);
  const d = pick(reach.length ? reach : PLACES.filter(p => p !== o));
  const distance = +(km(o, d) * 1.3).toFixed(2);
  const minutes = Math.max(1, Math.round((distance / 25) * 60));
  const c = pick(FAKE_CLIENTS);
  db.incoming.push({
    id: db.seq++, t0: now, estimated_distance_km: distance, estimated_duration_min: minutes,
    estimated_fare: price(db, distance, minutes).fare, client: c,
    origin_name: o.name, origin_latitude: o.lat, origin_longitude: o.lng,
    destination_name: d.name, destination_latitude: d.lat, destination_longitude: d.lng,
  });
  db.lastSpawn = now;
}

const driverView = (db: Db, d: any) => ({
  id: d.id, approval_status: d.approval_status, license_number: d.license_number,
  rating_average: d.rating_average, availability: d.availability,
  user: pub(userOf(db, d.user_id)), vehicles: [d.vehicle],
});

const adminTrip = (db: Db, r: any) => {
  const dr = db.drivers.find(d => d.id === r.driver_id);
  const client = r.client_id ? userOf(db, r.client_id) : { name: r.client_name };
  return {
    id: r.id, status: r.status, created_at: r.created_at, estimated_fare: r.estimated_fare, final_fare: r.final_fare ?? null,
    client: { name: client?.name ?? 'Pasajero' },
    driver: dr ? { id: dr.id, user: { name: userOf(db, dr.user_id)?.name } } : null,
  };
};

/* ----------------------------- Enrutador ----------------------------- */
function authUser(db: Db, header: string | null) {
  const m = /^Bearer mock-(\d+)-/.exec(header ?? '');
  return m ? userOf(db, Number(m[1])) : null;
}

function route(db: Db, method: string, path: string, body: any, params: HttpParams, header: string | null, now: number): any {
  let m: RegExpExecArray | null;

  /* ---------- Auth ---------- */
  if (method === 'POST' && path === '/auth/login') {
    const id = String(body.login ?? '').trim().toLowerCase();
    const u = db.users.find(x => x.email.toLowerCase() === id || (digits(id) && digits(x.phone) === digits(id)));
    if (!u || u.password !== body.password) return fail(401, 'Credenciales incorrectas.');
    return { access_token: `mock-${u.id}-${Math.random().toString(36).slice(2)}`, token_type: 'Bearer', user: pub(u) };
  }

  if (method === 'POST' && path === '/auth/register') {
    const role = body.role === 'driver' ? 'driver' : 'client';
    if (!body.name) invalid('name', 'El nombre es obligatorio.');
    if (!/^\S+@\S+\.\S+$/.test(body.email ?? '')) invalid('email', 'El correo no es válido.');
    if (db.users.some(u => u.email.toLowerCase() === String(body.email).toLowerCase())) invalid('email', 'Este correo ya está registrado.');
    if (digits(body.phone).length < 7) invalid('phone', 'El teléfono no es válido.');
    if (db.users.some(u => digits(u.phone) === digits(body.phone))) invalid('phone', 'Este teléfono ya está registrado.');
    if (String(body.password ?? '').length < 6) invalid('password', 'La contraseña debe tener al menos 6 caracteres.');
    const u = { id: db.seq++, name: body.name, email: String(body.email).trim(), phone: String(body.phone).trim(), password: body.password, role };
    db.users.push(u);
    if (role === 'driver') {
      db.drivers.push({
        id: db.seq++, user_id: u.id, license_number: body.license_number, approval_status: 'pending', availability: 'unavailable', rating_average: 0,
        vehicle: { brand: body.brand, model: body.model, year: body.year, color: body.color, plate: body.plate, capacity: body.capacity },
      });
    }
    return { access_token: `mock-${u.id}-${Math.random().toString(36).slice(2)}`, token_type: 'Bearer', user: pub(u) };
  }

  if (method === 'POST' && path === '/auth/forgot-password') {
    if (String(body.new_password ?? '').length < 6) invalid('new_password', 'La contraseña debe tener al menos 6 caracteres.');
    const u = db.users.find(x => x.email.toLowerCase() === String(body.email ?? '').trim().toLowerCase());
    if (!u) return fail(404, 'No encontramos una cuenta con ese correo.');
    u.password = body.new_password;
    return { message: 'Contraseña restablecida correctamente.' };
  }

  /* ---------- Desde aquí se necesita sesión ---------- */
  const user = authUser(db, header);
  if (!user) return fail(401, 'No autenticado.');
  const need = (role: string) => { if (user.role !== role) fail(403, 'No tienes permiso para esta acción.'); };

  if (method === 'POST' && path === '/auth/logout') return { message: 'Sesión cerrada.' };
  if (method === 'GET' && path === '/fares/active') return { fare: activeFare(db) };

  /* ---------- Cliente ---------- */
  if (path.startsWith('/client')) {
    need('client');

    if (method === 'POST' && path === '/client/estimate-fare') return { estimate: estimate(db, body) };

    if (method === 'POST' && path === '/client/ride-requests') {
      const cur = activeRide(db, user.id);
      if (cur) return fail(400, 'Ya tienes un viaje en curso.', { active_request_id: cur.id });
      const approved = db.drivers.filter(d => d.approval_status === 'approved');
      if (!approved.length) return fail(503, 'No hay conductores aprobados en este momento.');
      const est = estimate(db, body);
      const o = { lat: Number(body.origin_latitude), lng: Number(body.origin_longitude) };
      const ride = {
        id: db.seq++, source: 'sim', client_id: user.id, status: 'requested', t0: now,
        created_at: iso(now), estimated_distance_km: est.distance_km, estimated_duration_min: est.duration_min,
        estimated_fare: est.estimated_fare, ...rideFields(body),
        sim_driver_id: pick(approved).id,
        sim_dur: clamp(Math.round(est.duration_min * 4), 20, 60),
        drv0: { lat: o.lat + 0.006, lng: o.lng - 0.005 },
      };
      db.rides.push(ride);
      return { message: 'Solicitud creada.', ride_request: { id: ride.id, status: 'requested', estimated_fare: ride.estimated_fare, ...rideFields(ride) } };
    }

    if (method === 'GET' && path === '/client/active') {
      const r = activeRide(db, user.id);
      if (!r) return { has_active: false };
      if (r.status === 'requested') {
        return { has_active: true, type: 'request', data: { id: r.id, status: 'requested', estimated_fare: r.estimated_fare, ...rideFields(r) } };
      }
      return { has_active: true, type: 'trip', data: tripView(db, r, now) };
    }

    if (method === 'GET' && path === '/client/trips') {
      const all = db.rides
        .filter(r => r.client_id === user.id && r.driver_id)
        .sort((a, b) => b.t0 - a.t0)
        .map(r => tripView(db, r, now));
      const per = 10, page = Math.max(1, Number(params.get('page') ?? 1));
      return { trips: { data: all.slice((page - 1) * per, page * per), current_page: page, last_page: Math.max(1, Math.ceil(all.length / per)), total: all.length } };
    }

    if ((m = /^\/client\/cancel\/(\d+)$/.exec(path)) && method === 'POST') {
      const r = db.rides.find(x => x.id === Number(m![1]) && x.client_id === user.id);
      if (!r) return fail(404, 'No encontramos el viaje.');
      if (!['requested', 'assigned', 'driver_arrived'].includes(r.status)) return fail(422, 'El viaje ya no se puede cancelar.');
      r.status = 'cancelled';
      r.cancelled_at = iso(now);
      return { message: 'Viaje cancelado.' };
    }

    if ((m = /^\/client\/trips\/(\d+)\/rating$/.exec(path)) && method === 'POST') {
      const r = db.rides.find(x => x.id === Number(m![1]) && x.client_id === user.id);
      if (!r || r.status !== 'completed') return fail(404, 'Solo puedes calificar viajes completados.');
      if (db.ratings.some(x => x.trip_id === r.id)) return fail(422, 'Este viaje ya fue calificado.');
      const score = Number(body.score);
      if (!(score >= 1 && score <= 5)) invalid('score', 'Elige una calificación de 1 a 5.');
      db.ratings.push({ trip_id: r.id, driver_id: r.driver_id, score, comment: body.comment ?? null, has_incident: !!body.has_incident });
      const dr = db.drivers.find(d => d.id === r.driver_id);
      if (dr) {
        const base: number = dr.base_rating ?? (dr.base_rating = Number(dr.rating_average) || 0);
        const mine: number[] = db.ratings.filter(x => x.driver_id === dr.id).map(x => x.score);
        const w = base ? 3 : 0; // la calificación previa pesa como 3 viajes
        dr.rating_average = +((base * w + mine.reduce((a, b) => a + b, 0)) / (w + mine.length)).toFixed(2);
      }
      return { message: 'Calificación registrada.' };
    }
  }

  /* ---------- Conductor ---------- */
  if (path.startsWith('/driver')) {
    need('driver');
    const me = driverOfUser(db, user.id);
    if (!me) return fail(403, 'No tienes un perfil de conductor.');

    if (method === 'PUT' && path === '/driver/availability') {
      if (me.approval_status !== 'approved') {
        return fail(403, me.approval_status === 'pending' ? 'Tu cuenta está en revisión.' : 'Tu cuenta no está habilitada para conducir.', { approval_status: me.approval_status });
      }
      me.availability = body.status === 'available' ? 'available' : 'unavailable';
      if (me.availability === 'unavailable') db.incoming = [];
      return { message: 'Disponibilidad actualizada.', status: me.availability };
    }

    if (method === 'POST' && path === '/driver/location') {
      const lat = Number(body.latitude), lng = Number(body.longitude);
      if (isFinite(lat) && isFinite(lng)) db.driverLoc[String(me.id)] = { lat, lng };
      return { message: 'Ubicación registrada.' };
    }

    if (method === 'GET' && path === '/driver/ride-requests') {
      if (me.approval_status !== 'approved') return fail(403, 'Tu cuenta no está habilitada para recibir solicitudes.', { approval_status: me.approval_status });
      if (me.availability === 'available') spawnIncoming(db, me.id, now);
      return { requests: me.availability === 'available' ? db.incoming.map(({ t0, ...rest }) => rest) : [] };
    }

    if ((m = /^\/driver\/ride-requests\/(\d+)\/accept$/.exec(path)) && method === 'POST') {
      const i = db.incoming.findIndex(x => x.id === Number(m![1]));
      if (i < 0) return fail(409, 'Esta solicitud ya fue tomada por otro conductor.');
      if (db.rides.some(r => r.driver_id === me.id && r.source === 'driver' && !FINAL.includes(r.status))) return fail(400, 'Ya tienes un viaje en curso.');
      const q = db.incoming.splice(i, 1)[0];
      const ride = {
        id: q.id, source: 'driver', client_id: null, client_name: q.client.name, driver_id: me.id, status: 'assigned',
        t0: now, created_at: iso(now), estimated_distance_km: q.estimated_distance_km, estimated_fare: q.estimated_fare, ...rideFields(q),
      };
      db.rides.push(ride);
      return { message: 'Servicio aceptado.', trip: { id: ride.id, status: 'assigned', estimated_fare: ride.estimated_fare } };
    }

    if ((m = /^\/driver\/trips\/(\d+)\/(arrive|start|complete)$/.exec(path)) && method === 'POST') {
      const r = db.rides.find(x => x.id === Number(m![1]) && x.driver_id === me.id && x.source === 'driver');
      if (!r) return fail(404, 'No encontramos el viaje.');
      const action = m![2];
      if (action === 'arrive') {
        if (r.status !== 'assigned') return fail(422, 'El viaje no está en estado "asignado".');
        r.status = 'driver_arrived';
      } else if (action === 'start') {
        if (r.status !== 'driver_arrived') return fail(422, 'Primero debes llegar al punto de recogida.');
        r.status = 'in_progress';
      } else {
        if (r.status !== 'in_progress') return fail(422, 'El viaje aún no ha iniciado.');
        const distance = Math.max(0.1, Number(body.actual_distance_km) || r.estimated_distance_km);
        const minutes = Math.max(1, Number(body.actual_duration_min) || 1);
        r.final_fare = price(db, distance, minutes).fare;
        r.status = 'completed';
        r.completed_at = iso(now);
      }
      return { message: 'Viaje actualizado.', trip: { id: r.id, status: r.status, final_fare: r.final_fare ?? null } };
    }
  }

  /* ---------- Administrador ---------- */
  if (path.startsWith('/admin')) {
    need('admin');

    if (method === 'GET' && path === '/admin/dashboard') {
      const trips = db.rides.filter(r => r.driver_id);
      return {
        stats: {
          total_clients: db.users.filter(u => u.role === 'client').length,
          total_drivers: db.drivers.length,
          pending_drivers: db.drivers.filter(d => d.approval_status === 'pending').length,
          approved_drivers: db.drivers.filter(d => d.approval_status === 'approved').length,
          active_trips: trips.filter(r => ['assigned', 'driver_arrived', 'in_progress'].includes(r.status)).length,
          completed_trips: trips.filter(r => r.status === 'completed').length,
          cancelled_trips: trips.filter(r => r.status === 'cancelled').length,
          pending_requests: db.rides.filter(r => r.status === 'requested').length,
          total_revenue: trips.filter(r => r.status === 'completed').reduce((s, r) => s + Number(r.final_fare ?? 0), 0),
        },
        recent_trips: [...trips].sort((a, b) => b.t0 - a.t0).slice(0, 6).map(r => adminTrip(db, r)),
      };
    }

    if (method === 'GET' && path === '/admin/drivers') {
      const st = params.get('approval_status');
      return { drivers: db.drivers.filter(d => !st || d.approval_status === st).map(d => driverView(db, d)) };
    }

    if ((m = /^\/admin\/drivers\/(\d+)\/approval$/.exec(path)) && method === 'PATCH') {
      const d = db.drivers.find(x => x.id === Number(m![1]));
      if (!d) return fail(404, 'Conductor no encontrado.');
      if (!['approved', 'rejected', 'suspended', 'pending'].includes(body.approval_status)) invalid('approval_status', 'Estado no válido.');
      d.approval_status = body.approval_status;
      d.admin_notes = body.admin_notes ?? null;
      if (d.approval_status !== 'approved') d.availability = 'unavailable';
      return { message: 'Estado actualizado.', driver: driverView(db, d) };
    }

    if (method === 'GET' && path === '/admin/fares') return { fares: db.fares };

    if (method === 'POST' && path === '/admin/fares') {
      if (!body.name) invalid('name', 'El nombre es obligatorio.');
      for (const k of ['base_fare', 'price_per_km', 'price_per_minute', 'minimum_fare']) {
        if (!(Number(body[k]) >= 0) || body[k] === null || body[k] === '') invalid(k, 'Ingresa un valor válido.');
      }
      if (!(Number(body.surge_multiplier) >= 1)) invalid('surge_multiplier', 'El multiplicador mínimo es 1.');
      const f = {
        id: db.seq++, name: body.name, base_fare: Number(body.base_fare), price_per_km: Number(body.price_per_km),
        price_per_minute: Number(body.price_per_minute), minimum_fare: Number(body.minimum_fare),
        surge_multiplier: Number(body.surge_multiplier), active: !!body.active,
      };
      if (f.active) db.fares.forEach(x => (x.active = false));
      db.fares.unshift(f);
      return { message: 'Tarifa guardada.', fare: f };
    }

    if (method === 'GET' && path === '/admin/trips') {
      const st = params.get('status');
      const rows = db.rides.filter(r => r.driver_id && (!st || r.status === st)).sort((a, b) => b.t0 - a.t0);
      return { trips: { data: rows.map(r => adminTrip(db, r)) } };
    }
  }

  return fail(404, `Ruta no encontrada en el modo demo: ${method} ${path}`);
}

/* ----------------------------- Interceptor ----------------------------- */
export const mockBackendInterceptor: HttpInterceptorFn = (req, next) => {
  if (!USE_MOCK || !req.url.startsWith(API_URL)) return next(req);
  const path = req.url.slice(API_URL.length).split('?')[0];

  return of(null).pipe(
    delay(180 + Math.random() * 280),
    mergeMap(() => {
      const db = load();
      const now = Date.now();
      try {
        advance(db, now);
        const out = route(db, req.method, path, req.body ?? {}, req.params, req.headers.get('Authorization'), now);
        return of(new HttpResponse({ status: 200, body: out, url: req.url }));
      } catch (e) {
        if (e instanceof ApiError) {
          return throwError(() => new HttpErrorResponse({ status: e.status, error: e.body, url: req.url }));
        }
        console.error('[Modo demo] error interno', e);
        return throwError(() => new HttpErrorResponse({ status: 500, error: { message: 'Error interno en el modo demo.' }, url: req.url }));
      } finally {
        save(db);
      }
    }),
  );
};
