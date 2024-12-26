import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

export interface Bookmark {
	id: string;
	twitter_id: string;
	content: string;
	embedding: number[];
}

export interface bookmarkDto {
	twitter_id: string;
	content: string;
}

interface addRespone {
	error?: string;
	data?: any;
}

export interface Secrets {
	GEMINI_API_KEY: string;
	SUPABASE_URL: string;
	SUPABASE_KEY: string;
}
class supabaseService {
	public secrets: Secrets;
	public supabase;
	constructor(secrets: Secrets) {
		this.secrets = secrets;
		this.supabase = createClient(secrets.SUPABASE_URL, secrets.SUPABASE_KEY);
	}

	public async addBookmark(dto: bookmarkDto): Promise<addRespone> {
		const { GEMINI_API_KEY } = this.secrets;
		const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
		const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });

		try {
			// Vectorize the content using gemini model emmbeddings-004
			const vectorResponse = await model.embedContent(dto.content);
			const { data, error } = await this.supabase.from('bookmarks_embedding').insert([
				{
					...dto,
					embedding: vectorResponse.embedding.values,
				},
			]);

			if (error) throw error;

			return { data };
		} catch (error: Error | any) {
			console.error(error.response ? error.response.data : error.message);
			return { error: 'Internal Server Error' };
		}
	}

	/**
	 * getAll
	 */
	public async getAll() {
		const { data, error } = await this.supabase.from('bookmarks_embedding').select('*');

		if (error) throw 'Error while retreiving bookmarks: ' + JSON.stringify(error);

		return data as Bookmark[];
	}
}

export default supabaseService;
