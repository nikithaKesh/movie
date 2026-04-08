/**
 * APP CONFIGURATION & STATE
 */
const CONFIG = {
    API_KEY: '3fd2be6f0c70a2a598f084ddfb75487c', // Note: Move to .env/backend in production
    BASE_URL: 'https://api.themoviedb.org/3',
    IMG_PATH: 'https://image.tmdb.org/t/p/w1280',
    POSTER_PATH: 'https://image.tmdb.org/p/w500',
    DEFAULT_POSTER: 'https://via.placeholder.com/500x750?text=No+Image'
};

const app = {
    currentState: {
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

        // Debounced Search (Bonus Performance)
        this.search.addEventListener('input', this.debounce(() => this.handleSearch(), 500));
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
        const data = await this.fetchData('/genre/movie/list');
        this.genreFilter.innerHTML = '<option value="">All Genres</option>' + 
            data.genres.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
    },

    async loadCategory(type) {
        let endpoint = '/trending/movie/day';
        if (type === 'top_rated') endpoint = '/movie/top_rated';
        if (type === 'now_playing') endpoint = '/movie/now_playing';
        
        const data = await this.fetchData(endpoint);
        this.renderMovies(data.results);
    },

    async applyFilters() {
        const genre = this.genreFilter.value;
        const year = this.yearFilter.value;
        const rating = this.ratingFilter.value;
        
        const params = `&with_genres=${genre}&primary_release_year=${year}&vote_average.gte=${rating}`;
        const data = await this.fetchData('/discover/movie', params);
        this.renderMovies(data.results);
    },

    /**
     * UI RENDERING
     */
    renderMovies(movies) {
        this.main.innerHTML = '';
        if (movies.length === 0) {
            this.main.innerHTML = '<h2>No movies found matching your criteria.</h2>';
            return;
        }

        movies.forEach(movie => {
            const movieCard = this.createMovieCard(movie);
            this.main.appendChild(movieCard);
        });
    },

    createMovieCard(movie) {
        const { id, title, poster_path, vote_average } = movie;
        const card = document.createElement('div');
        card.classList.add('movie-card');
        
        card.innerHTML = `
            <div class="card-inner">
                <img src="${poster_path ? CONFIG.POSTER_PATH + poster_path : CONFIG.DEFAULT_POSTER}" 
                     alt="${title}" loading="lazy">
                <div class="movie-overlay">
                    <span class="rating ${this.getRatingClass(vote_average)}">${vote_average.toFixed(1)}</span>
                    <h3>${title}</h3>
                    <button class="btn-details" onclick="app.showMovieDetails(${id})">View Details</button>
                </div>
            </div>
        `;
        return card;
    },

    async showMovieDetails(id) {
        const [details, credits, videos, recs] = await Promise.all([
            this.fetchData(`/movie/${id}`),
            this.fetchData(`/movie/${id}/credits`),
            this.fetchData(`/movie/${id}/videos`),
            this.fetchData(`/movie/${id}/recommendations`)
        ]);

        const trailer = videos.results.find(v => v.type === 'Trailer' && v.site === 'YouTube');
        
        this.modalBody.innerHTML = `
            <div class="modal-grid">
                <div class="modal-header" style="background-image: url(${CONFIG.IMG_PATH + details.backdrop_path})">
                    <div class="header-content">
                        <h1>${details.title}</h1>
                        <p class="tagline">${details.tagline || ''}</p>
                    </div>
                </div>
                
                <div class="modal-info">
                    <div class="meta">
                        <span class="badge">${details.release_date.split('-')[0]}</span>
                        <span class="badge">${details.runtime} min</span>
                        <div class="genres">${details.genres.map(g => `<span>${g.name}</span>`).join('')}</div>
                    </div>
                    
                    <p class="overview">${details.overview}</p>

                    <h3>Top Cast</h3>
                    <div class="cast-list">
                        ${credits.cast.slice(0, 8).map(person => `
                            <div class="cast-item">
                                <img src="${person.profile_path ? 'https://image.tmdb.org/t/p/w185' + person.profile_path : CONFIG.DEFAULT_POSTER}">
                                <p><strong>${person.name}</strong></p>
                                <p>${person.character}</p>
                            </div>
                        `).join('')}
                    </div>

                    ${trailer ? `<button class="btn-primary" onclick="app.playTrailer('${trailer.key}')">▶ Watch Trailer</button>` : ''}
                    
                    <h3>Recommended</h3>
                    <div class="horizontal-scroll">
                        ${recs.results.slice(0, 6).map(r => `
                            <img class="rec-poster" src="${CONFIG.POSTER_PATH + r.poster_path}" onclick="app.showMovieDetails(${r.id})">
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
                <button class="btn-primary" onclick="app.init()">Back to Details</button>
            </div>
        `;
    },

    getRatingClass(vote) {
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
            this.fetchData('/search/movie', `&query=${encodeURIComponent(query)}`)
                .then(data => this.renderMovies(data.results));
        }
    }
};

app.init();
