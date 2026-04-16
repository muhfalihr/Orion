const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const logger = require('./logger');

const CONFIG_PATH = path.join(__dirname, '../config.yaml');

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const fileContents = fs.readFileSync(CONFIG_PATH, 'utf8');
      const data = yaml.load(fileContents);
      const repos = data.repositories || [];
      
      return repos.filter(repo => {
        if (!repo.url || !repo.token) {
          logger.error({ repo: repo.name || 'unknown' }, 'Missing required config: url or token. Skipping repo.');
          return false;
        }
        return true;
      });
    }
  } catch (e) {
    logger.error({ err: e.message }, 'Error loading config.yaml');
  }
  return [];
}

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

module.exports = {
  loadConfig,
  getRepoDisplayName,
  getAuthRepoUrl,
  POLLING_INTERVAL: parseInt(process.env.POLLING_INTERVAL || '60000'),
};
