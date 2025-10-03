import express from 'express';

export default function etapasRouter(pool) {
  const router = express.Router();

  router.get('/', async (req, res) => {
    if (!pool) return res.json(seedFallback());
    const { rows } = await pool.query('select id, dia, titulo, mensagem from etapas order by dia asc');
    res.json(rows);
  });

  router.post('/', async (req, res) => {
    const etapas = req.body?.etapas;
    if (!Array.isArray(etapas)) return res.status(400).json({ error: 'etapas must be an array' });
    if (!pool) return res.status(503).json({ error: 'DB not configured' });

    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query('delete from etapas');
      for (const e of etapas) {
        if (typeof e.dia !== 'number' || !e.titulo || !e.mensagem) {
          throw new Error('invalid etapa');
        }
        await client.query('insert into etapas (dia, titulo, mensagem) values ($1,$2,$3)', [e.dia, e.titulo, e.mensagem]);
      }
      await client.query('commit');
      res.json({ ok: true });
    } catch (err) {
      await client.query('rollback');
      res.status(400).json({ error: err.message });
    } finally {
      client.release();
    }
  });

  return router;
}

function seedFallback() {
  return [
    { dia: 0, titulo: 'Em preparação', mensagem: 'Recebemos a sua compra no centro de distribuição.' },
    { dia: 1, titulo: 'Em preparação', mensagem: 'Separação dos itens no estoque.' },
    { dia: 2, titulo: 'Em preparação', mensagem: 'Conferência dos itens em andamento.' },
    { dia: 3, titulo: 'Saiu para entrega', mensagem: 'Seu pedido está a caminho!' },
  ];
}
