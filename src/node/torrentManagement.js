const WebTorrent = require("webtorrent")
const parseTorrent = require("parse-torrent")
const createTorrent = require("create-torrent")
const bent = require("bent")
const fs = require("fs")
const path = require("path")
const {zip, unzip} = require("cross-unzip")
const rpdl = require("./rpdl.js")
const _ = require("lodash")
const settings = require("../settings.json")

const client = new WebTorrent()
const getBuffer = bent("buffer")
const activeDownloads = []
let installedGames = null

const torrentFilesPath = path.join(__dirname, "torrents")
const torrentDownloadsPath = path.join(__dirname, "torrentDownloads")
const installedGamesPath = path.join(__dirname, "installedGames.json")
const gamesPath = path.join(__dirname, "games")


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
	await downloadTorrent(game)
	
	installedGames.push(game)
	
	await fs.promises.writeFile(installedGamesPath, JSON.stringify(installedGames))
	
	game.tags.push(game.new_tags)
	game.new_tags = []
	game.tags = _.flatten(game.tags)
	
	console.log("Game installed " + game.torrent_id)
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
			if (lastDate + 5000 < new Date().getTime()) {
				console.log("Just downloaded " + lastBytes / 1000000 + " MB")
				console.log("Download speed is " + lastBytes / 5000000 + " MB/s")
				console.log("Progress is " + torrent.progress + " percent")
				lastBytes = 0
				lastDate = new Date().getTime()
			}
		})
		
		torrent.on("done", async () => {
			console.log(`Torrent finished downloading ${torrent.infoHash}`)
			done = true
			
			game.downloading = false
			_.remove(activeDownloads, (id) => {
				return id === game.id
			})
			
			let ext = torrent.files[0].path.split(".").pop()
			
			const gameDir = path.join(gamesPath, "" + game.id)
			
			if (!fs.existsSync(gameDir)) {
				fs.mkdirSync(gameDir)
			}
			
			await fs.promises.rename(torrent.files[0].path, path.join(gameDir, game.torrent_id + "." + ext))
			await unzip(path.join(gameDir, game.torrent_id + "." + ext), path.join(gameDir, "" + game.torrent_id), err => {
			
			})
			await fs.promises.writeFile(installedGamesPath, JSON.stringify(installedGames))
		})
	})
}

async function deleteTorrent(game) {
	await fs.promises.unlink(path.join(torrentFilesPath, game.torrent_id + ".torrent"))
	await fs.promises.unlink(path.join(torrentDownloadsPath, game.id, game.torrent_id + ".zip"))
	await fs.promises.unlink(path.join(torrentDownloadsPath, game.id, game.torrent_id + ".7z"))
}

async function deleteGame(game) {
	if (game != null) {
		_.remove(installedGames, {id: game.id})
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

module.exports = {
	installGame, downloadTorrent, deleteTorrent, deleteGame, getInstalledGames, startDownloads
}