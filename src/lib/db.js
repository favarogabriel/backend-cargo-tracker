import pg from 'pg';
const { Pool } = pg;

export async function createPoolAndMigrate() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.warn('DATABASE_URL not set. Backend will start without DB connection.');
  }
  const ssl = process.env.PGSSL === 'false' ? false : { rejectUnauthorized: false };
  const pool = connectionString ? new Pool({ connectionString, ssl }) : null;

  if (pool) {
    await migrate(pool);
  }

  return pool;
}

async function migrate(pool) {
  // Basic tables: shipments, etapas
  await pool.query(`
    create table if not exists etapas (
      id serial primary key,
      dia integer not null,
      titulo text not null,
      mensagem text not null
    );

    create table if not exists shipments (
      id serial primary key,
      nome text not null,
      email text not null,
      telefone text not null,
      rua text not null,
      numero text not null,
      bairro text not null,
      cep text not null,
      codigo text not null unique,
      produto text not null,
      status text not null default 'Em trânsito',
      created_at timestamp not null default now()
    );
  `);

  // Seed default etapas if none
  const { rows } = await pool.query('select count(*)::int as c from etapas');
  if (rows[0].c === 0) {
    const defaults = [
      { dia: 0, titulo: 'Em preparação', mensagem: 'Recebemos a sua compra no centro de distribuição.' },
      { dia: 1, titulo: 'Em preparação', mensagem: 'Separação dos itens no estoque.' },
      { dia: 2, titulo: 'Em preparação', mensagem: 'Conferência dos itens em andamento.' },
      { dia: 3, titulo: 'Saiu para entrega', mensagem: 'Seu pedido está a caminho!' },
    ];
    for (const e of defaults) {
      await pool.query('insert into etapas (dia, titulo, mensagem) values ($1,$2,$3)', [e.dia, e.titulo, e.mensagem]);
    }
  }
}
