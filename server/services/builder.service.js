const simpleGit = require('simple-git');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const logger = require('../logger');
const db = require('../db');
const { loadConfig, getRepoDisplayName, getAuthRepoUrl } = require('../config');

const git = simpleGit();
const workDirBase = path.join(__dirname, '../../workdir');

async function checkTags() {
  const repos = loadConfig();
  logger.info({ count: repos.length }, 'Checking for new tags in repositories');

  for (const repoCfg of repos) {
    const repoName = getRepoDisplayName(repoCfg);
    const authUrl = getAuthRepoUrl(repoCfg.url, repoCfg.token);

    try {
      const remoteTags = await git.listRemote(['--tags', authUrl]);
      const tags = remoteTags
        .split('\n')
        .filter((line) => line.includes('refs/tags/'))
        .map((line) => line.split('refs/tags/')[1].replace('^{}', ''))
        .filter((v, i, a) => a.indexOf(v) === i && v.trim() !== '');

      for (const tag of tags) {
        const exists = db
          .prepare('SELECT tag FROM tags WHERE repo = ? AND tag = ?')
          .get(repoName, tag);
        if (!exists) {
          logger.info({ repo: repoName, tag }, 'New tag found');
          db.prepare('INSERT INTO tags (repo, tag, status) VALUES (?, ?, ?)').run(
            repoName,
            tag,
            'pending'
          );
          triggerBuild(repoCfg, tag);
        }
      }
    } catch (err) {
      logger.error({ repo: repoName, err: err.message }, 'Git list-remote error');
    }
  }
}

async function triggerBuild(repoCfg, tag) {
  const repoName = getRepoDisplayName(repoCfg);
  const authUrl = getAuthRepoUrl(repoCfg.url, repoCfg.token);
  const buildDir = path.join(workDirBase, repoName, tag);
  
  if (!repoCfg.build_script) {
    const error = `Missing required config: build_script for repo ${repoName}`;
    logger.error({ repo: repoName, tag }, error);
    db.prepare(
      'UPDATE tags SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE repo = ? AND tag = ?'
    ).run('failed', repoName, tag);
    return;
  }

  if (!repoCfg.nfpm_config) {
    const error = `Missing required config: nfpm_config for repo ${repoName}`;
    logger.error({ repo: repoName, tag }, error);
    db.prepare(
      'UPDATE tags SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE repo = ? AND tag = ?'
    ).run('failed', repoName, tag);
    return;
  }

  const buildScriptRelPath = repoCfg.build_script;
  const nfpmRelPath = repoCfg.nfpm_config;

  db.prepare(
    'UPDATE tags SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE repo = ? AND tag = ?'
  ).run('building', repoName, tag);

  try {
    if (!fs.existsSync(path.dirname(buildDir)))
      fs.mkdirSync(path.dirname(buildDir), { recursive: true });

    // Use Shallow Clone for performance and production use
    if (!fs.existsSync(path.join(buildDir, '.git'))) {
      logger.info({ repo: repoName, tag }, 'Shallow cloning tag');
      await git.clone(authUrl, buildDir, ['--depth', '1', '--branch', tag]);
    } else {
      const localGit = simpleGit(buildDir);
      await localGit.fetch(['--depth', '1', 'origin', tag]);
      await localGit.checkout(tag);
    }

    // Dynamic versioning
    const buildScriptPath = path.join(buildDir, buildScriptRelPath);
    const nfpmPath = path.join(buildDir, nfpmRelPath);

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

    logger.info({ repo: repoName, tag, script: buildScriptRelPath }, 'Executing build script');

    if (!fs.existsSync(buildScriptPath)) {
      throw new Error(`Build script not found at ${buildScriptRelPath}`);
    }

    const buildProc = spawn('bash', [buildScriptRelPath], { cwd: buildDir });

    let output = '';
    buildProc.stdout.on('data', (data) => {
      output += data.toString();
    });
    buildProc.stderr.on('data', (data) => {
      output += data.toString();
    });

    buildProc.on('close', (code) => {
      if (code === 0) {
        const distDir = path.join(buildDir, 'dist');
        const buildsDest = path.join(__dirname, '../../builds', repoName, tag);
        if (!fs.existsSync(buildsDest)) fs.mkdirSync(buildsDest, { recursive: true });

        const files = fs.readdirSync(distDir);
        let debFile = '',
          rpmFile = '';
        files.forEach((file) => {
          const extension = path.extname(file);
          const newFileName = `${repoName}-${tag}${extension}`;
          const destPath = path.join(buildsDest, newFileName);

          fs.copyFileSync(path.join(distDir, file), destPath);

          if (extension === '.deb') debFile = `/builds/${repoName}/${tag}/${newFileName}`;
          if (extension === '.rpm') rpmFile = `/builds/${repoName}/${tag}/${newFileName}`;
        });

        db.prepare(
          'UPDATE tags SET status = ?, deb_path = ?, rpm_path = ?, updated_at = CURRENT_TIMESTAMP WHERE repo = ? AND tag = ?'
        ).run('success', debFile, rpmFile, repoName, tag);
        logger.info({ repo: repoName, tag }, 'Build successful');
      } else {
        db.prepare(
          'UPDATE tags SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE repo = ? AND tag = ?'
        ).run('failed', repoName, tag);
        logger.error({ repo: repoName, tag, code, output: output.trim() }, 'Build failed');
      }
    });
  } catch (err) {
    logger.error({ repo: repoName, tag, err: err.message }, 'Runtime error during build');
    db.prepare(
      'UPDATE tags SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE repo = ? AND tag = ?'
    ).run('failed', repoName, tag);
  }
}

module.exports = { checkTags, triggerBuild };
