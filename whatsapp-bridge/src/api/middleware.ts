import type { Request, Response, NextFunction } from 'express'
import { config } from '../config.js'
import pino from 'pino'

const logger = pino({ level: config.LOG_LEVEL })

/**
 * Middleware de autenticação: valida X-WhatsApp-Bridge-Secret header.
 * Usado para proteger endpoints chamados pela API C#.
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const secret = req.headers['x-whatsapp-bridge-secret']

  if (!config.BRIDGE_SECRET) {
    logger.error('BRIDGE_SECRET não configurado! Rejeitando todas as requests.')
    res.status(503).json({ error: 'Bridge não configurado' })
    return
  }

  if (!secret || secret !== config.BRIDGE_SECRET) {
    logger.warn({ ip: req.ip }, 'Request rejeitada: secret inválido')
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  next()
}
