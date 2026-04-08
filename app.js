/**
 * APP CONFIGURATION & STATE
 */
const CONFIG = {
    API_KEY: '3fd2be6f0c70a2a598f084ddfb75487c', // Note: Move to .env/backend in production
    BASE_URL: 'https://api.themoviedb.org/3',
    IMG_PATH: 'https://image.tmdb.org/t/p/w1280', // Fixed URL path
    POSTER_PATH: 'https://image.tmdb.org/t/p/w500',
    DEFAULT_POSTER: 'https://via.placeholder.com/500x750?text=No+Image'
};

const app = {
    currentState: {
        mediaType: 'movie', // NEW: Tracks if we are looking at 'movie' or 'tv'
        genre: '',
        year: '',
        rating: 0
    },

    /**
     * INITIALIZATION
     */
    async init() {
        this.cacheDOM();
        this.bindEvents();
        await this.loadGenres();
        this.loadCategory('trending');
    },

    cacheDOM() {
        this.main = document.getElementById('main');
        this.form = document.getElementById('form');
        this.search = document.getElementById('search');
        this.modal = document.getElementById('modal');
        this.modalBody = document.getElementById('modal-body');
        this.genreFilter = document.getElementById('genreFilter');
        this.yearFilter = document.getElementById('yearFilter');
        this.ratingFilter = document.getElementById('ratingFilter');
    },

    bindEvents() {
        this.form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSearch();
        });

        // Close Modal logic
        document.querySelector('.close-modal').onclick = () => this.toggleModal(false);
        window.onclick = (e) => e.target === this.modal && this.toggleModal(false);

        // Filters
        [this.genreFilter, this.yearFilter, this.ratingFilter].forEach(el => {
            el.addEventListener('change', () => this.applyFilters());
        });

        // Debounced Search
        this.search.addEventListener('input', this.debounce(() => this.handleSearch(), 500));
    },

    /**
     * STATE MANAGEMENT (NEW)
     */
    setMediaType(type) {
        this.currentState.mediaType = type;
        this.loadGenres(); // Reload genres because TV and Movie genres have different IDs
        this.loadCategory('trending'); // Reset view
    },

    /**
     * DATA FETCHING LAYER
     */
    async fetchData(endpoint, params = '') {
        try {
            const response = await fetch(`${CONFIG.BASE_URL}${endpoint}?api_key=${CONFIG.API_KEY}${params}`);
            if (!response.ok) throw new Error('Network response was not ok');
            return await response.json();
        } catch (error) {
            console.error("Fetch Error:", error);
            this.main.innerHTML = `<p class="error">Something went wrong. Please try again later.</p>`;
        }
    },

    async loadGenres() {
        // Dynamically fetch genres based on current media type
        const data = await this.fetchData(`/genre/${this.currentState.mediaType}/list`);
        if (data && data.genres) {
            this.genreFilter.innerHTML = '<option value="">All Genres</option>' + 
                data.genres.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
        }
    },

    async loadCategory(categoryType) {
        const type = this.currentState.mediaType;
        let endpoint = `/trending/${type}/day`; // default

        if (categoryType === 'top_rated') endpoint = `/${type}/top_rated`;
        // 'now_playing' is movies only. For TV, the equivalent is 'on_the_air'
        if (categoryType === 'now_playing') {
            endpoint = type === 'movie' ? '/movie/now_playing' : '/tv/on_the_air';
        }
        
        const data = await this.fetchData(endpoint);
        if (data && data.results) this.renderMedia(data.results);
    },

    async applyFilters() {
        const { mediaType, genre, year, rating } = this.currentState;
        this.currentState.genre = this.genreFilter.value;
        this.currentState.year = this.yearFilter.value;
        this.currentState.rating = this.ratingFilter.value;
        
        // TMDB uses 'first_air_date_year' for TV, and 'primary_release_year' for movies
        const yearParam = mediaType === 'movie' 
            ? `&primary_release_year=${this.currentState.year}` 
            : `&first_air_date_year=${this.currentState.year}`;

        const params = `&with_genres=${this.currentState.genre}${yearParam}&vote_average.gte=${this.currentState.rating}`;
        const data = await this.fetchData(`/discover/${mediaType}`, params);
        
        if (data && data.results) this.renderMedia(data.results);
    },

    /**
     * UI RENDERING
     */
    renderMedia(items) {
        this.main.innerHTML = '';
        if (!items || items.length === 0) {
            this.main.innerHTML = '<h2>No results found matching your criteria.</h2>';
            return;
        }

        items.forEach(item => {
            const card = this.createMediaCard(item);
            this.main.appendChild(card);
        });
    },

    createMediaCard(item) {
        // Handle differences between Movie (title) and TV (name)
        const title = item.title || item.name;
        const id = item.id;
        const { poster_path, vote_average } = item;
        
        const card = document.createElement('div');
        card.classList.add('movie-card');
        
        card.innerHTML = `
            <div class="card-inner">
                <img src="${poster_path ? CONFIG.POSTER_PATH + poster_path : CONFIG.DEFAULT_POSTER}" 
                     alt="${title}" loading="lazy">
                <div class="movie-overlay">
                    <span class="rating ${this.getRatingClass(vote_average)}">${vote_average.toFixed(1)}</span>
                    <h3>${title}</h3>
                    <button class="btn-details" onclick="app.showDetails(${id}, '${this.currentState.mediaType}')">View Details</button>
                </div>
            </div>
        `;
        return card;
    },

    /**
     * STREAMING PROVIDERS (NEW)
     */
    async getWatchProviders(id, type) {
        const data = await this.fetchData(`/${type}/${id}/watch/providers`);
        const usProviders = data?.results?.US; // Assuming US location for this example
        
        if (!usProviders || !usProviders.flatrate) return '';

        return `
            <div class="providers" style="margin: 20px 0;">
                <h4 style="color: #a3a3a3; margin-bottom: 8px;">Stream on:</h4>
                <div style="display: flex; gap: 10px;">
                    ${usProviders.flatrate.map(provider => `
                        <img src="${CONFIG.POSTER_PATH + provider.logo_path}" 
                             alt="${provider.provider_name}" 
                             title="${provider.provider_name}"
                             style="width: 45px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.3);">
                    `).join('')}
                </div>
            </div>
        `;
    },

    /**
     * USER ACTIONS (NEW)
     */
    async toggleWatchlist(mediaId, mediaType) {
        // *NOTE: In a real environment, these come from your authenticated user session*
        const accountId = 'YOUR_ACCOUNT_ID'; 
        const sessionId = 'YOUR_SESSION_ID'; 

        if (accountId === 'YOUR_ACCOUNT_ID') {
            alert("Authentication required! Please set up your TMDB Session ID in the code to use the Watchlist feature.");
            return;
        }

        try {
            const response = await fetch(`${CONFIG.BASE_URL}/account/${accountId}/watchlist?api_key=${CONFIG.API_KEY}&session_id=${sessionId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json;charset=utf-8' },
                body: JSON.stringify({
                    media_type: mediaType,
                    media_id: mediaId,
                    watchlist: true // hardcoded to 'add' for this example
                })
            });

            const result = await response.json();
            if (result.success) {
                alert(`Successfully added to your list!`);
            }
        } catch (error) {
            console.error('Error updating watchlist:', error);
        }
    },

    /**
     * MODAL & DETAILS
     */
    async showDetails(id, type) {
        // Fetch all data concurrently
        const [details, credits, videos, recs, providersHtml] = await Promise.all([
            this.fetchData(`/${type}/${id}`),
            this.fetchData(`/${type}/${id}/credits`),
            this.fetchData(`/${type}/${id}/videos`),
            this.fetchData(`/${type}/${id}/recommendations`),
            this.getWatchProviders(id, type)
        ]);

        const title = details.title || details.name;
        const date = details.release_date || details.first_air_date;
        const trailer = videos.results.find(v => v.type === 'Trailer' && v.site === 'YouTube');
        
        // Handle Runtime vs Seasons
        const durationHtml = type === 'movie' 
            ? `<span class="badge">${details.runtime} min</span>`
            : `<span class="badge">${details.number_of_seasons} Season(s)</span>`;
        
        this.modalBody.innerHTML = `
            <div class="modal-grid">
                <div class="modal-header" style="background-image: url(${CONFIG.IMG_PATH + details.backdrop_path})">
                    <div class="header-content">
                        <h1>${title}</h1>
                        <p class="tagline">${details.tagline || ''}</p>
                    </div>
                </div>
                
                <div class="modal-info">
                    <div class="meta">
                        <span class="badge">${date ? date.split('-')[0] : 'N/A'}</span>
                        ${durationHtml}
                        <div class="genres">${details.genres.map(g => `<span>${g.name}</span>`).join('')}</div>
                    </div>
                    
                    <p class="overview">${details.overview}</p>

                    ${providersHtml}

                    <div style="display: flex; gap: 15px;">
                        ${trailer ? `<button class="btn-primary" onclick="app.playTrailer('${trailer.key}')">▶ Watch Trailer</button>` : ''}
                        <button class="btn-primary" style="background: #333;" onclick="app.toggleWatchlist(${id}, '${type}')">+ My List</button>
                    </div>

                    <h3 style="margin-top: 30px;">Top Cast</h3>
                    <div class="cast-list">
                        ${credits.cast.slice(0, 8).map(person => `
                            <div class="cast-item">
                                <img src="${person.profile_path ? 'https://image.tmdb.org/t/p/w185' + person.profile_path : CONFIG.DEFAULT_POSTER}">
                                <p><strong>${person.name}</strong></p>
                                <p>${person.character}</p>
                            </div>
                        `).join('')}
                    </div>
                    
                    <h3 style="margin-top: 20px;">Recommended</h3>
                    <div class="horizontal-scroll">
                        ${recs.results.slice(0, 6).map(r => `
                            <img class="rec-poster" src="${CONFIG.POSTER_PATH + r.poster_path}" onclick="app.showDetails(${r.id}, '${type}')">
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
        this.toggleModal(true);
    },

    /**
     * UTILITIES
     */
    toggleModal(show) {
        this.modal.classList.toggle('hidden', !show);
        document.body.style.overflow = show ? 'hidden' : 'auto';
    },

    playTrailer(key) {
        this.modalBody.innerHTML = `
            <div class="video-container">
                <iframe width="100%" height="500px" src="https://www.youtube.com/embed/${key}?autoplay=1" frameborder="0" allowfullscreen></iframe>
                <button class="btn-primary" style="margin-top:20px;" onclick="app.init()">Back to Details</button>
            </div>
        `;
    },

    getRatingClass(vote) {
        if (!vote) return 'red';
        if (vote >= 7.5) return 'green';
        if (vote >= 5) return 'orange';
        return 'red';
    },

    debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    },

    handleSearch() {
        const query = this.search.value;
        if (query) {
            // Search dynamically based on current mediaType (movie or tv)
            this.fetchData(`/search/${this.currentState.mediaType}`, `&query=${encodeURIComponent(query)}`)
                .then(data => {
                    if (data && data.results) this.renderMedia(data.results);
                });
        }
    }
};

app.init();
