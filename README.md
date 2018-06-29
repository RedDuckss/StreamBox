# Stream Box

A NodeJS/Electron app for watching, streaming and downloading movies

## Implemented

- [x] Movie searching
- [x] Movie streaming
- [ ] Movie downloading (torrent)
- [ ] TV support
- [x] Movie subtitles
- [ ] WiFi/Internet controls
- [ ] Better, more finalized, UI/UX

## What's in use

Stream box runs on NodeJS utilizing Electron to build the GUI.

**APIs**:

- [themoviedb](https://www.themoviedb.org/) (Movie metadata and searching)
- [odb](https://odb.to) (Movie stream links)
- apiumando (torrent links)
- [opensubtitles](https://opensubtitles.org) (subtitles)

## Plans/Future changes

- Currently Stream Box uses only TMDB for movie metadata. This service seems somewhat unreliable, and a fallback onto another service like OMDB or the IMDB datasets would be nice
- Currently onlu odb is used for movie streaming. This service doesn't seem to have been maintained since 2014. While the service still seems to function and has up-to-date movies, given it's age and seemingly unreliability at times it might go down. Perhaps scrapping sites would be better?
- Currently I am cheating with opensubtitles by using someone elses UA. A different, more open, service would probably be better. The subtitles also often don't line up very well

It might be worth it to look into making a custom API that aggregates the required data on it's end, and have Stream Box query _it_ instead?