const fs = require('fs');
const path = require('path');
const https = require('https');

const banks = [
  // Tradicionais
  { id: 'bb', url: 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://bb.com.br&size=64' },
  { id: 'bradesco', url: 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://banco.bradesco&size=64' },
  { id: 'itau', url: 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://itau.com.br&size=64' },
  { id: 'caixa', url: 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://caixa.gov.br&size=64' },
  { id: 'santander', url: 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://santander.com.br&size=64' },
  { id: 'safra', url: 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://safra.com.br&size=64' },
  { id: 'banrisul', url: 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://banrisul.com.br&size=64' },
  { id: 'banestes', url: 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://banestes.com.br&size=64' },
  { id: 'brb', url: 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://brb.com.br&size=64' },
  { id: 'banese', url: 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://banese.com.br&size=64' },
  // Digitais
  { id: 'nubank', url: 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://nubank.com.br&size=64' },
  { id: 'inter', url: 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://bancointer.com.br&size=64' },
  { id: 'c6', url: 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://c6bank.com.br&size=64' },
  { id: 'next', url: 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://next.b.br&size=64' },
  { id: 'neon', url: 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://neon.com.br&size=64' },
  { id: 'original', url: 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://original.com.br&size=64' },
  { id: 'pan', url: 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://bancopan.com.br&size=64' },
  { id: 'bmg', url: 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://bancobmg.com.br&size=64' },
  { id: 'will', url: 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://willbank.com.br&size=64' },
  { id: 'digio', url: 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://digio.com.br&size=64' },
  { id: 'modalmais', url: 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://modalmais.com.br&size=64' },
  { id: 'daycoval', url: 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://daycoval.com.br&size=64' },
  { id: 'agibank', url: 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://agibank.com.br&size=64' },
  { id: 'sofisa', url: 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://sofisadireto.com.br&size=64' },
  // Investimentos
  { id: 'btg', url: 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://btgpactual.com&size=64' },
  { id: 'xp', url: 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://xpi.com.br&size=64' },
  { id: 'rico', url: 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://rico.com.vc&size=64' },
  { id: 'clear', url: 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://clear.com.br&size=64' },
  { id: 'genial', url: 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://genialinvestimentos.com.br&size=64' },
  { id: 'orama', url: 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://orama.com.br&size=64' },
  { id: 'toro', url: 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://toroinvestimentos.com.br&size=64' },
  { id: 'avenue', url: 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://avenue.us&size=64' },
  { id: 'warren', url: 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://warren.com.br&size=64' },
  { id: 'nomad', url: 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://nomadglobal.com&size=64' },
  { id: 'binance', url: 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://binance.com&size=64' },
  // Cooperativas
  { id: 'sicredi', url: 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://sicredi.com.br&size=64' },
  { id: 'sicoob', url: 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://sicoob.com.br&size=64' },
  { id: 'unicred', url: 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://unicred.com.br&size=64' },
  { id: 'cresol', url: 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://cresol.com.br&size=64' },
  // Carteiras Digitais
  { id: 'picpay', url: 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://picpay.com&size=64' },
  { id: 'mercadopago', url: 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://mercadopago.com.br&size=64' },
  { id: 'pagseguro', url: 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://pagseguro.uol.com.br&size=64' },
  { id: 'iti', url: 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://iti.itau&size=64' },
  { id: 'recargapay', url: 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://recargapay.com.br&size=64' },
  { id: 'stone', url: 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://stone.com.br&size=64' },
  { id: 'sumup', url: 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://sumup.com.br&size=64' },
  // Benefícios
  { id: 'vr', url: 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://vr.com.br&size=64' },
  { id: 'ticket', url: 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://ticket.com.br&size=64' },
  { id: 'alelo', url: 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://alelo.com.br&size=64' },
  { id: 'sodexo', url: 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://sodexobeneficios.com.br&size=64' },
  { id: 'flash', url: 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://flashapp.com.br&size=64' },
  { id: 'caju', url: 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://caju.com.br&size=64' },
  { id: 'swile', url: 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://swile.co&size=64' },
  { id: 'ifood', url: 'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://ifood.com.br&size=64' },
];

const destDir = path.join(__dirname, 'public', 'banks');

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

let completed = 0;
banks.forEach(bank => {
  const destPath = path.join(destDir, `${bank.id}.png`);
  
  // Skip if already downloaded
  if (fs.existsSync(destPath)) {
    completed++;
    console.log(`Skipped ${bank.id}.png (already exists)`);
    if (completed === banks.length) console.log(`\nDone! ${banks.length} banks processed.`);
    return;
  }
  
  https.get(bank.url, (response) => {
    if (response.statusCode === 200) {
      const file = fs.createWriteStream(destPath);
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        completed++;
        console.log(`Downloaded ${bank.id}.png`);
        if (completed === banks.length) console.log(`\nDone! ${banks.length} banks processed.`);
      });
    } else if ([301, 302, 307, 308].includes(response.statusCode)) {
        https.get(response.headers.location, (res) => {
            if (res.statusCode === 200) {
                const file = fs.createWriteStream(destPath);
                res.pipe(file);
                file.on('finish', () => {
                  file.close();
                  completed++;
                  console.log(`Downloaded ${bank.id}.png (redirect)`);
                  if (completed === banks.length) console.log(`\nDone! ${banks.length} banks processed.`);
                });
            } else {
                completed++;
                console.error(`Failed ${bank.id}.png (redirect ${res.statusCode})`);
            }
        }).on('error', (err) => {
            completed++;
            console.error(`Error ${bank.id}.png: ${err.message}`);
        });
    } else {
      completed++;
      console.error(`Failed ${bank.id}.png (status ${response.statusCode})`);
    }
  }).on('error', (err) => {
    completed++;
    console.error(`Error ${bank.id}.png: ${err.message}`);
  });
});
