const querySearch = /[^\[({]*/

function parseSearch(query) {
	let and_tags_string = query.substring(query.indexOf("[") + 1, query.indexOf("]"))
	let and_tags = and_tags_string.split(",").map((tag) => {
		
		return tag.trim().toLowerCase()
	}).filter((tag) => {
		return tag.length > 0
	})
	
	let or_tags_string = query.substring(query.indexOf("{") + 1, query.indexOf("}"))
	let or_tags = or_tags_string.split(",").map((tag) => {
		return tag.trim().toLowerCase()
	}).filter((tag) => {
		return tag.length > 0
	})
	
	let not_tags_string = query.substring(query.indexOf("<") + 1, query.indexOf(">"))
	let not_tags = not_tags_string.split(",").map((tag) => {
		return tag.trim().toLowerCase()
	}).filter((tag) => {
		return tag.length > 0
	})
	
	let engine = query.substring(query.indexOf("(") + 1, query.indexOf(")"))
	
	let search_term = querySearch.exec(query)[0]
	
	return {
		and_tags: and_tags,
		or_tags: or_tags,
		not_tags: not_tags,
		engine: engine.toLowerCase(),
		query: search_term.replaceAll(/[^a-zA-Z0-9-. ]/g, "")
	}
}

module.exports = {
	parseSearch
}