import { Router, Request, Response } from 'express';
import { probarConexionBD } from '../config/database';

export const healthRouter = Router();

/**
 * GET /api/v1/health
 * Endpoint de comprobación del estado del sistema
 */
healthRouter.get('/health', async (_req: Request, res: Response) => {
  const estadoBD = await probarConexionBD();
  const uptimeSegundos = Math.floor(process.uptime());

  res.json({
    estado: 'OPERATIVO',
    servicio: 'Asmibuy API Backend (v2.1)',
    timestampUTC: new Date().toISOString(),
    uptime: `${uptimeSegundos}s`,
    baseDeDatos: estadoBD,
    entorno: process.env.NODE_ENV || 'development'
  });
});
