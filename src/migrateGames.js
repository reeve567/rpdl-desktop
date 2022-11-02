const path = require("path")
const fs = require("fs")
const tm = require("./node/torrentManagement.js")
const settings = require("./settings.json")
const search = require("./search.js")
const _ = require("./web/lodash")
const bent = require("bent")

const json = bent("json", "GET")

let gamesPath = settings["games_path"]

async function migrate() {
	const installedGames = await tm.getInstalledGames()
	console.log(installedGames)
	_.forEach(installedGames, async (game) => {
		console.log("Migrating game " + game.id)
		let query = game.name
		
		let ret = search.parseSearch(query)
		
		let results = await json(settings["backend_url"] + "/searchGames", ret)
		
		console.log(results)
		console.log("Done migrating game " + game.id)
	})
}

migrate().then(() => {
	console.log("Done!")
})


while (true) {
	
}

