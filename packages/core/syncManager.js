'use strict';

const { execSync } = require('child_process');
const { isGitRepo } = require('./git');

function log(msg) {
  console.log(`[sync] ${msg}`);
}

function execGit(cmd, vaultPath) {
  return execSync(`git ${cmd}`, {
    cwd: vaultPath,
    timeout: 60000,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe']
  }).toString().trim();
}

function hasRemote(vaultPath) {
  if (!isGitRepo(vaultPath)) return false;
  try {
    const list = execGit('remote', vaultPath);
    return list.split('\\n').filter(Boolean).length > 0;
  } catch (e) { return false; }
}

function getSyncStatus(vaultPath) {
  if (!hasRemote(vaultPath)) {
    return { enabled: false, reason: 'No remote configured' };
  }
  try {
    execGit('fetch', vaultPath);
    const status = execGit('status -sb', vaultPath);
    return { enabled: true, status };
  } catch(e) {
    return { enabled: true, error: e.message };
  }
}

function pull(vaultPath) {
  if (!hasRemote(vaultPath)) return { success: true, skipped: true };
  log('Iniciando pull...');
  try {
    const out = execGit('pull --rebase', vaultPath);
    log('Pull concluído sem conflitos.');
    return { success: true, skipped: false, output: out };
  } catch (err) {
    const stderr = err.stderr ? err.stderr.toString() : '';
    log(`Erro no pull: ${err.message} ${stderr}`);
    return { success: false, error: err.message, stderr };
  }
}

function push(vaultPath) {
  if (!hasRemote(vaultPath)) return { success: true, skipped: true };
  log('Iniciando push...');
  try {
    // First, commit any uncommitted changes just in case
    // Though zelador.js phases should have committed everything.
    try {
      execGit('add -A', vaultPath);
      execGit('commit -m "zelador: sync push"', vaultPath);
    } catch(e) {
      // Ignore if nothing to commit
    }

    const currentBranch = execGit('rev-parse --abbrev-ref HEAD', vaultPath);
    execGit(`push -u origin ${currentBranch}`, vaultPath);
    log(`Push concluído para origin/${currentBranch}.`);
    return { success: true, skipped: false };
  } catch (err) {
    const stderr = err.stderr ? err.stderr.toString() : '';
    log(`Erro no push: ${err.message} ${stderr}`);
    return { success: false, error: err.message, stderr };
  }
}

module.exports = {
  getSyncStatus,
  pull,
  push
};
