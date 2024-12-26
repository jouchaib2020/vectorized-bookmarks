import axios, { AxiosError } from 'axios';
import { Env } from '../worker-configuration';
import { bookmarkDto } from './supabaseService';

interface TwitterBookmark {
	id: string;
	text: string;
}

interface TwitterBookmarksResponse {
	data?: TwitterBookmark[];
	errors?: any[];
}

class XService {
	private secrets: Env;
	private bearerToken: string | null = null; // Store the bearer token

	constructor(secrets: Env) {
		this.secrets = secrets;
	}

	private async getBearerToken(): Promise<string | null> {
		if (this.bearerToken) {
			return this.bearerToken; // Return cached token if available
		}
		try {
			const encoded = Buffer.from(`${this.secrets.X_API_KEY}:${this.secrets.X_API_KEY_SECRET}`).toString('base64');
			const response = await axios.post('https://api.twitter.com/oauth2/token', 'grant_type=client_credentials', {
				headers: {
					Authorization: `Basic ${encoded}`,
					'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
				},
			});

			console.log('console loggin: ', response.data.errors);
			this.bearerToken = response.data.access_token; // Cache the token
			return this.bearerToken;
		} catch (error: AxiosError | any) {
			console.error('Error getting bearer token: ', error.response.data);
			return null;
		}
	}

	public async getAllBookmarks(): Promise<bookmarkDto[]> {
		const bearerToken = await this.getBearerToken();
		if (!bearerToken) {
			throw new Error('Failed to obtain bearer token.');
		}

		try {
			const response = await axios.get<TwitterBookmarksResponse>(`https://api.twitter.com/2/users/${this.secrets.X_USER_ID}/bookmarks`, {
				headers: {
					Authorization: `Bearer ${bearerToken}`,
				},
			});

			if (response.data.errors && response.data.errors.length > 0) {
				throw new Error(JSON.stringify(response.data.errors));
			}

			if (!response.data.data) {
				return [];
			}

			const bookmarks: bookmarkDto[] = response.data.data.map((item) => ({
				twitter_id: item.id,
				content: item.text,
			}));

			return bookmarks;
		} catch (error) {
			console.error('Error fetching bookmarks:', error);
			throw error; // Re-throw the error for handling at a higher level
		}
	}
}

export default XService;
