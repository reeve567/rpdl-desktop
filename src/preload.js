const {
	contextBridge,
	ipcRenderer
} = require('electron')

// expose an event for a script on `index.html` to use
contextBridge.exposeInMainWorld('manager', {
	getInstalledGames: () => ipcRenderer.invoke("get-installed-games"),
	checkUpdates: () => ipcRenderer.invoke("check-for-updates"),
	login: (username, password, refreshToken) => ipcRenderer.invoke("login", username, password, refreshToken),
	parseSearch: (query) => ipcRenderer.invoke("parse-search", query),
	search: (query, page) => ipcRenderer.invoke("search", query, page),
	download: (game, old) => ipcRenderer.invoke("download", game, old),
	remove: (game) => ipcRenderer.invoke("remove", game),
	resumeDownloads: () => ipcRenderer.invoke("resume-downloads"),
	openURL: (url) => ipcRenderer.invoke("open-url", url),
	openPath: (path) => ipcRenderer.invoke("open-path", path),
	getGameFolder: (game) => ipcRenderer.invoke("get-game-folder", game),
	getGameExecutable: (game) => ipcRenderer.invoke("get-game-executable", game),
	onProgress: (callback) => ipcRenderer.on("progress", callback),
	getSettings: () => ipcRenderer.invoke("get-settings"),
	downloadCover: (game) => ipcRenderer.invoke("download-cover", game),
	buildLibrary: () => ipcRenderer.invoke("build-library"),
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