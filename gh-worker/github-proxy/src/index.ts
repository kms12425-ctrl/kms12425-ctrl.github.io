// Cloudflare Worker: GitHub Repos Proxy (TypeScript)
// 路径 /api/repos  -> 代理 GitHub API，使用 Secret GH_TOKEN，做字段白名单与边缘缓存

interface Env
{
	GH_TOKEN: string; // 通过 wrangler secret put GH_TOKEN 注入
}

// 允许的来源（生产可改成你的域名）
const ALLOW_ORIGIN = '*';

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response>
	{
		const url = new URL(request.url);

		// 预检 CORS
		if (request.method === 'OPTIONS') {
			return new Response(null, { headers: corsHeaders() });
		}

		if (url.pathname === '/api/repos') {
			return handleRepos(request, env, ctx);
		}

		// 健康检查或示例
		if (url.pathname === '/api/health') {
			return json({ ok: true, time: new Date().toISOString() });
		}

		return new Response('Not Found', { status: 404, headers: corsHeaders() });
	}
} satisfies ExportedHandler<Env>;

function corsHeaders(extra: Record<string, string> = {}): HeadersInit
{
	return {
		'Access-Control-Allow-Origin': ALLOW_ORIGIN,
		'Access-Control-Allow-Methods': 'GET,OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type,Authorization',
		'Access-Control-Max-Age': '86400',
		...extra
	};
}

function json(data: unknown, init: ResponseInit = {}): Response
{
	const body = JSON.stringify(data);
	const headers = new Headers(init.headers || {});
	headers.set('Content-Type', 'application/json');
	for (const [k, v] of Object.entries(corsHeaders())) headers.set(k, v);
	return new Response(body, { ...init, headers });
}

async function handleRepos(request: Request, env: Env, ctx: ExecutionContext): Promise<Response>
{
	const cache = caches.default;
	const cacheKey = new Request(request.url, request);

	// 先查缓存
	let cached = await cache.match(cacheKey);
	if (cached) {
		// 命中缓存立即返回，同时后台刷新（简易 stale-while-revalidate）
		const h = new Headers(cached.headers);
		h.set('CF-Cache', 'HIT');
		ctx.waitUntil(refreshAndPut(cache, cacheKey, env));
		return new Response(cached.body, { headers: h, status: cached.status });
	}

	// 未命中：抓取并写入
	const fresh = await fetchAndBuild(env);
	ctx.waitUntil(cache.put(cacheKey, fresh.clone()));
	return fresh;
}

async function refreshAndPut(cache: Cache, cacheKey: Request, env: Env)
{
	try {
		const fresh = await fetchAndBuild(env);
		await cache.put(cacheKey, fresh.clone());
	} catch { /* 静默失败 */ }
}

async function fetchAndBuild(env: Env): Promise<Response>
{
	const ghUrl = 'https://api.github.com/users/kms12425-ctrl/repos?per_page=30&sort=updated'; // 降低 per_page

	// 超时控制（4 秒放弃，返回错误 JSON 由前端 fallback）
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 4000);
	let ghResp: Response;
	try {
		ghResp = await fetch(ghUrl, {
			headers: {
				'Authorization': `Bearer ${env.GH_TOKEN}`,
				'Accept': 'application/vnd.github+json',
				'User-Agent': 'personal-site-worker'
			},
			signal: controller.signal
		});
	} catch (e: any) {
		clearTimeout(timeout);
		return json({ error: 'GitHub fetch failed', message: e?.message || String(e) }, { status: 504 });
	}
	clearTimeout(timeout);

	if (!ghResp.ok) {
		return json({ error: 'GitHub API error', status: ghResp.status }, { status: ghResp.status });
	}

	let list: any[] = await ghResp.json();

	const repos = list
		.filter(r => !r.fork)
		.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
		.slice(0, 16) // 减少传输量
		.map(r => ({
			name: r.name,
			description: r.description,
			html_url: r.html_url,
			stargazers_count: r.stargazers_count,
			forks_count: r.forks_count,
			open_issues_count: r.open_issues_count,
			language: r.language,
			updated_at: r.updated_at
		}));

	const payload = {
		generated_at: new Date().toISOString(),
		count: repos.length,
		repos
	};

	const body = JSON.stringify(payload);
	const headers: HeadersInit = {
		...corsHeaders(),
		'Content-Type': 'application/json',
		'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
		'CF-Cache': 'MISS'
	};
	return new Response(body, { status: 200, headers });
}
