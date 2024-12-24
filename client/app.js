document.addEventListener('DOMContentLoaded', () => {
	const addBookmarkForm = document.getElementById('addBookmarkForm');
	const bookmarkContent = document.getElementById('bookmarkContent');
	const addBookmarkMessage = document.getElementById('addBookmarkMessage');

	const searchForm = document.getElementById('searchForm');
	const searchQuery = document.getElementById('searchQuery');
	const searchResults = document.getElementById('searchResults');

	const WORKER_URL = 'https://twitter-bookmarks-app.yourdomain.workers.dev';

	addBookmarkForm.addEventListener('submit', async (e) => {
		e.preventDefault();
		const content = bookmarkContent.value.trim();

		if (!content) {
			addBookmarkMessage.textContent = 'Please enter bookmark content.';
			return;
		}

		try {
			const response = await fetch(`${WORKER_URL}/add-bookmark`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ content }),
			});

			const data = await response.json();

			if (response.ok) {
				addBookmarkMessage.textContent = 'Bookmark added successfully!';
				addBookmarkForm.reset();
			} else {
				addBookmarkMessage.textContent = `Error: ${data.error}`;
			}
		} catch (error) {
			console.error(error);
			addBookmarkMessage.textContent = 'An error occurred while adding the bookmark.';
		}
	});

	// Handle Search
	searchForm.addEventListener('submit', async (e) => {
		e.preventDefault();
		const query = searchQuery.value.trim();

		if (!query) {
			searchResults.innerHTML = '<p class="text-red-500">Please enter a search query.</p>';
			return;
		}

		searchResults.innerHTML = '<p>Searching...</p>';

		try {
			const response = await fetch(`${WORKER_URL}/search`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ query }),
			});

			const data = await response.json();

			if (response.ok) {
				if (data.results.length === 0) {
					searchResults.innerHTML = '<p class="text-gray-700">No bookmarks found.</p>';
					return;
				}

				let html = '<ul class="space-y-4">';
				data.results.forEach((bookmark) => {
					html += `
            <li class="p-4 bg-gray-50 rounded shadow">
              <p>${bookmark.content}</p>
              <p class="text-sm text-gray-500">Similarity: ${(bookmark.similarity * 100).toFixed(2)}%</p>
            </li>
          `;
				});
				html += '</ul>';

				searchResults.innerHTML = html;
			} else {
				searchResults.innerHTML = `<p class="text-red-500">Error: ${data.error}</p>`;
			}
		} catch (error) {
			console.error(error);
			searchResults.innerHTML = '<p class="text-red-500">An error occurred while searching.</p>';
		}
	});
});
