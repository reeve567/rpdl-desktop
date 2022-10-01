# rpdl desktop

If you happened to stumble upon this by accident, this probably isn't useful to you. Sorry.
This is an app for users of [rpdl](https://rpdl.net), which is for downloading, installing, and keeping games updated.

Features:
* Offline library view of your installed games
* Playtime tracking --WIP--
* Searching and installing new games
* Viewing game information, such as description, tags, and reviews
* Not too heavy on the computer (uses a backend for a lot of the heavy-lifting)
* Filterable library based on tags, description, or title
* Auto-updating games --WIP?--
* Installation progress bar
* Configurable account details
* Auto-refresh of your rpdl token

At the moment, this is still in progress and there's a lot that needs work.

Installation:

1. Clone the repo (or download the zip)
2. Install NodeJS (not sure if there's a version requirement, I'm running v16.15.1)
3. run `npm i` in the main directory (installs all the dependencies to the project folder under `node_modules`)
4. Either create a `.bat` file to run the command or run `npm run start`

If you do not have access to a backend, (which is very possible rn) it is possible to get your own running via https://github.com/reeve567/rpdl-backend, all you need is a Java JDK.
I'll have releases sooner or later, but for now this is the best way to go about it.