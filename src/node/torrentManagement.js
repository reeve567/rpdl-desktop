const WebTorrent = require("webtorrent")
const parseTorrent = require("parse-torrent")
const createTorrent = require("create-torrent")
const bent = require("bent")
const fs = require("fs")
const path = require("path")
const sevenBin = require("7zip-bin")
const Seven = require("node-7z")
const rpdl = require("./rpdl.js")
const _ = require("lodash")
const settings = require("../settings.json")

const client = new WebTorrent()
const getJSON = bent("json")
const getBuffer = bent("buffer")
const activeDownloads = []
let installedGames = null

let torrentDownloadsPath = path.join("torrentDownloads")
let installedGamesPath = path.join("installedGames.json")
let gamesPath = settings["games_path"]

async function startDownloads() {
	if (installedGames == null) {
		installedGames = await getInstalledGames()
	}
	
	installedGames.forEach(game => {
		if (game.downloading && activeDownloads.indexOf(game.id) === -1) {
			installGame(game, null)
		}
	})
}

async function getInstalledGame(id) {
	return _.find(installedGames, function (game) {
		return game.id === id
	})
}

async function installGame(game, old) {
	if (!fs.existsSync(torrentDownloadsPath)) {
		fs.mkdirSync(torrentDownloadsPath)
	}
	
	activeDownloads.push(game.id)
	console.log("Deleting old game...")
	await deleteGame(old)
	
	_.remove(installedGames, (g) => {
		if (old != null) {
			return g.id === old.id && g.id === game.id
		} else {
			return g.id === game.id
		}
	})
	
	console.log("Downloading new game...")
	downloadTorrent(game)
	
	installedGames.push(game)
	
	await fs.promises.writeFile(installedGamesPath, JSON.stringify(installedGames))
	
	if (game.new_tags !== undefined && game.new_tags.length > 0) {
		game.tags.push(game.new_tags)
	}
	
	game.new_tags = []
	game.tags = _.flatten(game.tags)
	
	console.log("Game installing " + game.torrent_id)
}

async function downloadTorrent(game) {
	const gameInfoURL = rpdl.apiURL + "torrent/" + game.torrent_id
	const token = await rpdl.login(null, null, false)
	let magnetLink
	
	let response = await getJSON(gameInfoURL, null, {
		"authorization": "Bearer " + token
	})
	
	if (response.data.trackers[0].indexOf("announce/") === -1) {
		response = await getBuffer(gameInfoURL, null, {
			"authorization": "Bearer " + (await rpdl.login(null, null, true))
		})
		
		if (response.data.trackers[0].indexOf("announce/") === -1) {
			throw new Error("Announce URL is invalid")
		} else {
			magnetLink = response.data.magnet_link
		}
	} else {
		magnetLink = response.data.magnet_link
	}
	
	client.throttleDownload(settings["max_download_speed"])
	
	game.downloading = true
	
	client.add(rpdl.apiURL + "torrent/download/" + game.torrent_id, {
		announce: response.data.trackers,
		path: torrentDownloadsPath
	}, (torrent) => {
		const files = [];
		console.log("Added torrent to downloads " + game.title + "-" + game.torrent_id)
		console.log("Files:")
		torrent.files.forEach(file => {
			console.log(file.path)
			files.push(file.path)
		})
		console.log("")
		
		let done = false
		let progressReported = true
		let lastDate = new Date().getTime()
		let lastBytes = 0
		
		torrent.on("ready", () => {
			console.log("Torrent ready " + game.title)
		})
		
		torrent.on("error", (err) => {
			throw new Error(err)
		})
		
		torrent.on("download", async (bytes) => {
			progressReported = false
			lastBytes += bytes
			if (lastDate + 1000 < new Date().getTime()) {
				updateProgress(game.id, torrent.progress, 'i')
			}
			if (lastDate + 10_000 < new Date().getTime()) {
				console.log("Just downloaded " + lastBytes / 1_000_000 + " MB")
				console.log("Download speed is " + lastBytes / 10_000_000 + " MB/s")
				console.log("Progress is " + torrent.progress * 100 + " percent")
				lastBytes = 0
				lastDate = new Date().getTime()
			}
			
			if (torrent.progress >= 1) {
				progressReported = true
				
				client.remove(torrent, {}, (err) => {
					if (err) {
						throw err
					}
				})
			}
		})
		
		torrent.on("done", async () => {
			console.log(`Torrent finished downloading ${torrent.infoHash}`)
			updateProgress(game.id, 1, 'i')
			done = true
			
			while (!progressReported) {
				console.log("Waiting for progress to be reported...")
				await new Promise(resolve => setTimeout(resolve, 1000))
			}
			
			console.log("Done with progress, starting to extract...")
			
			game.downloading = false
			
			_.remove(activeDownloads, (id) => {
				return id === game.id
			})
			
			await fs.promises.writeFile(installedGamesPath, JSON.stringify(installedGames))
			
			let ext = files[0].split(".").pop()
			
			const gameDir = path.join(gamesPath, "" + game.id)
			
			if (!fs.existsSync(gamesPath)) {
				fs.mkdirSync(gamesPath)
			}
			
			if (!fs.existsSync(gameDir)) {
				fs.mkdirSync(gameDir)
			}
			
			const gameFile = path.join(gameDir, game.torrent_id + "." + ext)
			
			await fs.promises.rename("" + files[0], gameFile)
			let versionDir = path.join(gameDir, "" + game.torrent_id)
			if (!fs.existsSync(versionDir)) {
				fs.mkdirSync(versionDir)
			} else {
				fs.rmSync(versionDir, {
					recursive: true,
					force: true
				})
				fs.mkdirSync(versionDir)
			}
			
			console.log("Unzipping game...")
			const zipStream = await Seven.extractFull(gameFile, versionDir, {
				"recursive": true,
				"workingDir": ".",
				"$progress": false,
				"$bin": sevenBin.path7za,
				"$spawnOptions": {
					"detached": true
				}
			})
			
			zipStream.on("error", (err) => {
				console.log(JSON.stringify(err))
			})
			
			zipStream.on("end", async () => {
				console.log("Unzipped game")
				
				await fs.promises.readdir(versionDir, {
					withFileTypes: true
				}).then(async (files) => {
					for (const file of files) {
						if (file.isDirectory()) {
							let dir = path.join(versionDir, file.name)
							for (const file of await fs.promises.readdir(dir)) {
								console.log("Moved file " + path.join(dir, file) + " > " + path.join(versionDir, file))
								await fs.promises.rename(path.join(dir, file), path.join(versionDir, file))
							}
							
							await fs.promises.rmdir(dir)
						}
					}
				})
				
				await fs.promises.unlink(gameFile)
				
				await fs.promises.writeFile(installedGamesPath, JSON.stringify(installedGames))
			})
		})
	})
}

