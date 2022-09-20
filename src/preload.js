const {contextBridge, ipcRenderer} = require('electron')

// expose an event for a script on `index.html` to use
contextBridge.exposeInMainWorld('manager', {
	getGameTags: (game) => ipcRenderer.invoke("get-game-tags", game),
	getInstalledGames: () => ipcRenderer.invoke("get-installed-games"),
	checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),
	login: (username, password, refreshToken) => ipcRenderer.invoke("login", username, password, refreshToken),
	search: (query, page) => ipcRenderer.invoke("search", query, page),
	download: (game, old) => ipcRenderer.invoke("download", game, old),
	resumeDownloads: () => ipcRenderer.invoke("resume-downloads"),
	getF95Info: (id) => ipcRenderer.invoke("get-f95-info", id),
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