// noinspection TypeScriptUMDGlobal

const login = document.getElementById("login-button")
const loginForm = document.getElementById("login-form")
const loginOverlay = document.getElementById("overlay-bg-login")

const search = document.getElementById("search-input")
const searchForm = document.getElementById("search-form")
const searchOverlay = document.getElementById("overlay-bg-search")

const searchButton = document.getElementById("search-button")
const searchClose = document.getElementById("search-close")

const mainContent = document.getElementById("main-content")
const gameTitle = document.getElementById("game-title")
const gameVersion = document.getElementById("game-version")
const tagDisplay = document.getElementById("tags")
const descriptionDisplay = document.getElementById("description")
const linksDisplay = document.getElementById("links")

let currentGame;

function getGameItem(game, num) {
	let version
	let id
	let otherButtons
	let type
	let classes
	
	console.log(num)
	
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

function openSearch() {
	searchOverlay.style.display = "block"
}

function closeSearch() {
	searchOverlay.style.display = "none"
}

function updateInstalled() {
	document.getElementById("sidebar").innerHTML = ""
	
	window.manager.getInstalledGames().then((games) => {
		_.forEach(games, (game) => {
			document.getElementById("sidebar").innerHTML += getGameItem(game)
		})
		
		_.forEach(games, (game) => {
			document.getElementById(`installed-${game.id}`).addEventListener("click", () => {
				openGame(game)
			})
		})
	})
}

async function openGame(game) {
	currentGame = game
	
	tagDisplay.innerHTML = ""
	
	gameTitle.innerHTML = game.title
	if (game.version !== "") {
		gameVersion.innerHTML = game.version
	} else {
		gameVersion.innerHTML = "Final"
	}
	
	_.forEach(game.tags, (tag) => {
		tagDisplay.innerHTML += getTag(tag)
	})
	
	_.forEach(game.new_tags, (tag) => {
		tagDisplay.innerHTML += getNewTag(tag)
	})
	
	descriptionDisplay.innerHTML = game.description
	
	closeSearch()
	mainContent.style.display = "block"
}

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