async function deleteTorrent(game) {
	try {
		await fs.promises.rm(path.join(torrentDownloadsPath, game.id, game.torrent_id + ".7z"))
	} catch (e) {
	}
	
	try {
		await fs.promises.rm(path.join(torrentDownloadsPath, game.id, game.torrent_id + ".zip"))
	} catch (e) {
	}
}

async function deleteGame(game) {
	if (game != null) {
		updateProgress(game.id, 0, 'u')
		await fs.promises.rm(path.join(gamesPath, "" + game.id, "" + game.torrent_id), {
			recursive: true,
			force: true
		})
		updateProgress(game.id, 25, 'u')
		_.remove(installedGames, function (g) {
			return g.id === game.id
		})
		await fs.promises.writeFile(installedGamesPath, JSON.stringify(installedGames))
		updateProgress(game.id, 50, 'u')
		await deleteTorrent(game)
	}
}

async function getInstalledGames() {
	if (installedGames == null) {
		fs.existsSync(installedGamesPath) ? installedGames = JSON.parse(await fs.promises.readFile(installedGamesPath, "utf8")) : installedGames = []
		return installedGames
	} else {
		return installedGames
	}
}

async function buildLibrary() {
	let games = await getInstalledGames()
	
	for (const game of games) {
		let gameDir = path.join(gamesPath, "" + game.id)
		if (!fs.existsSync(gameDir)) {
			fs.mkdirSync(gameDir)
		}
		
		let versionDir = path.join(gameDir, "" + game.torrent_id)
		if (!fs.existsSync(versionDir)) {
			let files = await fs.promises.readdir(gameDir, {
				withFileTypes: true
			})
			
			let folders = _.filter(files, (file, two) => {
				return file.isDirectory()
			})
			
			if (folders.length === 1) {
				game.torrent_id = parseInt(folders[0].name)
			} else {
				console.log("Game " + game.id + ` has too many/little versions (${folders.length})`)
			}
		}
	}
	
	await fs.promises.writeFile(installedGamesPath, JSON.stringify(games))
}

function updateProgress(id, progress, type) {
	const main = require("../main.js")
	
	main.getMainWindow().webContents.send("progress", {
		id: id,
		progress: progress,
		type: type
	})
}

module.exports = {
	installGame,
	deleteGame,
	getInstalledGames,
	getInstalledGame,
	startDownloads,
	buildLibrary,
	gamesPath
}