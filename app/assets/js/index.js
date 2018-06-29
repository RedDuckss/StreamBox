/* eslint-env browser */

const {ipcRenderer} = require('electron');

const master_media_list = document.querySelector('.media-list');
const player = document.querySelector('.player');
const video = player.querySelector('video');
const loader = document.querySelector('.loader');
const loader_message = loader.querySelector('h2');
const modal = document.querySelector('.modal');

function addEvent(object, event, func) {
	object.addEventListener(event, func, true);
}

function showLoader(message = 'Loading...') {
	loader_message.innerHTML = message;
	loader.classList.add('show');
}
function hideLoader() {
	loader.classList.remove('show');
}

function searchForMedia() {
	showLoader('Searching...');

	const query = document.querySelector('input[name="media_search"]').value;
	ipcRenderer.send('search-media', {
		query
	});
}

function findStreamURLs(id) {
	showLoader('Getting movie stream metadata...');

	ipcRenderer.send('find-stream-data', {
		id
	});
}

function showModal(metadata) {
	const links = modal.querySelector('.links');
	const poster = modal.querySelector('.poster');
	links.innerHTML = '';

	console.log(metadata);

	if (metadata.streams.length > 0) {
		const stream_button = document.createElement('button');
		stream_button.innerText = 'Stream';

		addEvent(stream_button, 'click', () => {
			startStream(metadata);
		});

		links.appendChild(stream_button);
	} else {
		console.log(57, 'ERROR');
	}

	if (metadata.torrent) {
		const torrent_button = document.createElement('button');
		torrent_button.innerText = 'Download';
		//links.appendChild(torrent_button);
	} else {
		console.log(65, 'ERROR');
	}

	poster.src = `https://image.tmdb.org/t/p/original${metadata.metadata.poster_path}`;

	modal.classList.add('show');
}

function closeModal() {
	modal.classList.remove('show');
}

function startStream(metadata) {
	showLoader('(This may take a bit) Loading stream...');
	const stream = metadata.streams[0].stream;
	const subtitles = metadata.subtitles;

	if (video.src !== stream) {
		
		video.querySelectorAll('track').forEach(element => {
			video.removeChild(element);
		});

		for (const lang in subtitles) {
			const subtitle = subtitles[lang];
			const track = document.createElement('track');

			track.kind = 'subtitles';
			track.srclang = subtitle.langcode;
			track.label = subtitle.lang;
			track.src = subtitle.formats.vtt;

			if (track.srclang == 'en') {
				track.default = true;
			}

			video.appendChild(track);
		}
		
		video.src = stream;
	} else {
		video.play();
		video.classList.add('fullscreen');
	}
}

(() => {
	addEvent(document.querySelector('input[name="media_search"]'), 'keypress', event => {
		if (event.keyCode == 13) { // 'Enter'
			searchForMedia();
		}
	});

	addEvent(document.querySelector('button[for="media_search"]'), 'click', () => {
		searchForMedia();
	});

	addEvent(document.querySelector('.close'), 'click', () => {
		closeModal();
	});

	addEvent(video, 'playing', () => {
		video.classList.add('fullscreen');
		hideLoader();
	});

	addEvent(document, 'keydown', event => {
		if (event.keyCode == 27) { // 'Esc'
			const playing_player = document.querySelector('video.fullscreen');
			if (playing_player) {
				playing_player.pause();
				playing_player.classList.remove('fullscreen');
			}
		}
	});

	ipcRenderer.send('ready');

	hideLoader();
})();

ipcRenderer.on('media-list', (event, media_list) => {
	master_media_list.innerHTML = '';

	for (const media of media_list.results) {
		const template = document.querySelector('[template="media"]').content.firstElementChild.cloneNode(true);
		
		const title = template.querySelector('.title');
		const poster = template.querySelector('.poster');

		title.innerHTML = media.title;
		poster.src = `https://image.tmdb.org/t/p/original${media.poster_path}`;

		addEvent(template, 'click', () => {
			findStreamURLs(media.id);
		});

		master_media_list.appendChild(template);
	}

	hideLoader();
});

ipcRenderer.on('stream-data', (event, stream_data) => {
	/*
	if (stream_data.streams.results.length <= 0 && !stream_data.torrent) {
		alert('No streams or torrents for this movie exist');
		return hideLoader();
	}

	if (!stream_data.streams.results[0].streamData.openload && !stream_data.streams.results[0].streamData.streamango) {
		alert('No streams or torrents for this movie exist');
		return hideLoader();
	}
	*/

	if (stream_data.streams.length <= 0) {
		alert('No streams found for this movie.');
		return hideLoader();
	}

	hideLoader();
	showModal(stream_data);
});