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

async function runCommand(command, args, options, logPrefix) {
  return new Promise((resolve, reject) => {
    logger.info(`${logPrefix}: Executing ${command} ${args.join(' ')}`);
    const proc = spawn(command, args, options);
    let output = '';

    proc.stdout.on('data', (data) => {
      output += data.toString();
    });
    proc.stderr.on('data', (data) => {
      output += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(output);
      } else {
        const error = new Error(`Command failed with code ${code}`);
        error.output = output;
        reject(error);
      }
    });
  });
}

async function triggerBuild(repoCfg, tag) {
  const repoName = getRepoDisplayName(repoCfg);
  const authUrl = getAuthRepoUrl(repoCfg.url, repoCfg.token);
  const buildDir = path.join(workDirBase, repoName, tag);

  db.prepare(
    'UPDATE tags SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE repo = ? AND tag = ?'
  ).run('building', repoName, tag);

  try {
    if (!fs.existsSync(path.dirname(buildDir)))
      fs.mkdirSync(path.dirname(buildDir), { recursive: true });

    // Shallow Clone
    if (!fs.existsSync(path.join(buildDir, '.git'))) {
      logger.info({ repo: repoName, tag }, 'Shallow cloning tag');
      await git.clone(authUrl, buildDir, ['--depth', '1', '--branch', tag]);
    } else {
      const localGit = simpleGit(buildDir);
      await localGit.fetch(['--depth', '1', 'origin', tag]);
      await localGit.checkout(tag);
    }

    let debFile = '', rpmFile = '', dockerImage = '';

    // 1. Package Build Phase
    if (repoCfg.build_script && repoCfg.nfpm_config) {
      const buildScriptRelPath = repoCfg.build_script;
      const nfpmRelPath = repoCfg.nfpm_config;
      const buildScriptPath = path.join(buildDir, buildScriptRelPath);
      const nfpmPath = path.join(buildDir, nfpmRelPath);

      // Versioning
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

      await runCommand('bash', [buildScriptRelPath], { cwd: buildDir }, `[${repoName} package]`);

      const distDir = path.join(buildDir, 'dist');
      const buildsDest = path.join(__dirname, '../../builds', repoName, tag);
      if (!fs.existsSync(buildsDest)) fs.mkdirSync(buildsDest, { recursive: true });

      const files = fs.readdirSync(distDir);
      files.forEach((file) => {
        const extension = path.extname(file);
        const newFileName = `${repoName}-${tag}${extension}`;
        const destPath = path.join(buildsDest, newFileName);
        fs.copyFileSync(path.join(distDir, file), destPath);

        if (extension === '.deb') debFile = `/builds/${repoName}/${tag}/${newFileName}`;
        if (extension === '.rpm') rpmFile = `/builds/${repoName}/${tag}/${newFileName}`;
      });
    }

    // 2. Docker Build Phase
    if (repoCfg.docker) {
      const d = repoCfg.docker;
      const cleanTag = tag.replace(/^v/, '');
      const registry = d.registry || 'docker.io';
      const fullImage = `${d.image}:${cleanTag}`;
      
      // Docker Login
      if (d.username && d.password) {
        logger.info({ repo: repoName, registry }, 'Logging into Docker registry');
        const loginProc = spawn('docker', ['login', '--username', d.username, '--password-stdin', registry]);
        loginProc.stdin.write(d.password);
        loginProc.stdin.end();
        
        await new Promise((resolve, reject) => {
          loginProc.on('close', (code) => code === 0 ? resolve() : reject(new Error(`Docker login failed with code ${code}`)));
        });
      }

      if (d.strategy === 'script' && d.script) {
        await runCommand('bash', [d.script], { 
          cwd: buildDir,
          env: { 
            ...process.env, 
            DOCKER_USER: d.username, 
            DOCKER_PASSWORD: d.password, 
            DOCKER_REGISTRY: registry,
            IMAGE_NAME: d.image,
            TAG: cleanTag 
          } 
        }, `[${repoName} docker-script]`);
      } else {
        const dockerfile = d.dockerfile || 'Dockerfile';
        const context = d.context || '.';
        await runCommand('docker', ['build', '-t', fullImage, '-f', dockerfile, context], { cwd: buildDir }, `[${repoName} docker-build]`);
        await runCommand('docker', ['push', fullImage], { cwd: buildDir }, `[${repoName} docker-push]`);
      }
      dockerImage = fullImage;
    }

    db.prepare(
      'UPDATE tags SET status = ?, deb_path = ?, rpm_path = ?, docker_image = ?, updated_at = CURRENT_TIMESTAMP WHERE repo = ? AND tag = ?'
    ).run('success', debFile, rpmFile, dockerImage, repoName, tag);
    logger.info({ repo: repoName, tag }, 'Build successful');

  } catch (err) {
    logger.error({ repo: repoName, tag, err: err.message, output: err.output }, 'Build failed');
    db.prepare(
      'UPDATE tags SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE repo = ? AND tag = ?'
    ).run('failed', repoName, tag);
  }
}

module.exports = { checkTags, triggerBuild };
