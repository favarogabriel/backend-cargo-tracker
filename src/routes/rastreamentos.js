import express from 'express';

export default function rastreamentosRouter(pool) {
  const router = express.Router();

  // Generate a new tracking code (9 digits) formatted as 000 000 000
  router.post('/gerar', async (req, res) => {
    if (!pool) return res.status(503).json({ error: 'DB not configured' });
    try {
      let raw;
      // ensure uniqueness in DB
      for (let i = 0; i < 5; i++) {
        raw = String(Math.floor(Math.random() * 1_000_000_000)).padStart(9, '0');
        const { rows } = await pool.query('select 1 from shipments where codigo=$1 limit 1', [raw]);
        if (rows.length === 0) break;
        raw = undefined;
      }
      if (!raw) return res.status(500).json({ error: 'Falha ao gerar código único' });
      const formatted = raw.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3');
      res.json({ codigo: raw, codigoFormatado: formatted });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Create or update shipment from manual page (produto removed)
  router.post('/manual', async (req, res) => {
    const required = ['nome','email','telefone','rua','numero','bairro','cep','codigo'];
    for (const k of required) {
      if (!String(req.body?.[k] ?? '').trim()) {
        return res.status(400).json({ error: `Campo obrigatório ausente: ${k}` });
      }
    }

    if (!pool) return res.status(503).json({ error: 'DB not configured' });

    try {
      const { nome, email, telefone, rua, numero, bairro, cep } = req.body;
      // código pode vir formatado com espaços
      let codigo = String(req.body.codigo).replace(/\s+/g,'');
      if (!/^\d{9}$/.test(codigo)) {
        return res.status(400).json({ error: 'Código deve conter 9 dígitos' });
      }
      const produto = '';
      const { rows } = await pool.query(
        `insert into shipments (nome,email,telefone,rua,numero,bairro,cep,codigo,produto)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         on conflict (codigo) do update set nome=excluded.nome, email=excluded.email, telefone=excluded.telefone,
           rua=excluded.rua, numero=excluded.numero, bairro=excluded.bairro, cep=excluded.cep, produto=excluded.produto
         returning *`,
        [nome,email,telefone,rua,numero,bairro,cep,codigo,produto]
      );
      res.status(201).json(rows[0]);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // List recent shipments for dashboard table
  router.get('/', async (req, res) => {
    if (!pool) return res.json([]);
    const { rows } = await pool.query(
      `select nome, codigo, email, status, to_char(created_at, 'YYYY-MM-DD HH24:MI:SS') as data
       from shipments order by created_at desc limit 10`
    );
    res.json(rows);
  });

  // Get tracking details for a given code
  router.get('/:codigo', async (req, res) => {
    const codigoRaw = req.params.codigo;
    const codigo = codigoRaw.replace(/\s+/g,'');
    if (!codigo) return res.status(400).json({ error: 'codigo é obrigatório' });

    if (!pool) {
      // Fallback mock shape like frontend expects
      return res.json({
        packageInfo: {
          recipient: 'Cliente',
          origin: 'Origem',
          destination: 'Destino',
          estimatedDelivery: '2025-12-31',
          status: 'Em Trânsito',
        },
        events: []
      });
    }

  const { rows: shipRows } = await pool.query('select * from shipments where codigo=$1', [codigo]);
    if (shipRows.length === 0) return res.status(404).json({ error: 'Código não encontrado' });
    const s = shipRows[0];

  const { rows: etapas } = await pool.query('select dia, titulo, mensagem from etapas order by dia asc');
    // Compute events based on difference in days from created_at
    const created = new Date(s.created_at);
    const now = new Date();
    const diffDays = Math.max(0, Math.floor((now - created) / (1000*60*60*24)));

    const maxDia = etapas.length ? Math.max(...etapas.map(e => e.dia)) : 0;

    // Se já atingiu o último dia e status ainda não é Entregue, atualiza
    if (diffDays >= maxDia && s.status !== 'Entregue') {
      try {
        await pool.query('update shipments set status=$1 where id=$2', ['Entregue', s.id]);
        s.status = 'Entregue';
      } catch (e) {
        // log silencioso; não falha a resposta
        console.warn('Falha ao atualizar status para Entregue', e.message);
      }
    }

    const events = etapas
      .filter(e => e.dia <= diffDays) // apenas etapas já alcançadas
      .map((e, idx) => {
        const date = new Date(created);
        date.setDate(created.getDate() + e.dia);
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth()+1).padStart(2,'0');
        const dd = String(date.getDate()).padStart(2,'0');
        return {
          id: String(idx+1),
          status: e.titulo,
          description: e.mensagem,
          location: `${s.bairro} - ${s.cep}`,
          date: `${dd}/${mm}/${yyyy}`,
          time: '08:00',
          isCompleted: true
        };
      })
      .reverse();

    const packageInfo = {
      recipient: s.nome,
      origin: `${s.rua}, ${s.numero} - ${s.bairro}`,
      destination: s.cep,
      estimatedDelivery: events[0]?.date || '',
      status: s.status,
      delivered: s.status === 'Entregue'
    };

    res.json({ packageInfo, events });
  });

  return router;
}
