export interface Bank {
  id: string;
  name: string;
  logoUrl: string;
}

export const SUPPORTED_BANKS: Bank[] = [
  // ── Bancos Tradicionais ──
  { id: 'bb', name: 'Banco do Brasil', logoUrl: '/banks/bb.png' },
  { id: 'bradesco', name: 'Bradesco', logoUrl: '/banks/bradesco.png' },
  { id: 'itau', name: 'Itaú', logoUrl: '/banks/itau.png' },
  { id: 'caixa', name: 'Caixa Econômica', logoUrl: '/banks/caixa.png' },
  { id: 'santander', name: 'Santander', logoUrl: '/banks/santander.png' },
  { id: 'safra', name: 'Banco Safra', logoUrl: '/banks/safra.png' },
  { id: 'banrisul', name: 'Banrisul', logoUrl: '/banks/banrisul.png' },
  { id: 'banestes', name: 'Banestes', logoUrl: '/banks/banestes.png' },
  { id: 'brb', name: 'BRB', logoUrl: '/banks/brb.png' },
  { id: 'banese', name: 'Banese', logoUrl: '/banks/banese.png' },

  // ── Bancos Digitais ──
  { id: 'nubank', name: 'Nubank', logoUrl: '/banks/nubank.png' },
  { id: 'inter', name: 'Banco Inter', logoUrl: '/banks/inter.png' },
  { id: 'c6', name: 'C6 Bank', logoUrl: '/banks/c6.png' },
  { id: 'next', name: 'Next', logoUrl: '/banks/next.png' },
  { id: 'neon', name: 'Neon', logoUrl: '/banks/neon.png' },
  { id: 'original', name: 'Banco Original', logoUrl: '/banks/original.png' },
  { id: 'pan', name: 'Banco Pan', logoUrl: '/banks/pan.png' },
  { id: 'bmg', name: 'Banco BMG', logoUrl: '/banks/bmg.png' },
  { id: 'will', name: 'Will Bank', logoUrl: '/banks/will.png' },
  { id: 'digio', name: 'Digio', logoUrl: '/banks/digio.png' },
  { id: 'modalmais', name: 'Modal', logoUrl: '/banks/modalmais.png' },
  { id: 'daycoval', name: 'Daycoval', logoUrl: '/banks/daycoval.png' },
  { id: 'agibank', name: 'Agibank', logoUrl: '/banks/agibank.png' },
  { id: 'sofisa', name: 'Sofisa Direto', logoUrl: '/banks/sofisa.png' },

  // ── Investimentos ──
  { id: 'btg', name: 'BTG Pactual', logoUrl: '/banks/btg.png' },
  { id: 'xp', name: 'XP Investimentos', logoUrl: '/banks/xp.png' },
  { id: 'rico', name: 'Rico', logoUrl: '/banks/rico.png' },
  { id: 'clear', name: 'Clear', logoUrl: '/banks/clear.png' },
  { id: 'genial', name: 'Genial Investimentos', logoUrl: '/banks/genial.png' },
  { id: 'orama', name: 'Órama', logoUrl: '/banks/orama.png' },
  { id: 'toro', name: 'Toro Investimentos', logoUrl: '/banks/toro.png' },
  { id: 'avenue', name: 'Avenue', logoUrl: '/banks/avenue.png' },
  { id: 'warren', name: 'Warren', logoUrl: '/banks/warren.png' },
  { id: 'nomad', name: 'Nomad', logoUrl: '/banks/nomad.png' },
  { id: 'binance', name: 'Binance', logoUrl: '/banks/binance.png' },

  // ── Cooperativas ──
  { id: 'sicredi', name: 'Sicredi', logoUrl: '/banks/sicredi.png' },
  { id: 'sicoob', name: 'Sicoob', logoUrl: '/banks/sicoob.png' },
  { id: 'unicred', name: 'Unicred', logoUrl: '/banks/unicred.png' },
  { id: 'cresol', name: 'Cresol', logoUrl: '/banks/cresol.png' },

  // ── Carteiras Digitais ──
  { id: 'picpay', name: 'PicPay', logoUrl: '/banks/picpay.png' },
  { id: 'mercadopago', name: 'Mercado Pago', logoUrl: '/banks/mercadopago.png' },
  { id: 'pagseguro', name: 'PagBank / PagSeguro', logoUrl: '/banks/pagseguro.png' },
  { id: 'iti', name: 'Iti', logoUrl: '/banks/iti.png' },
  { id: 'recargapay', name: 'RecargaPay', logoUrl: '/banks/recargapay.png' },
  { id: 'stone', name: 'Stone', logoUrl: '/banks/stone.png' },
  { id: 'sumup', name: 'SumUp', logoUrl: '/banks/sumup.png' },

  // ── Benefícios / Vales ──
  { id: 'vr', name: 'VR Benefícios', logoUrl: '/banks/vr.png' },
  { id: 'ticket', name: 'Ticket', logoUrl: '/banks/ticket.png' },
  { id: 'alelo', name: 'Alelo', logoUrl: '/banks/alelo.png' },
  { id: 'sodexo', name: 'Sodexo / Pluxee', logoUrl: '/banks/sodexo.png' },
  { id: 'flash', name: 'Flash', logoUrl: '/banks/flash.png' },
  { id: 'caju', name: 'Caju', logoUrl: '/banks/caju.png' },
  { id: 'swile', name: 'Swile', logoUrl: '/banks/swile.png' },
  { id: 'ifood', name: 'iFood Benefícios', logoUrl: '/banks/ifood.png' },
];

export function getBankById(id?: string | null): Bank | undefined {
  if (!id) return undefined;
  return SUPPORTED_BANKS.find(b => b.id === id);
}
