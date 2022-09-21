const rp = require("request-promise-native")
const fs = require("fs")
const path = require("path")
const settings = require("../settings.json")
const _ = require("lodash")

const regExp = {
	markdown: /(?<=\[(?<linkName>.{1,30})\] ?\()(?<link>[^\n\r)]+)/g,
	threadID: /\d+\/?$/,
	searchID: /(?<=\/)\d+(?=\/)/,
	links: /<a href="([^"]*)">/g
}

const apiURL = settings.rpdlURL + "api/"
const userFile = path.join("user.json")
let user = null

async function findUpdates(installedGames) {
	const updates = []
	
	const url = settings.backendURL + "/checkForUpdates"
	
	_.forEach(installedGames, async (game) => {
		console.log(game)
		updates.push({
			id: game.id, torrent_id: game.torrent_id,
		})
	})
	
	const returned = await rp(url, {
		method: "POST", json: true, body: updates, headers: {
			"Content-Type": "application/json",
		}
	})
	
	console.log(returned)
	
	return returned
}

async function tryLogin(loginData) {
	const loginURL = apiURL + "user/login"
	try {
		return await rp(loginURL, {
			method: "POST", json: true, body: loginData, headers: {
				"Content-Type": "application/json",
			}
		})
	} catch (error) {
		if (error.statusCode === 403) {
			// invalid login credentials
			console.log("Error 403")
			return null
		} else if (error.statusCode === 502) {
			console.log("Error 502")
			return null
		} else {
			throw error
		}
	}
}

async function login(username, password, refreshToken) {
	if (user == null || refreshToken) {
		if (username == null || password == null) {
			user = JSON.parse(await fs.promises.readFile(userFile, {encoding: "utf8"}))
			
			if (user !== null && user.token !== undefined) {
				return user.token
			}
			
			console.log("error?")
			return null
		}
		
		const loginData = {
			login: username, password: password,
		}
		
		const result = await tryLogin(loginData)
		
		if (result == null) {
			console.error("Login error: Invalid credentials")
			return null
		}
		
		user = {
			login: username, password: password, token: result.data.token,
		}
		
		await fs.promises.writeFile(userFile, JSON.stringify(user))
		
		return result.data.token
	} else {
		return user.token
	}
}

function sleep(ms) {
	return new Promise((resolve) => {
		setTimeout(resolve, ms)
	})
}

module.exports = {
	findUpdates, login, apiURL
}