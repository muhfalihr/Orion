const express = require('express');
const router = express.Router();
const db = require('../db');
const { loadConfig, getRepoDisplayName } = require('../config');
const { triggerBuild } = require('../services/builder.service');

router.get('/tags', (req, res) =>
  res.json(db.prepare('SELECT * FROM tags ORDER BY updated_at DESC').all())
);

router.post('/build/:repo/:tag', (req, res) => {
  const { repo, tag } = req.params;
  const repos = loadConfig();
  const repoCfg = repos.find((r) => getRepoDisplayName(r) === repo);

  if (!repoCfg) return res.status(404).json({ error: 'Repo not found' });

  db.prepare('UPDATE tags SET status = ? WHERE repo = ? AND tag = ?').run('pending', repo, tag);
  triggerBuild(repoCfg, tag);
  res.json({ ok: true });
});

module.exports = router;
