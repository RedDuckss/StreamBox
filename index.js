/*
	This project was originally started as a personal project.

	The goal was (and is) to run this app on a Raspberry Pi board to
	have a personal "movie stream box".

	That is why these wifi controls are here, as they will eventually
	be used by the Pi to connect to the internet all within the context
	of this single app.
*/

/*const wifi = require('node-wifi');

wifi.init({
    iface: null
});


wifi.scan((error, networks) => {
    if (error) {
        throw new Error(error);
	}
	console.log(networks);
});


wifi.getCurrentConnections((error, connections) => {
    if (error) {
        throw new Error(error);
	}
	console.log(connections);
});
*/

const {BrowserWindow, app, ipcMain} = require('electron');
const sourcescrapper = require('sourcescrapper');
const path = require('path');
const url = require('url');
const got = require('got');
const fs = require('fs-extra');
const srt2vtt = require('srt2vtt');
const OS = require('opensubtitles-api');
const OpenSubtitles = new OS('OpenSubtitlesPlayer v4.7');
const scrappers = sourcescrapper.scrappers;

const API_KEYS = require('./keys');
const API_URLS = {
	TMDB: 'https://api.themoviedb.org/3',
	ODB: 'https://api.odb.to',
	TORRENT: 'http://api.apiumando.info/movie?cb=&quality=720p,1080p,3d&page=1'
};

let LOCAL_RESOURCES_ROOT;
if (isDev()) {
	require('electron-reload')(__dirname);
	LOCAL_RESOURCES_ROOT = __dirname;
} else {
	LOCAL_RESOURCES_ROOT = `${__dirname}/../`;
}

const DATA_ROOT = `${app.getPath('userData').replace(/\\/g, '/')}/app_data`;
const SUBTITLE_ROOT = `${DATA_ROOT}/cache/subtitles`;

fs.ensureDirSync(DATA_ROOT);
fs.ensureDirSync(SUBTITLE_ROOT);

let ApplicationWindow;

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') {
		app.quit(); // OSX
	}
});

app.on('ready', () => {
	ApplicationWindow = new BrowserWindow({
		title: 'NXUI',
		icon: `${LOCAL_RESOURCES_ROOT}/icon.ico`,
		minHeight: '300px',
		minWidth: '500px'
	});

	ApplicationWindow.setMenu(null);
	ApplicationWindow.maximize();

	ApplicationWindow.webContents.on('did-finish-load', () => {
		ApplicationWindow.show();
		ApplicationWindow.focus();
	});
		
	ApplicationWindow.loadURL(url.format({
		pathname: path.join(__dirname, '/app/index.html'),
		protocol: 'file:',
		slashes: true
	}));

	ApplicationWindow.on('closed', () => {
		ApplicationWindow = null;
	});

	ApplicationWindow.webContents.openDevTools();
});

ipcMain.on('ready', async event => {
	const response = await got(`${API_URLS.TMDB}/movie/now_playing?api_key=${pickRand(API_KEYS.TMDB)}`);
	const movies = JSON.parse(response.body);

	event.sender.send('media-list', movies);
});

ipcMain.on('search-media', async (event, search) => {
	const query = search.query;
	const page = (search.page ? search.page : 1);
	const response = await got(`${API_URLS.TMDB}/search/movie?query=${query}&page=${page}&api_key=${pickRand(API_KEYS.TMDB)}`);
	const movies = JSON.parse(response.body);

	event.sender.send('media-list', movies);
});

