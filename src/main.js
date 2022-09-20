const {app, BrowserWindow, ipcMain } = require("electron")
const path = require("path")
const fs = require("fs")
const rpdl = require("./node/rpdl.js")
const tm = require("./node/torrentManagement.js")
const bent = require("bent")

const json = bent("json", "GET")
const settings = require("./settings.json")

const querySearch = /[^\[({]*/

function findTorrentFiles() {
	let files = []
	fs.readdirSync(torrentFilesPath).forEach((file) => {
		files.push(file)
	})
	
	return files.filter((file) => {
		return file.endsWith(".torrent")
	})
}

const createWindow = () => {
	const win = new BrowserWindow({
		width: 800,
		height: 600,
		webPreferences: {
			preload: path.join(__dirname, "preload.js")
		}
	})
	
	win.loadFile("index.html")
}

app.whenReady().then(() => {
	ipcMain.handle("get-installed-games", async (event) => {
		return await tm.getInstalledGames()
	})
	
	ipcMain.handle("get-game-tags", async (event, game) => {
		// TODO: get from backend
	})
	
	ipcMain.handle("check-for-updates", async (event) => {
		return await rpdl.findUpdates(await tm.getInstalledGames())
	})
	
	ipcMain.handle("login", async (event, username, password, refreshToken) => {
		return await rpdl.login(username, password, refreshToken)
	})
	
	ipcMain.handle("download", async (event, game, old) => {
		await tm.installGame(game, old)
	})
	
	ipcMain.handle("resume-downloads", async (event) => {
		await tm.startDownloads()
	})
	
	ipcMain.handle("get-f95-info", async (event, id) => {
		return await json(settings.backendURL + "/getF95Info?game=" + id)
	})
	
	ipcMain.handle("search", async (event, query) => {
		let andTagString = query.substring(query.indexOf("[") + 1, query.indexOf("]"))
		let and_tags = andTagString.split(",").map((tag) => {
			
			return tag.trim().toLowerCase().replaceAll(/[^a-zA-Z0-9\-. ]/g, "")
		}).filter((tag) => {
			return tag.length > 0
		})
		
		let orTagString = query.substring(query.indexOf("{") + 1, query.indexOf("}"))
		let or_tags = orTagString.split(",").map((tag) => {
			return tag.trim().toLowerCase().replaceAll(/[^a-zA-Z0-9\-. ]/g, "")
		}).filter((tag) => {
			return tag.length > 0
		})
		
		let notTagString = query.substring(query.indexOf("<") + 1, query.indexOf(">"))
		let not_tags = notTagString.split(",").map((tag) => {
			return tag.trim().toLowerCase().replaceAll(/[^a-zA-Z0-9\-. ]/g, "")
		}).filter((tag) => {
			return tag.length > 0
		})
		
		let engine = query.substring(query.indexOf("(") + 1, query.indexOf(")"))
		
		let search_term = querySearch.exec(query)[0]
		
		console.log(and_tags, or_tags, not_tags, engine, search_term)
		
		return await json(settings.backendURL + "/searchGames", {
			and_tags: and_tags,
			or_tags: or_tags,
			not_tags: not_tags,
			engine: engine.toLowerCase(),
			query: search_term.replaceAll(/[^a-zA-Z0-9\-.]/g, "")
		})
	})
	
	tm.getInstalledGames().then(r => {
		console.log("loaded games")
	})
	createWindow()
	
	app.on("activate", () => {
		if (BrowserWindow.getAllWindows().length === 0) {
			createWindow()
		}
	})
})

app.on("window-all-closed", () => {
	if (process.platform !== "darwin") {
		app.quit()
	}
})