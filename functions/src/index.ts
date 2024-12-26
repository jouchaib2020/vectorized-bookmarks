import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Env } from '../worker-configuration';
import { cors } from 'hono/cors';
import supabase from './supabaseService';
import twitterService from './xService';
import { auth } from './auth';

const app = new Hono<{ Bindings: Env }>();

app.use(
	'*',
	cors({
		origin: ['http://localhost:3000', 'https://vectorized-bookmarks.vercel.app'],
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

app.route('/auth', auth);

app.get('/x-bookmarks', async (c) => {
	const service = new twitterService(c.env);
	try {
		const res = await service.getAllBookmarks();
		return c.json({ data: res });
	} catch (error: Error | any) {
		console.error(error.response ? error.response.data : error.message);
		return c.json(
			{ error: 'Internal Server Error', details: error ? (error.response ? error.response.data : error.message) : 'No error details' },
			500
		);
	}
});

app.get('/cron', async (c) => {
	// 2- get supabase bookmarks
	const supabaseService = new supabase(c.env);
	const savedBookamrks = await supabaseService.getAll();
	// 3- get twitter bookmarks
	const xService = new twitterService(c.env);
	const xBookmarks = await xService.getAllBookmarks();
	// 4 - add new bookmarks vectorize to supabase
	const newBookmarks = xBookmarks.filter((bookmark) => {
		const f = savedBookamrks.find((sb) => sb.twitter_id === bookmark.twitter_id);
		if (f) return false;
		return true;
	});

	const res = await Promise.all(newBookmarks.values().map((bookmark) => supabaseService.addBookmark(bookmark)));
	return c.json({ success: true, data: res });
});

app.post('/add-bookmark', async (ctx) => {
	const supabaseService = new supabase(ctx.env);
	try {
		const { content, twitter_id } = await ctx.req.json();
		if (!content) {
			return ctx.json({ error: 'Content is required.' }, 400);
		} else if (typeof content !== 'string') {
			return ctx.json({ error: 'Content must be a string.' }, 400);
		}
		const { data, error } = await supabaseService.addBookmark({ content, twitter_id });

		if (error) return ctx.json({ error }, 500);
		return ctx.json({ data }, 200);
	} catch (error: Error | any) {
		console.error(error.response ? error.response.data : error.message);
		return ctx.json({ error: 'Internal Server Error', details: error.response ? error.response.data : error.message }, 500);
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
