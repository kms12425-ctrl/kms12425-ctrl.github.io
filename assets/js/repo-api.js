// repo-api.js
// 仅负责：本地缓存读取、GitHub 仓库数据获取（可扩展 Cloudflare Worker）、写入缓存
// 不负责：DOM 渲染、轮播交互。

; (function (global)
{
    const DEFAULT_CACHE_KEY = 'repos-cache-v1';
    const PUBLIC_FALLBACK = 'https://api.github.com/users/kms12425-ctrl/repos?per_page=12&sort=updated';
    const WORKER_ENDPOINT = 'https://github-proxy.kms12425-ctrl.workers.dev/api/repos';

    function getCachedRepos(cacheKey = DEFAULT_CACHE_KEY)
    {
        try {
            const raw = localStorage.getItem(cacheKey);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (parsed && Array.isArray(parsed.repos)) return parsed;
        } catch (_) { }
        return null;
    }

    function saveRepos(repos, cacheKey = DEFAULT_CACHE_KEY)
    {
        try {
            localStorage.setItem(cacheKey, JSON.stringify({
                repos,
                generated_at: new Date().toISOString()
            }));
        } catch (_) { }
    }

    function fetchWithTimeout(url, ms = 5000)
    {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), ms);
        return fetch(url, { cache: 'no-store', signal: controller.signal })
            .finally(() => clearTimeout(t));
    }

    async function fetchRepos(options = {})
    {
        const {
            preferWorker = false, // 未来如果想切换到 Worker，可把这里设为 true
            timeout = 5000,
            cacheKey = DEFAULT_CACHE_KEY,
            saveCache = true
        } = options;
        const url = preferWorker ? WORKER_ENDPOINT : PUBLIC_FALLBACK;
        const resp = await fetchWithTimeout(url, timeout);
        if (!resp.ok) throw new Error('Repo API error ' + resp.status);
        const data = await resp.json();
        // Worker 返回结构可能是 {repos:[], generated_at:"..."}
        let repos = Array.isArray(data) ? data : (Array.isArray(data.repos) ? data.repos : []);
        if (saveCache && repos.length) { saveRepos(repos, cacheKey); }
        return { repos, source: 'network', generated_at: new Date().toISOString() };
    }

    global.RepoAPI = { getCachedRepos, fetchRepos };
})(window);
