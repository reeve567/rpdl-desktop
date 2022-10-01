const {
	contextBridge,
	ipcRenderer
} = require('electron')

// expose an event for a script on `index.html` to use
contextBridge.exposeInMainWorld('manager', {
	getGameTags: (game) => ipcRenderer.invoke("get-game-tags", game),
	getInstalledGames: () => ipcRenderer.invoke("get-installed-games"),
	checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),
	login: (username, password, refreshToken) => ipcRenderer.invoke("login", username, password, refreshToken),
	parseSearch: (query) => ipcRenderer.invoke("parse-search", query),
	search: (query, page) => ipcRenderer.invoke("search", query, page),
	download: (game, old) => ipcRenderer.invoke("download", game, old),
	remove: (game) => ipcRenderer.invoke("remove", game),
	resumeDownloads: () => ipcRenderer.invoke("resume-downloads"),
	openURL: (url) => ipcRenderer.invoke("open-url", url),
	openPath: (path) => ipcRenderer.invoke("open-path", path),
	getGameFolder: (id) => ipcRenderer.invoke("get-game-folder", id),
	getGameExecutable: (id) => ipcRenderer.invoke("get-game-executable", id),
	onProgress: (callback) => ipcRenderer.on("progress", callback),
})

window.addEventListener('DOMContentLoaded', async () => {
	const replaceText = (selector, text) => {
		const element = document.getElementById(selector)
		if (element) element.innerText = text
	}
	
	for (const dependency of ['chrome', 'node', 'electron']) {
		replaceText(`${dependency}-version`, process.versions[dependency])
	}
})