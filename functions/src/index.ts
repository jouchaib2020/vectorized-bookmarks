import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Env } from '../worker-configuration';
import { cors } from 'hono/cors';

const app = new Hono<{ Bindings: Env }>();

app.use(
	'*',
	cors({
		origin: '*',
		allowHeaders: ['Content-Type', 'Authorization', 'Content-Length'],
		allowMethods: ['POST', 'GET', 'OPTIONS'],
		exposeHeaders: ['Content-Length'],
		maxAge: 600,
		credentials: true,
	})
);

app.get('/', (ctx) => {
	return ctx.json({ message: 'Welcome to the Bookmark Search API' }, 200);
});

app.post('/add-bookmark', async (ctx) => {
	const { SUPABASE_URL, SUPABASE_KEY, GEMINI_API_KEY } = ctx.env;

	const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
	const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });

	const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

	try {
		const { content } = await ctx.req.json();

		if (!content) {
			return ctx.json({ error: 'Content is required.' }, 400);
		} else if (typeof content !== 'string') {
			return ctx.json({ error: 'Content must be a string.' }, 400);
		}

		// Vectorize the content using gemini model emmbeddings-004
		const vectorResponse = await model.embedContent(content);

		const supabaseResponse = await supabase.from('bookmarks_embedding').insert([
			{
				content,
				embedding: vectorResponse.embedding.values,
			},
		]);
		return ctx.json({ success: true, data: supabaseResponse.data }, 200);
	} catch (error: Error | any) {
		console.error(error.response ? error.response.data : error.message);
		return ctx.json({ error: 'Internal Server Error' }, 500);
	}
});

// Search Endpoint
app.post('/search', async (c) => {
	const { SUPABASE_URL, SUPABASE_KEY, GEMINI_API_KEY } = c.env;

	const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
	try {
		const { query } = await c.req.json();

		if (!query) {
			return c.json({ error: 'Query is required.' }, 400);
		}

		// Vectorize the query
		const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
		const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
		const vectorResponse = await model.embedContent(query);

		const queryVector = vectorResponse.embedding.values;

		// The function match_bookmarks is a stored procedure in supabase
		const { data: bookmarks, error } = await supabase.rpc('match_bookmarks', {
			query_embedding: queryVector,
			match_threshold: 0.3,
			match_count: 10,
		});
		if (error) throw error;

		return c.json({ results: bookmarks }, 200);
	} catch (error: Error | any) {
		console.error(error.response ? error.response.data : error.message);
		return c.json({ error: 'Internal Server Error' }, 500);
	}
});

app.onError((err, c) => {
	console.error(err);
	return c.json({ error: 'Internal Server Error' }, 500);
});

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		return app.fetch(request, env, ctx);
	},
};
