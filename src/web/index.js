// noinspection TypeScriptUMDGlobal
const login = document.getElementById("login-button")
const loginForm = document.getElementById("login-form")
const loginOverlay = document.getElementById("overlay-bg-login")

const search = document.getElementById("search-input")
const searchForm = document.getElementById("search-form")
const searchOverlay = document.getElementById("overlay-bg-search")

const filter = document.getElementById("filter")

const searchButton = document.getElementById("search-button")
const searchClose = document.getElementById("search-close")

const noGame = document.getElementById("no-selected")

const mainContent = document.getElementById("main-content")
const gameTitle = document.getElementById("game-title")
const gameVersion = document.getElementById("game-version")
const tagDisplay = document.getElementById("tags")
const coverDisplay = document.getElementById("cover")
const descriptionDisplay = document.getElementById("description")
const linksDisplay = document.getElementById("links")
let installButton = document.getElementById("install-current")
let uninstallButton = document.getElementById("uninstall-current")
const sizeDisplay = document.getElementById("size-current")
let playButton = document.getElementById("play-current")
const openFolder = document.getElementById("open-folder")
const progressBar = document.getElementById("progress-bar")

let currentGame
let updateInstallBar
let updateUninstallBar

function getGameItem(game, num) {
	let version
	let id
	let otherButtons
	let type
	let classes
	
	if (num !== undefined) {
		id = `search-${num}`
		otherButtons = `<a id="install-${num}" class="float-right inline cursor-pointer">Install</a><a id="view-${num}" class="float-right inline pr-2 cursor-pointer">View</a>`
		type = "div"
		classes = ""
	} else {
		id = `installed-${game.id}`
		otherButtons = ""
		type = "a"
		classes = "cursor-pointer"
	}
	
	if (game.version !== "") {
		version = game.version
	} else {
		version = "Final"
	}
	
	return `<${type} id="${id}" class="searchResult ${classes}">${game.title}<p class="pl-1 text-gray-400 inline">${version}</p>${otherButtons}</${type}>`
}

function getTag(tag) {
	return `<li class="text-gray-400 border-dotted border-2 border-gray-500 px-1 mx-2 my-1">${tag}</li>`
}

function getNewTag(tag) {
	return `<li class="text-gray-400 border-dotted border-2 border-gray-300 px-1 mx-2 my-1">${tag}</li>`
}

function getLink(key) {
	return `<li id="${key}" class="text-cyan-300 text-xl px-1 underline decoration-dotted decoration-gray-400 cursor-pointer"><a>${key}</a></li>`
}

function openSearch() {
	searchOverlay.style.display = "block"
}

function closeSearch() {
	searchOverlay.style.display = "none"
}

async function updateInstalled() {
	document.getElementById("sidebar").innerHTML = ""
	
	const ret = await window.manager.parseSearch(filter.value)
	
	window.manager.getInstalledGames().then((games) => {
		const filtered = _.filter(games, (game) => {
			return (ret.query === "" || game.description.toLowerCase().indexOf(ret.query) !== -1 || game.title.toLowerCase().indexOf(ret.query) !== -1) &&
			       (ret.and_tags.length === 0 || _.difference(game.tags, ret.and_tags).length === game.tags.length - ret.and_tags.length) &&
			       (ret.or_tags.length === 0 || _.difference(game.tags, ret.or_tags).length !== game.tags.length) &&
			       (ret.not_tags.length === 0 || _.difference(game.tags, ret.not_tags).length === game.tags.length) &&
			       (ret.engine.length === 0 || game.category.name.toLowerCase() === ret.engine)
		})
		
		const sorted = _.sortBy(filtered, ['title'])
		
		_.forEach(sorted, (game) => {
			document.getElementById("sidebar").innerHTML += getGameItem(game)
		})
		
		_.forEach(sorted, (game) => {
			document.getElementById(`installed-${game.id}`).addEventListener("click", () => {
				openGame(game)
			})
		})
	})
}

function closeGame() {
	mainContent.style.display = "none"
	noGame.style.display = "block"
}

