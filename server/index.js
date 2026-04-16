require('dotenv').config();
const express = require('express');
const Database = require('better-sqlite3');
const simpleGit = require('simple-git');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const yaml = require('js-yaml');

const app = express();
const port = process.env.PORT || 3001;
const dbPath = process.env.DATABASE_URL || path.join(__dirname, '../data/builder.db');

// Ensure data directory exists
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);

// Configuration
const POLLING_INTERVAL = parseInt(process.env.POLLING_INTERVAL || '60000');
const CONFIG_PATH = path.join(__dirname, '../config.yaml');

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const fileContents = fs.readFileSync(CONFIG_PATH, 'utf8');
      const data = yaml.load(fileContents);
      return data.repositories || [];
    }
  } catch (e) {
    console.error('Error loading config.yaml:', e.message);
  }
  return [];
}

// Extract Repo Name helper
const getRepoDisplayName = (repoCfg) => {
  if (repoCfg.name) return repoCfg.name;
  try {
    const urlPath = new URL(repoCfg.url).pathname;
    return path.basename(urlPath, '.git');
  } catch (e) {
    return 'unknown-repo';
  }
};

const getAuthRepoUrl = (repoUrl, token) => {
  try {
    const url = new URL(repoUrl);
    return `${url.protocol}//oauth2:${token}@${url.host}${url.pathname}`;
  } catch (e) {
    const cleanUrl = repoUrl.replace('https://', '');
    return `https://oauth2:${token}@${cleanUrl}`;
  }
};

// Initialize DB with multi-repo support
db.exec(`
  CREATE TABLE IF NOT EXISTS tags (
    repo TEXT,
    tag TEXT,
    status TEXT,
    deb_path TEXT,
    rpm_path TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (repo, tag)
  );
`);

app.use(cors());
app.use(express.json());
app.use('/builds', express.static(path.join(__dirname, '../builds')));
app.use(express.static(path.join(__dirname, '../public')));

const git = simpleGit();
const workDirBase = path.join(__dirname, '../workdir');

async function checkTags() {
  const repos = loadConfig();
  console.log(`Checking for new tags in ${repos.length} repositories...`);

  for (const repoCfg of repos) {
    const repoName = getRepoDisplayName(repoCfg);
    const authUrl = getAuthRepoUrl(repoCfg.url, repoCfg.token);
    
    try {
      const remoteTags = await git.listRemote(['--tags', authUrl]);
      const tags = remoteTags.split('\n')
        .filter(line => line.includes('refs/tags/'))
        .map(line => line.split('refs/tags/')[1].replace('^{}', ''))
        .filter((v, i, a) => a.indexOf(v) === i && v.trim() !== '');

      for (const tag of tags) {
        const exists = db.prepare('SELECT tag FROM tags WHERE repo = ? AND tag = ?').get(repoName, tag);
        if (!exists) {
          console.log(`[${repoName}] New tag found: ${tag}`);
          db.prepare('INSERT INTO tags (repo, tag, status) VALUES (?, ?, ?)')
            .run(repoName, tag, 'pending');
          triggerBuild(repoCfg, tag);
        }
      }
    } catch (err) {
      console.error(`[${repoName}] Git list-remote error:`, err.message);
    }
  }
}

async function triggerBuild(repoCfg, tag) {
  const repoName = getRepoDisplayName(repoCfg);
  const authUrl = getAuthRepoUrl(repoCfg.url, repoCfg.token);
  const buildDir = path.join(workDirBase, repoName, tag);
  const buildScriptRelPath = repoCfg.build_script || 'script/build_packages.sh';
  
  db.prepare('UPDATE tags SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE repo = ? AND tag = ?')
    .run('building', repoName, tag);

  try {
    if (!fs.existsSync(path.dirname(buildDir))) fs.mkdirSync(path.dirname(buildDir), { recursive: true });
    
    // Use Shallow Clone for performance and production use
    if (!fs.existsSync(path.join(buildDir, '.git'))) {
      console.log(`[${repoName}] Shallow cloning tag ${tag}...`);
      await git.clone(authUrl, buildDir, ['--depth', '1', '--branch', tag]);
    } else {
      const localGit = simpleGit(buildDir);
      await localGit.fetch(['--depth', '1', 'origin', tag]);
      await localGit.checkout(tag);
    }

    // Dynamic versioning
    const buildScriptPath = path.join(buildDir, buildScriptRelPath);
    const nfpmPath = path.join(buildDir, 'packaging/nfpm.yaml');

    if (fs.existsSync(buildScriptPath)) {
      let content = fs.readFileSync(buildScriptPath, 'utf8');
      content = content.replace(/VERSION=".*"/, `VERSION="${tag.replace(/^v/, '')}"`);
      fs.writeFileSync(buildScriptPath, content);
    }

    if (fs.existsSync(nfpmPath)) {
      let content = fs.readFileSync(nfpmPath, 'utf8');
      content = content.replace(/version: ".*"/, `version: "${tag.replace(/^v/, '')}"`);
      fs.writeFileSync(nfpmPath, content);
    }

    console.log(`[${repoName}] Executing build script (${buildScriptRelPath}) for ${tag}...`);
    const buildProc = spawn('bash', [buildScriptRelPath], { cwd: buildDir });
    
    buildProc.on('close', (code) => {
      if (code === 0) {
        const distDir = path.join(buildDir, 'dist');
        const buildsDest = path.join(__dirname, '../builds', repoName, tag);
        if (!fs.existsSync(buildsDest)) fs.mkdirSync(buildsDest, { recursive: true });

        const files = fs.readdirSync(distDir);
        let debFile = '', rpmFile = '';
        files.forEach(file => {
          const extension = path.extname(file);
          const newFileName = `${repoName}-${tag}${extension}`;
          const destPath = path.join(buildsDest, newFileName);
          
          fs.copyFileSync(path.join(distDir, file), destPath);
          
          if (extension === '.deb') debFile = `/builds/${repoName}/${tag}/${newFileName}`;
          if (extension === '.rpm') rpmFile = `/builds/${repoName}/${tag}/${newFileName}`;
        });

        db.prepare('UPDATE tags SET status = ?, deb_path = ?, rpm_path = ?, updated_at = CURRENT_TIMESTAMP WHERE repo = ? AND tag = ?')
          .run('success', debFile, rpmFile, repoName, tag);
      } else {
        db.prepare('UPDATE tags SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE repo = ? AND tag = ?')
          .run('failed', repoName, tag);
        console.error(`[${repoName}] Build failed for ${tag} (exit code: ${code})`);
      }
    });

  } catch (err) {
    console.error(`[${repoName}] Runtime error for ${tag}:`, err.message);
    db.prepare('UPDATE tags SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE repo = ? AND tag = ?')
      .run('failed', repoName, tag);
  }
}

// Routes
app.get('/api/tags', (req, res) => res.json(db.prepare('SELECT * FROM tags ORDER BY updated_at DESC').all()));

app.post('/api/build/:repo/:tag', (req, res) => {
  const { repo, tag } = req.params;
  const repos = loadConfig();
  const repoCfg = repos.find(r => getRepoDisplayName(r) === repo);
  
  if (!repoCfg) return res.status(404).json({ error: 'Repo not found' });

  db.prepare('UPDATE tags SET status = ? WHERE repo = ? AND tag = ?').run('pending', repo, tag);
  triggerBuild(repoCfg, tag);
  res.json({ ok: true });
});

// Fallback for SPA (Catch-all middleware)
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

setInterval(checkTags, POLLING_INTERVAL);
checkTags();

app.listen(port, () => console.log(`Package Builder Backend active on port ${port}`));
