/*
	jmobbi App Store reviews loader.
	Builds a single-column, continuously scrolling wall of App Store reviews.
	Reviews are pulled for one or more apps, filtered by the allowed star
	scores, deduplicated by id and sorted by date (newest first). More RSS
	pages are loaded incrementally as the wall scrolls, so it never runs dry.

	Markup:
	  <div class="app-reviews"
	       data-app-id="123,456"     one id, or a comma list of ids
	       data-ratings="3,4,5"      star scores to include
	       data-country="us"></div>  optional, defaults to "us"
*/
(function () {
	var BATCH_SIZE = 20;
	var SCROLL_SPEED = 0.5;   // px per frame
	var MAX_PAGES = 10;       // RSS pages per app
	var GROW_INTERVAL = 20000;

	function escapeHtml(str) {
		return String(str || '')
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;');
	}

	function stars(n) {
		var full = Math.round(Number(n) || 0);
		var out = '';
		for (var i = 0; i < 5; i++) out += i < full ? '★' : '☆';
		return out;
	}

	function parseList(value) {
		return String(value || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
	}

	function parseRatings(value) {
		var allowed = parseList(value || '3,4,5')
			.map(function (n) { return parseInt(n, 10); })
			.filter(function (n) { return n >= 1 && n <= 5; });
		return allowed.length ? allowed : [3, 4, 5];
	}

	function normalize(entry) {
		return {
			id: entry.id && entry.id.label,
			author: entry.author && entry.author.name && entry.author.name.label,
			rating: parseInt(entry['im:rating'].label, 10),
			title: entry.title && entry.title.label,
			body: entry.content && entry.content.label,
			date: (entry.updated && entry.updated.label) || ''
		};
	}

	function cardHtml(r) {
		return '<div class="review-card">' +
			'<div class="review-stars">' + stars(r.rating) + '</div>' +
			(r.title ? '<p class="review-title">' + escapeHtml(r.title) + '</p>' : '') +
			'<p class="review-body">' + escapeHtml(r.body) + '</p>' +
			(r.author ? '<span class="review-author">' + escapeHtml(r.author) + '</span>' : '') +
			'</div>';
	}

	function Wall(container) {
		this.container = container;
		this.appIds = parseList(container.getAttribute('data-app-id'));
		this.country = container.getAttribute('data-country') || 'us';
		this.allowed = parseRatings(container.getAttribute('data-ratings'));

		this.pool = [];
		this.seen = {};
		this.renderIndex = 0;
		this.isLoading = false;
		this.pos = 0;
		this.paused = false;

		this.rssPage = {};
		this.rssDone = {};
		var self = this;
		this.appIds.forEach(function (id) { self.rssPage[id] = 1; self.rssDone[id] = false; });
	}

	Wall.prototype.fetchPage = async function (appId) {
		if (this.rssDone[appId]) return [];
		var page = this.rssPage[appId];
		if (page > MAX_PAGES) { this.rssDone[appId] = true; return []; }
		try {
			var url = 'https://itunes.apple.com/' + this.country +
				'/rss/customerreviews/page=' + page + '/id=' + appId + '/sortby=mostrecent/json';
			var res = await fetch(url);
			var data = await res.json();
			var entries = (data.feed && data.feed.entry) || [];
			if (!Array.isArray(entries)) entries = [entries];
			var reviews = [];
			entries.forEach(function (e) {
				if (e && e['im:rating']) reviews.push(normalize(e));
			});
			this.rssPage[appId] = page + 1;
			if (!reviews.length) this.rssDone[appId] = true;
			return reviews;
		} catch (e) {
			this.rssDone[appId] = true;
			return [];
		}
	};

	// Fallback: load the reviews cached on disk for an app.
	Wall.prototype.loadCached = async function (appId) {
		try {
			var res = await fetch('reviews/' + appId + '_reviews.json');
			if (!res.ok) return [];
			var data = await res.json();
			return Array.isArray(data) ? data : [];
		} catch (e) {
			return [];
		}
	};

	Wall.prototype.mergeIntoPool = function (incoming) {
		var self = this, added = 0;
		incoming.forEach(function (r) {
			var key = r.id || (r.author + '|' + r.title + '|' + r.body);
			if (self.seen[key]) return;
			if (self.allowed.indexOf(r.rating) === -1) return;
			self.seen[key] = true;
			self.pool.push(r);
			added++;
		});
		if (added) this.pool.sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
		return added;
	};

	Wall.prototype.renderBatch = function () {
		var end = Math.min(this.renderIndex + BATCH_SIZE, this.pool.length);
		var html = '';
		for (var i = this.renderIndex; i < end; i++) html += cardHtml(this.pool[i]);
		this.scroller.insertAdjacentHTML('beforeend', html);
		this.renderIndex = end;
	};

	Wall.prototype.loadMore = async function () {
		if (this.isLoading) return;
		this.isLoading = true;
		var self = this;
		var results = await Promise.all(this.appIds.map(function (id) { return self.fetchPage(id); }));
		var incoming = [].concat.apply([], results);
		this.mergeIntoPool(incoming);
		this.renderBatch();
		this.isLoading = false;
	};

	Wall.prototype.startScroll = function () {
		var self = this;
		function frame() {
			if (!self.paused) {
				self.pos += SCROLL_SPEED;
				var h = self.scroller.scrollHeight;
				// render more of the pool as we approach the end
				if (self.pos >= h - 800 && self.renderIndex < self.pool.length) self.renderBatch();
				// grow the pool from the network when the rendered content is short
				if (self.pos >= h - 800 && self.renderIndex >= self.pool.length) self.loadMore();
				// loop back to the top
				if (self.pos >= h - 400) self.pos = 0;
				self.scroller.style.transform = 'translateY(-' + self.pos + 'px)';
			}
			requestAnimationFrame(frame);
		}
		requestAnimationFrame(frame);
	};

	Wall.prototype.start = async function () {
		if (!this.appIds.length) return;

		// Mix live web reviews with the on-disk cache (multi-country). Both are
		// fetched up front and merged; mergeIntoPool dedupes by review id so a
		// review present in both sources appears only once.
		var self = this;
		var web = await Promise.all(this.appIds.map(function (id) { return self.fetchPage(id); }));
		var cache = await Promise.all(this.appIds.map(function (id) { return self.loadCached(id); }));
		var incoming = [].concat.apply([], web).concat([].concat.apply([], cache));
		this.mergeIntoPool(incoming);

		if (!this.pool.length) {
			this.container.innerHTML = '<p class="reviews-empty">Be the first to leave a review on the App Store.</p>';
			return;
		}

		this.container.innerHTML = '<div class="reviews-box"><div class="reviews-scroller"></div></div>';
		this.box = this.container.querySelector('.reviews-box');
		this.scroller = this.container.querySelector('.reviews-scroller');

		var self2 = this;
		this.renderBatch();
		this.startScroll();
		setInterval(function () { self2.loadMore(); }, GROW_INTERVAL);
	};

	document.addEventListener('DOMContentLoaded', function () {
		document.querySelectorAll('.app-reviews[data-app-id]').forEach(function (el) {
			new Wall(el).start();
		});
	});
})();
