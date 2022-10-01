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
const getBuffer = bent("buffer")
const activeDownloads = []
let installedGames = null

let torrentFilesPath = path.join("torrents");
let torrentDownloadsPath = path.join("torrentDownloads")
let installedGamesPath = path.join("installedGames.json")
let gamesPath = path.join("games")

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

async function installGame(game, old) {
	if (!fs.existsSync(torrentFilesPath)) {
		fs.mkdirSync(torrentFilesPath)
	}
	
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
	const downloadURL = rpdl.apiURL + "torrent/download/" + game.torrent_id
	const torrentFile = path.join(torrentFilesPath, game.id + "-" + game.torrent_id + ".torrent")
	
	const token = await rpdl.login(null, null, false)
	
	let response = await getBuffer(downloadURL, null, {
		"authorization": "Bearer " + token
	})
	
	await fs.promises.writeFile(torrentFile, response)
	
	if (parseTorrent(fs.readFileSync(torrentFile)).announce[0].indexOf("announce/") === -1) {
		response = await getBuffer(downloadURL, null, {
			"authorization": "Bearer " + (await rpdl.login(null, null, true))
		})
		
		await fs.promises.writeFile(torrentFile, response)
		
		const file = parseTorrent(fs.readFileSync(torrentFile))
		
		if (parseTorrent(fs.readFileSync(torrentFile)).announce[0].indexOf("announce/") === -1) {
			throw new Error("Announce URL not found, you should probably check your login credentials")
		}
	}
	
	client.throttleDownload(settings["max-download-speed"])
	
	game.downloading = true
	
	client.add(torrentFile, {
		path: torrentDownloadsPath
	}, (torrent) => {
		console.log("Added torrent to downloads " + torrentFile)
		console.log("Files:")
		torrent.files.forEach(file => {
			console.log(file.path)
		})
		console.log("")
		
		let done = false
		let lastDate = new Date().getTime()
		let lastBytes = 0
		torrent.on("download", (bytes) => {
			if (done) {
				// seed or remove torrent
				client.remove(torrent, {}, (err) => {
					throw err
				})
			}
			lastBytes += bytes
			if (lastDate + 1000 < new Date().getTime()) {
				if (lastDate + 5000 < new Date().getTime()) {
					console.log("Just downloaded " + lastBytes / 1000000 + " MB")
					console.log("Download speed is " + lastBytes / 5000000 + " MB/s")
					console.log("Progress is " + torrent.progress * 100 + " percent")
					lastBytes = 0
					lastDate = new Date().getTime()
				}
				updateProgress(game.id, torrent.progress, 'i')
			}
		})
		
		torrent.on("done", async () => {
			console.log(`Torrent finished downloading ${torrent.infoHash}`)
			done = true
			
			game.downloading = false
			
			_.remove(activeDownloads, (id) => {
				return id === game.id
			})
			
			await fs.promises.writeFile(installedGamesPath, JSON.stringify(installedGames))
			
			let ext = torrent.files[0].path.split(".").pop()
			
			const gameDir = path.join(gamesPath, "" + game.id)
			
			if (!fs.existsSync(gamesPath)) {
				fs.mkdirSync(gamesPath)
			}
			
			if (!fs.existsSync(gameDir)) {
				fs.mkdirSync(gameDir)
			}
			
			await fs.promises.rename(torrent.files[0].path, path.join(gameDir, game.torrent_id + "." + ext))
			let versionDir = path.join(gameDir, "" + game.torrent_id)
			if (!fs.existsSync(versionDir)) {
				fs.mkdirSync(versionDir)
			}
			
			/*await new Promise(r => setTimeout(r, 3000))*/
			
			console.log("Unzipping game...")
			const zipStream = Seven.extractFull(path.join(gameDir, game.torrent_id + "." + ext), versionDir, {
				"recursive": true,
				"workingDir": ".",
				"$progress": false
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
				
				await fs.promises.writeFile(installedGamesPath, JSON.stringify(installedGames))
			})
		})
	})
}

async function deleteTorrent(game) {
	try {
		await fs.promises.unlink(path.join(torrentFilesPath, game.id + "-" + game.torrent_id + ".torrent"))
	} catch (e) {
	}
	updateProgress(game.id, .5, 'u')
	try {
		await fs.promises.unlink(path.join(torrentDownloadsPath, game.id, game.torrent_id + ".7z"))
	} catch (e) {
	}
	
	try {
		await fs.promises.unlink(path.join(torrentDownloadsPath, game.id, game.torrent_id + ".zip"))
	} catch (e) {
	}
	updateProgress(game.id, 1, 'u')
}

async function deleteGame(game) {
	if (game != null) {
		updateProgress(game.id, 0, 'u')
		_.remove(installedGames, {id: game.id})
		updateProgress(game.id, 25, 'u')
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
	downloadTorrent,
	deleteTorrent,
	deleteGame,
	getInstalledGames,
	startDownloads,
	gamesPath
}