ipcMain.on('find-stream-data', async (event, search) => {
	const stream_data = {
		streams: []
	};

	const response = await got(`${API_URLS.TMDB}/movie/${search.id}?api_key=${pickRand(API_KEYS.TMDB)}`);
	const tmdb_metadata = JSON.parse(response.body);
	
	const subtitles = await OpenSubtitles.search({
		imdbid: tmdb_metadata.imdb_id
	});

	
	if (Object.keys(subtitles).length > 0) {
		const subtitle_metadata = {};
		fs.ensureDirSync(`${SUBTITLE_ROOT}/${tmdb_metadata.imdb_id}`);

		for (const lang in subtitles) {
			const subtitle = subtitles[lang];

			subtitle_metadata[subtitle.langcode] = {
				langcode: subtitle.langcode,
				lang: subtitle.lang,
				formats: {
					srt: `${SUBTITLE_ROOT}/${tmdb_metadata.imdb_id}/${subtitle.langcode}.srt`,
					vtt: `${SUBTITLE_ROOT}/${tmdb_metadata.imdb_id}/${subtitle.langcode}.vtt`,
				}
			};

			if (fs.pathExistsSync(`${SUBTITLE_ROOT}/${tmdb_metadata.imdb_id}/${subtitle.langcode}.vtt`)) {
				// assume that if vtt exists then the srt exists as well
				continue;
			}

			await downloadFile(subtitle.url, `${SUBTITLE_ROOT}/${tmdb_metadata.imdb_id}/${subtitle.langcode}.srt`);
			const vtt = await encodeSRTtoVTT(fs.readFileSync(`${SUBTITLE_ROOT}/${tmdb_metadata.imdb_id}/${subtitle.langcode}.srt`));
			
			fs.writeFileSync(`${SUBTITLE_ROOT}/${tmdb_metadata.imdb_id}/${subtitle.langcode}.vtt`, vtt);

		}

		stream_data.subtitles = subtitle_metadata;
		fs.writeJSONSync(`${SUBTITLE_ROOT}/${tmdb_metadata.imdb_id}/metadata.json`, subtitle_metadata);
	}

	stream_data.metadata = tmdb_metadata;

	try {
		const response = await got(`${API_URLS.TORRENT}&imdb=${tmdb_metadata.imdb_id}`);
		stream_data.torrent = JSON.parse(response.body);
	} catch (error) {
		console.log(error);
	}

	try {
		const response = await got(`https://api.odb.to/identity?imdb_id=${tmdb_metadata.imdb_id}&api_key=${pickRand(API_KEYS.ODB)}`);
		const streams = JSON.parse(response.body);
		if (streams.results.length > 0) {
			let scrapper;
			let scrap;
			let stream_url;
			let stream_meta;

			if (streams.results[0].streamData.openload) {
				stream_meta = streams.results[0].streamData.openload;
				stream_url = stream_meta.url;
				scrapper = scrappers.all.getFirstApplicable(stream_url);
				scrap = await scrapper.run(stream_url);
				if (scrap.info && scrap.info.source.length > 0) {
					stream_meta.stream = scrap.info.source[0].url;
					stream_data.streams.push(stream_meta);
				}
			}

			if (streams.results[0].streamData.streamango) {
				stream_meta = streams.results[0].streamData.streamango;
				stream_url = stream_meta.url;
				scrapper = scrappers.all.getFirstApplicable(stream_url);
				scrap = await scrapper.run(stream_url);
				if (scrap.info && scrap.info.source.length > 0) {
					stream_meta.stream = scrap.info.source[0].url;
					stream_data.streams.push(stream_meta);
				}
			}
		}
		
		event.sender.send('stream-data', stream_data);
	} catch (error) {
		console.log(error);
	}
});

// https://github.com/electron/electron/issues/7714#issuecomment-255835799
function isDev() {
	return process.mainModule.filename.indexOf('app.asar') === -1;
}

function pickRand(array) {
	return array[Math.floor(Math.random() * array.length)];
}

function downloadFile(url, file_path) {
	return new Promise((resolve) => {
		got.stream(url).pipe(fs.createWriteStream(file_path)).on('close', () => {
			resolve();
		});
	});
}

function encodeSRTtoVTT(srt) {
	return new Promise((resolve, reject) => {
		srt2vtt(srt, (error, vtt) => {
			if (error) {
				reject(error);
			} else {
				resolve(vtt);
			}
		});
	});
}