async function openGame(game) {
	currentGame = game
	
	tagDisplay.innerHTML = ""
	
	gameTitle.innerHTML = game.title
	if (game.version !== "") {
		gameVersion.innerHTML = `v${game.version}`
	} else {
		gameVersion.innerHTML = "Final"
	}
	
	gameVersion.innerHTML += ` - ${game.rating}★`
	
	_.forEach(game.tags, (tag) => {
		tagDisplay.innerHTML += getTag(tag)
	})
	
	_.forEach(game.new_tags, (tag) => {
		tagDisplay.innerHTML += getNewTag(tag)
	})
	
	linksDisplay.innerHTML = ""
	coverDisplay.src = ""
	coverDisplay.style.display = "none"
	
	window.manager.downloadCover(game).then((base64) => {
		if (game.id === currentGame.id) {
			coverDisplay.src = base64
			coverDisplay.style.display = "block"
		}
	})
	
	_.forIn(game.links, (link, key) => {
		linksDisplay.innerHTML += getLink(key)
	})
	
	_.forIn(game.links, (link, key) => {
		document.getElementById(key).addEventListener("click", () => {
			window.manager.openURL(link)
		})
	})
	
	descriptionDisplay.innerHTML = game.description
	
	let clone = installButton.cloneNode(true)
	installButton.text = ""
	installButton.replaceWith(clone)
	installButton = clone
	installButton.addEventListener("click", () => {
		console.log("Starting download...")
		window.manager.download(game, null)
	})
	
	const installedGames = await window.manager.getInstalledGames()
	if (installedGames.find((installedGame) => installedGame.id === game.id)) {
		clone = uninstallButton.cloneNode(true)
		uninstallButton.replaceWith(clone)
		uninstallButton = clone
		uninstallButton.addEventListener("click", () => {
			window.manager.remove(game)
			updateInstalled()
			closeGame()
		})
		
		updateUninstallBar = data => {
			if (data.id === currentGame.id) {
				progressBar.classList.remove("bg-gray-600")
				progressBar.classList.remove("bg-green-700")
				if (!progressBar.classList.contains("bg-red-700")) progressBar.classList.add("bg-red-700")
				progressBar.style.width = `${data.progress * 100}%`
				progressBar.innerHTML = `${Math.round(data.progress * 100)}%`
				
				if (data.progress >= 1) {
					setTimeout(() => {
						openGame(game)
					}, 2000)
				}
			}
		}
		
		clone = playButton.cloneNode(true)
		playButton.replaceWith(clone)
		playButton = clone
		playButton.addEventListener("click", async () => {
			window.manager.openPath(await window.manager.getGameExecutable(game))
		})
	}
	
	progressBar.innerHTML = ""
	
	progressBar.classList.remove("bg-green-700")
	progressBar.classList.remove("bg-red-700")
	progressBar.classList.add("bg-gray-600")
	
	updateInstallBar = async function (data) {
		if (data.id === currentGame.id) {
			progressBar.classList.remove("bg-gray-600")
			progressBar.classList.remove("bg-red-700")
			if (!progressBar.classList.contains("bg-green-700")) progressBar.classList.add("bg-green-700")
			progressBar.style.width = `${data.progress * 100}%`
			progressBar.innerHTML = `${Math.round(data.progress * 100)}%`
			
			if (data.progress >= 1) {
				setTimeout(() => {
					openGame(game)
				}, 2000)
			}
		}
	}
	
	closeSearch()
	noGame.style.display = "none"
	mainContent.style.display = "block"
}

window.manager.onProgress((_event, data) => {
	if (data.type === 'i') {
		updateInstallBar(data)
	} else if (data.type === 'u') {
		updateUninstallBar(data)
	}
})

window.manager.login(null, null, false).then((result) => {
	if (result != null) {
		document.getElementById("overlay-bg-login").style.display = "none"
	}
})

updateInstalled()

window.manager.resumeDownloads().then(() => {
	// done
})

searchButton.addEventListener("click", () => {
	openSearch()
})

searchClose.addEventListener("click", () => {
	closeSearch()
})

searchForm.addEventListener("submit", async (e) => {
	e.preventDefault()
	const query = search.value
	
	console.log("searching for", query)
	
	window.manager.search(query).then((games) => {
		console.log("done searching")
		
		document.getElementById("search-results").innerHTML = ""
		
		for (let i = 0; i < Math.min(12, games.length); i++) {
			document.getElementById("search-results").innerHTML += getGameItem(games[i], i)
		}
		
		for (let i = 0; i < Math.min(12, games.length); i++) {
			document.getElementById(`install-${i}`).addEventListener("click", () => {
				window.manager.download(games[i], null).then(() => {
					updateInstalled()
				})
			})
			
			document.getElementById(`view-${i}`).addEventListener("click", () => {
				console.log("clicked")
				openGame(games[i])
			})
		}
		
		console.log("done rendering")
	})
})

filter.addEventListener("input", (e) => {
	updateInstalled()
})

login.addEventListener("click", async (e) => {
	e.preventDefault()
	const username = loginForm.username.value
	const password = loginForm.password.value
	
	let result = await window.manager.login(username, password)
	
	if (result === null) {
		// invalid login credentials
	} else {
		loginOverlay.style.display = "none"
	}
})

openFolder.addEventListener("click", async (e) => {
	e.preventDefault()
	
	window.manager.openPath(await window.manager.getGameFolder(currentGame))
})

async function checkForUpdates() {
	const settings = await window.manager.getSettings()
	do {
		const updates = await window.manager.checkUpdates()
		console.log("Updates: ", updates)
		if (settings["auto_update"]) {
			// TODO : install a game or two here
		}
		await new Promise(resolve => setTimeout(resolve, 1000 * 60 * 5))
	} while (settings["auto_update"])
}

checkForUpdates().then(r => console.log("done checking for updates"))