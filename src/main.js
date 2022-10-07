const {
	app,
	BrowserWindow,
	ipcMain
} = require("electron")
const path = require("path")
const fs = require("fs")
const rpdl = require("./node/rpdl.js")
const tm = require("./node/torrentManagement.js")
const bent = require("bent")
const rp = require("request-promise")
const childProcess = require("child_process")

const json = bent("json", "GET")
const buffer = bent("buffer", "GET")
const settings = require("./settings.json")
const _ = require("./web/lodash");
const timeDataPath = path.join("./playtime.json")

let timeData

if (fs.existsSync(timeDataPath)) {
	timeData = JSON.parse(fs.readFileSync(timeDataPath, {encoding: "utf8"}))
} else {
	timeData = {}
}

const querySearch = /[^\[({]*/
let win

const createWindow = () => {
	win = new BrowserWindow({
		width: 1200,
		height: 800,
		webPreferences: {
			preload: path.join(__dirname, "preload.js")
		}
	})
	
	win.loadFile("index.html")
}

function getMainWindow() {
	return win
}

module.exports = {
	getMainWindow
}

function parseSearch(query) {
	let and_tags_string = query.substring(query.indexOf("[") + 1, query.indexOf("]"))
	let and_tags = and_tags_string.split(",").map((tag) => {
		
		return tag.trim().toLowerCase()
	}).filter((tag) => {
		return tag.length > 0
	})
	
	let or_tags_string = query.substring(query.indexOf("{") + 1, query.indexOf("}"))
	let or_tags = or_tags_string.split(",").map((tag) => {
		return tag.trim().toLowerCase()
	}).filter((tag) => {
		return tag.length > 0
	})
	
	let not_tags_string = query.substring(query.indexOf("<") + 1, query.indexOf(">"))
	let not_tags = not_tags_string.split(",").map((tag) => {
		return tag.trim().toLowerCase()
	}).filter((tag) => {
		return tag.length > 0
	})
	
	let engine = query.substring(query.indexOf("(") + 1, query.indexOf(")"))
	
	let search_term = querySearch.exec(query)[0]
	
	return {
		and_tags: and_tags,
		or_tags: or_tags,
		not_tags: not_tags,
		engine: engine.toLowerCase(),
		query: search_term.replaceAll(/[^a-zA-Z0-9-. ]/g, "")
	}
}

app.commandLine.appendSwitch("trace-warnings", "true")

app.whenReady().then(() => {
	app.commandLine.appendSwitch("trace-warnings", "true")
	
	ipcMain.handle("get-installed-games", async (event) => {
		return await tm.getInstalledGames()
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
	
	ipcMain.handle("remove", async (event, game) => {
		await tm.deleteGame(game)
	})
	
	ipcMain.handle("resume-downloads", async (event) => {
		await tm.startDownloads()
	})
	
	ipcMain.handle("get-f95-info", async (event, id) => {
		return await json(settings["backend_url"] + "/getF95Info?game=" + id)
	})
	
	ipcMain.handle("parse-search", (event, query) => {
		return parseSearch(query)
	})
	
	ipcMain.handle("search", async (event, query) => {
		let ret = parseSearch(query)
		
		return await json(settings["backend_url"] + "/searchGames", ret)
	})
	
	ipcMain.handle("open-url", async (event, url) => {
		// Could make a custom window to pop up for it
		await require("electron").shell.openExternal(url)
	})
	
	ipcMain.handle("open-path", async (event, file_path) => {
		if (file_path.indexOf(".exe") !== -1) {
			const split = file_path.split(path.sep)
			const torrent_id = split[split.length - 2]
			const id = split[split.length - 3]
			
			let game = childProcess.spawn(file_path)
			game.once("spawn", async () => {
				let stop = false
				game.once("close", () => {
					stop = true
				})
				
				if (timeData[id] === undefined) {
					timeData[id] = {}
				}
				
				if (timeData[id][torrent_id] === undefined) {
					timeData[id][torrent_id] = 0
				}
				
				while (!stop) {
					await new Promise(r => setTimeout(r, 5000))
					timeData[id][torrent_id] += 5
					timeData[id]["last_played"] = _.now()
					
					fs.writeFileSync(timeDataPath, JSON.stringify(timeData), {
						encoding: "utf8"
					})
				}
			})
			
		} else {
			await require("electron").shell.openPath(file_path)
		}
	})
	
	ipcMain.handle("get-game-folder", async (event, game) => {
		return path.resolve(path.join(tm.gamesPath, "" + game.id, "" + game.torrent_id))
	})
	
	ipcMain.handle("get-game-executable", async (event, game) => {
		const gameDir = path.join(tm.gamesPath, "" + game.id)
		const version = game.torrent_id
		const versionDir = path.join(gameDir, "" + version)
		
		const files = await fs.promises.readdir(versionDir)
		
		const executables = _.filter(files, (file) => {
			// Make this work on linux
			return file.endsWith(".exe") && !file.endsWith("-32.exe") && !file.endsWith("Handler64.exe")
		})
		
		if (executables.length === 1) {
			return path.resolve(versionDir, executables[0])
		} else {
			console.error("Could not figure out what the executable is! " + game.id + "-" + game.torrent_id)
		}
		
	})
	
	ipcMain.handle("get-settings", (event) => {
		return settings
	})
	
	ipcMain.handle("download-cover", async (event, game) => {
		const coverPathPNG = path.join(tm.gamesPath, "" + game.id, "cover.jpg")
		const coverPathGIF = path.join(tm.gamesPath, "" + game.id, "cover.gif")
		const coverPathJPG = path.join(tm.gamesPath, "" + game.id, "cover.png")
		let base64
		let coverPath
		
		if (!fs.existsSync(coverPathPNG) && !fs.existsSync(coverPathJPG) && !fs.existsSync(coverPathGIF)) {
			const html = await rp("https://f95zone.to/threads/" + game.thread_id + "/")
			const regex = /src="(https:\/\/attachments|https:\/\/media.giphy)([^"]*)"/g
			
			const res = regex.exec(html)
			
			let link = res[1] + res[2]
			
			link = link.replace("/thumb", "")
			
			if (!fs.existsSync(tm.gamesPath)) {
				fs.mkdirSync(tm.gamesPath)
			}
			
			if (!fs.existsSync(path.join(tm.gamesPath, "" + game.id))) {
				fs.mkdirSync(path.join(tm.gamesPath, "" + game.id))
			}
			
			let ext = link.split(".").pop()
			
			if (ext === "png" || ext === "jpg" || ext === "gif") {
				coverPath = eval(`coverPath${ext.toUpperCase()}`)
			} else {
				console.error("Unknown cover extension: " + ext)
				return
			}
			
			const image = await rp(link, { encoding: null })
			
			fs.writeFileSync(coverPath, image)
			
		} else {
			if (fs.existsSync(coverPathPNG)) {
				coverPath = coverPathPNG
			} else if (fs.existsSync(coverPathJPG)) {
				coverPath = coverPathJPG
			} else if (fs.existsSync(coverPathGIF)) {
				coverPath = coverPathGIF
			}
		}
		
		base64 = (await fs.promises.readFile(coverPath)).toString("base64")
		return `data:image/${coverPath.split(".").pop()};base64,${base64}`
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
		console.log("Closing...")
		//console.log(JSON.stringify(timeData))
		fs.writeFileSync(timeDataPath, JSON.stringify(timeData), {
			encoding: "utf8"
		})
		// TODO: allow the program to run in the background so that you can track time while it's somewhat closed
		app.quit()
	}
})