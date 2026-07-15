/*
	jmobbi App Store data loader for app pages.
	Fills the hero icon (#app-icon) and the screenshots strip (.shots[data-app-id])
	with live data from the App Store. If the App Store can't be reached, the
	screenshots fall back to the cached copies in screenshots/<appid>/N.jpg.
	If no screenshots are available from either source, the section is hidden.
*/
(function () {
	function addShot(shots, url) {
		var img = document.createElement('img');
		img.src = url;
		img.alt = 'App screenshot';
		img.className = 'screenshot';
		shots.appendChild(img);
	}

	function hideSectionIfEmpty(shots) {
		if (shots.children.length === 0) {
			var section = shots.closest('section');
			if (section) section.style.display = 'none';
		}
	}

	// Fallback: load cached screenshots (screenshots/<appid>/1.jpg, 2.jpg, ...)
	// one after another until a file is missing. Works from file:// too, since
	// <img> loads local files without a cross-origin request.
	function loadCached(shots, appId) {
		var i = 1;
		(function tryNext() {
			var url = 'screenshots/' + appId + '/' + i + '.jpg';
			var probe = new Image();
			probe.onload = function () {
				addShot(shots, url);
				i++;
				tryNext();
			};
			probe.onerror = function () {
				hideSectionIfEmpty(shots);
			};
			probe.src = url;
		})();
	}

	document.addEventListener('DOMContentLoaded', async function () {
		var shots = document.querySelector('.shots[data-app-id]');
		if (!shots) return;

		var appId = shots.getAttribute('data-app-id');
		var country = shots.getAttribute('data-country') || 'us';
		var loadedLive = false;

		try {
			var res = await fetch('https://itunes.apple.com/' + country + '/lookup?id=' + appId);
			var data = await res.json();
			if (data.resultCount) {
				var app = data.results[0];

				var icon = document.getElementById('app-icon');
				if (icon && app.artworkUrl512) icon.src = app.artworkUrl512;

				var urls = (app.screenshotUrls || app.ipadScreenshotUrls || []).slice(0, 6);
				urls.forEach(function (url) { addShot(shots, url); });
				if (urls.length) loadedLive = true;
			}
		} catch (e) { /* App Store unreachable — fall back to disk */ }

		if (!loadedLive) {
			loadCached(shots, appId);
		}
	});
})();
