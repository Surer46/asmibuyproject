import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { healthRouter } from './routes/health.routes';
import { authRouter } from './routes/auth.routes';
import { catalogoRouter } from './routes/catalogo.routes';
import { inventarioRouter } from './routes/inventario.routes';
import { promocionesRouter } from './routes/promociones.routes';
import { verificarSesion, validarCSRF } from './middlewares/auth.middleware';
import { probarConexionBD } from './config/database';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares estándar
app.use(cors({
  origin: true, // Refleja el origen solicitante (permite localhost y la IP de red local del móvil)
  credentials: true
}));
app.use(express.json());
app.use(cookieParser(process.env.SESSION_SECRET || 'asmibuy-secret-key'));

// Middleware de sesión automática desde cookie
app.use(verificarSesion);

// Protección CSRF en peticiones mutables
app.use(validarCSRF);

// Registro de rutas API v1
app.use('/api/v1', healthRouter);
app.use('/api/v1', authRouter);
app.use('/api/v1', catalogoRouter);
app.use('/api/v1', inventarioRouter);
app.use('/api/v1', promocionesRouter);

// Manejador de rutas no encontradas (404)
app.use('*', (_req, res) => {
  res.status(404).json({
    codigo: 'RECURSO_NO_ENCONTRADO',
    mensaje: 'La ruta solicitada no existe en la API de Asmibuy.',
    detalles: null
  });
});

// Inicio del servidor
app.listen(PORT, async () => {
  console.log('====================================================');
  console.log('🚀 SERVIDOR BACKEND ASMIBUY API v1 INICIADO');
  console.log(`📡 URL Base: http://localhost:${PORT}/api/v1`);
  console.log(`🩺 Endpoint de Salud: http://localhost:${PORT}/api/v1/health`);
  console.log(`🔐 Autenticación: http://localhost:${PORT}/api/v1/auth/login`);
  console.log('====================================================');

  const bd = await probarConexionBD();
  console.log(`🐘 Estado BD: ${bd.detalle}`);
});

export default app;
