// Existing Git Credential Manager login only. Credentials stay in memory and are never printed.
const cp = require('child_process');
const owner = 'xiaochaxiaocha9-ux', name = 'plant-field-map';
const mode = process.argv[2] || 'inspect';
async function main() {
  const credential = cp.spawnSync('git', ['credential', 'fill'], { input: `protocol=https\nhost=github.com\nusername=${owner}\n\n`, encoding: 'utf8', timeout: 20000, env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' } });
  if (credential.status !== 0) throw Error('未取得现有GitHub登录，需要重新登录');
  const token = credential.stdout.match(/^password=(.+)$/m)?.[1].trim();
  if (!token) throw Error('缺少GitHub认证');
  const api = async (endpoint, method = 'GET', body) => {
    const response = await fetch('https://api.github.com' + endpoint, { method, headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json', 'User-Agent': 'plant-field-map-publisher' }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(30000) });
    const text = await response.text();
    let data; try { data = JSON.parse(text); } catch { data = {}; }
    if (!response.ok && response.status !== 404) throw Error(`GitHub ${response.status}: ${data.message || 'request failed'}`);
    return { status: response.status, data };
  };
  const user = await api('/user');
  if (user.data.login !== owner) throw Error('现有登录与选定GitHub账号不同');
  const repoPath = `/repos/${owner}/${name}`;
  let repo = await api(repoPath);
  if (mode === 'create') {
    if (repo.status !== 404) throw Error('仓库已存在，先检查，不覆盖');
    repo = await api('/user/repos', 'POST', { name, description: '同质园盆位、每日处理与人工异交配对查看器', private: false, auto_init: false, has_issues: false, has_wiki: false, has_projects: false });
  }
  if (repo.status === 404) { console.log(JSON.stringify({ login: owner, repositoryExists: false })); return; }
  if (mode === 'enable') {
    if (repo.data.private) throw Error('意外的私有仓库，停止发布');
    let pages = await api(repoPath + '/pages');
    if (pages.status === 404) pages = await api(repoPath + '/pages', 'POST', { build_type: 'legacy', source: { branch: 'main', path: '/docs' } });
    else if (pages.data.source?.branch !== 'main' || pages.data.source?.path !== '/docs') throw Error('现有Pages来源不同，停止修改');
    console.log(JSON.stringify({ repository: repo.data.html_url, pages: pages.data.html_url, status: pages.data.status, source: pages.data.source }));
  } else {
    const pages = await api(repoPath + '/pages');
    const build = pages.status === 404 ? null : await api(repoPath + '/pages/builds/latest');
    console.log(JSON.stringify({ login: owner, repository: repo.data.html_url, public: !repo.data.private, branch: repo.data.default_branch, pages: pages.status === 404 ? null : { url: pages.data.html_url, status: pages.data.status, source: pages.data.source }, latestBuild: build?.status === 404 ? null : build && { status: build.data.status, commit: build.data.commit, error: build.data.error, updatedAt: build.data.updated_at } }));
  }
}
main().catch(error => { console.error(error.message); process.exit(1); });
