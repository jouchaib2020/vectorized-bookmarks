import { Hono } from 'hono';
import { Env } from '../worker-configuration';
import axios from 'axios';

export const auth = new Hono<{ Bindings: Env }>();

auth.get('/auth/twitter', (c) => {
	const { X_CLIENT_ID, TWITTER_REDIRECT_URI } = c.env;
	const redirect_uri = encodeURIComponent(TWITTER_REDIRECT_URI);
	const response_type = 'code';
	const scope = encodeURIComponent('tweet.read tweet.write users.read bookmark.read bookmark.write');
	const state = 'some_random_state';

	const oauthUrl = `https://twitter.com/i/oauth2/authorize?response_type=${response_type}&client_id=${X_CLIENT_ID}&redirect_uri=${redirect_uri}&scope=${scope}&state=${state}&code_challenge=challenge&code_challenge_method=plain`;

	return c.redirect(oauthUrl);
});

auth.get('/auth/callback', async (c) => {
	console.log(c.req.query());
	const { code, state } = c.req.query();

	// Validate code parameter
	if (!code) {
		return c.json({ error: 'Code is required.' }, 400);
	}

	try {
		const tokenResponse = await axios.post('https://api.twitter.com/2/oauth2/token', null, {
			params: {
				grant_type: 'authorization_code',
				code: code,
				redirect_uri: c.env.TWITTER_REDIRECT_URI,
				client_id: c.env.X_CLIENT_ID,
				code_verifier: 'challenge', // Implement PKCE if using
			},
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				Authorization: `Basic ${Buffer.from(`${c.env.X_CLIENT_ID}:${c.env.X_CLIENT_SECRET}`).toString('base64')}`,
			},
		});

		const { access_token, refresh_token } = tokenResponse.data;

		//store in cLoudflare KV
		await c.env.ACCESS_TOKENS.put('access_token', access_token);

		refresh_token && (await c.env.ACCESS_TOKENS.put('refresh_token', refresh_token));

		console.log('got form token endp: Access token:', access_token);
		return c.redirect('/x-bookmarks');
	} catch (error: Error | any) {
		console.error(error.response ? error.response.data : error.message);
		return c.json({ error: 'Internal Server Error', message: error.response ? error.response.data : error.message }, 500);
	}
});
