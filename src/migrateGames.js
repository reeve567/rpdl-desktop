const path = require("path")
const fs = require("fs")
const tm = require("./node/torrentManagement.js")
const settings = require("./settings.json")
const search = require("./search.js")
const _ = require("./web/lodash")
const bent = require("bent")

const json = bent("json", "GET")

let gamesPath = tm.gamesPath

function moveGame(game, result) {
	if (game.id !== result.id) {
		console.log("Game ID mismatch, fixing")
		
		let oldPath = path.join(gamesPath, "" + game.id)
		let newPath = path.join(gamesPath, "" + result.id)
		
		if (!fs.existsSync(oldPath)) {
			console.log("Old path (" + oldPath + ") doesn't exist, skipping")
			
			tm.updateGameInfo(result.id, game.id)
			return
		}
		
		fs.renameSync(oldPath, newPath)
	}
}

async function migrate() {
	const installedGames = await tm.getInstalledGames()
	_.forEach(installedGames, async (game) => {
		let query = game.title
		
		let ret = search.parseSearch(query + "*")
		
		let results = await json(settings["backend_url"] + "/searchGames", ret)
		
		
		if (results.length > 1) {
			let newResults = _.filter(results, (result) => {
				return result.torrent_id === game.torrent_id
			})
			
			if (newResults.length > 1) {
				console.log("What?")
			} else if (newResults.length === 0) {
				console.log("Couldn't find game " + game.id + " with torrent ID " + game.torrent_id)
			} else {
				moveGame(game, newResults[0])
			}
		} else if (results.length === 1) {
			moveGame(game, results[0])
		}
	})
}

migrate().then(() => {
	console.log("Done!")
})

setInterval(() => {
	console.log("Waiting for migration to finish...")
}, 10000)