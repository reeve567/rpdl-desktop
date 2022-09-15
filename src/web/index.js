const login = document.getElementById("login-button")
const loginForm = document.getElementById("login-form")
const loginOverlay = document.getElementById("overlay-bg-login")

const search = document.getElementById("search-input")
const searchForm = document.getElementById("search-form")
const searchOverlay = document.getElementById("overlay-bg-search")

function getGameItem(game) {
	return `<div class="h-fit flex px-2.5 py-1"><a id="${game.id}">${game.title}</a><p class="pl-1 text-gray-500">${game.version}</p></div>`
}

window.manager.login(null, null, false).then((result) => {
	if (result != null) {
		document.getElementById("overlay-bg-login").style.display = "none"
	}
})

window.manager.getInstalledGames().then((games) => {
	Object.values(games).forEach((game) => {
		document.getElementById("sidebar").innerHTML += getGameItem(game)
	})
})

window.manager.resumeDownloads().then(() => {
	// done
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

searchForm.addEventListener("submit", async (e) => {
	e.preventDefault()
	const query = search.value
	
	console.log("searching for", query)
	
	window.manager.search(query).then((games) => {
		console.log("done searching")

		document.getElementById("search-results").innerHTML = ""
		
		Object.values(games).forEach((game) => {
			document.getElementById("search-results").innerHTML += getGameItem(game)
		})

		console.log("done rendering")
	})
})

