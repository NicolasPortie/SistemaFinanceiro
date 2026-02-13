const bcrypt = require('bcryptjs');
const { Client } = require('pg');

const hash = bcrypt.hashSync('conectairrig@', 11).replace(/^\$2b\$/, '$2a$');
console.log('Hash:', hash);

const c = new Client({ host: 'localhost', port: 5432, database: 'controlfinance', user: 'postgres', password: 'admin' });
c.connect()
  .then(() => c.query('UPDATE usuarios SET senha_hash=$1 WHERE id=5 RETURNING id, nome', [hash]))
  .then(r => { console.log('Updated:', r.rows[0]); c.end(); })
  .catch(e => { console.error(e.message); c.end(); });
