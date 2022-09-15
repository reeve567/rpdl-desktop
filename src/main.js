const {app, BrowserWindow, ipcMain } = require("electron")
const path = require("path")
const fs = require("fs")
const rpdl = require("./node/rpdl.js")
const tm = require("./node/torrentManagement.js")


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