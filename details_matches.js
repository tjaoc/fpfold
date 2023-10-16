const axios = require("axios");
const { parse } = require("node-html-parser");
const fs = require("fs").promises;
const path = require("path");
const { BASE_URL } = require("./config");

// Función para descargar una imagen desde una URL y guardarla en una ruta especificada
const downloadImage = async (imageUrl, imagePath) => {
    try {
        // Fetch the image data as an array buffer
        const response = await axios.get(imageUrl, { responseType: "arraybuffer" });
        // Create the directory for the image if it doesn't exist
        await fs.mkdir(path.dirname(imagePath), { recursive: true });
        // Write the image data to the specified path
        await fs.writeFile(imagePath, response.data);
    } catch (error) {
        console.error(`Error downloading image: ${imageUrl}`, error);
    }
};

// Función para guardar detalles de archivos JSON en una carpeta especificada
const saveDetails = async (folderRoot) => {
    const playersFolderPath = path.join(folderRoot, "players");
    try {
        // Check if the players folder already exists
        await fs.access(playersFolderPath);
    } catch (error) {
        // Create the players folder if it doesn't exist
        await fs.mkdir(playersFolderPath, { recursive: true });
    }
    const matchesFolderPath = path.join(__dirname, "matches");
    try {
        // Read the files in the matches folder
        const files = await fs.readdir(matchesFolderPath, { withFileTypes: true });
        for (const file of files) {
            const filePath = path.join(matchesFolderPath, file.name);
            if (file.isFile() && file.name.endsWith(".json")) {
                // Process details for JSON files
                await processDetails(filePath, folderRoot);
            } else if (file.isDirectory()) {
                // Process subdirectories recursively
                await processSubdirectory(filePath, folderRoot, matchesFolderPath);
            }
        }
    } catch (error) {
        console.error(`Error al leer la carpeta ${matchesFolderPath}:`, error);
    }
};

// Función para procesar un subdirectorio dentro de la carpeta de partidos
const processSubdirectory = async (directoryPath, folderRoot, matchesFolderPath) => {
    try {
        // Read the files in the subdirectory
        const subFiles = await fs.readdir(directoryPath, { withFileTypes: true });
        for (const subFile of subFiles) {
            const subFilePath = path.join(directoryPath, subFile.name);
            if (subFile.isFile() && subFile.name.endsWith(".json")) {
                // Process details for JSON files within the subdirectory
                const matchId = subFile.name.split(".")[0];
                const matchFolderPath = path.join(matchesFolderPath, matchId);
                await processDetails(subFilePath, folderRoot, matchFolderPath);
            }
        }
    } catch (error) {
        console.error(`Error reading subdirectory ${directoryPath}:`, error);
    }
};

// Función para procesar los detalles de un archivo JSON
const processDetails = async (filePath, folderRoot, matchesFolderPath) => {
    try {
        // Read the JSON file
        const fileData = await fs.readFile(filePath, "utf8");
        const jsonData = JSON.parse(fileData);
        if (Array.isArray(jsonData)) {
            for (const item of jsonData) {
                if (item.gameLink) {
                    try {
                        // Fetch the HTML data from the game link
                        const response = await axios.get(item.gameLink);
                        const html = response.data;
                        const root = parse(html);
                        const gameResume = root.querySelector(".game-resume");
                        const infoGoals = root.querySelector(".info-goals");
                        const refereePrincipal = root.querySelector(".lineup-team");
                        if (!gameResume || !infoGoals || !refereePrincipal) {
                            // Skip if required elements are not found
                            continue;
                        }
                        // Extract relevant data from the HTML
                        const homeTeamLogo = gameResume.querySelector(".col-md-1 img");
                        const homeTeamNameElement = gameResume.querySelector(".col-md-3");
                        const scoreElement = gameResume.querySelector(".col-md-4 strong");
                        const awayTeamNameElement = gameResume.querySelector(".col-md-3.text-right");
                        const awayTeamLogo = gameResume.querySelector(".col-md-1.text-right img");
                        const playerPhotos = refereePrincipal.querySelectorAll(".photo img");
                        const playerNumbers = refereePrincipal.querySelectorAll("strong");
                        const playerNames = refereePrincipal.querySelectorAll("strong + span");
                        const homeTeamName = homeTeamNameElement.textContent.trim();
                        const score = scoreElement.textContent.trim();
                        const awayTeamName = awayTeamNameElement.textContent.trim();
                        const homeTeamInfoGoals = infoGoals.querySelector(".col-md-3.text-left")?.textContent || "";
                        const awayTeamInfoGoals = infoGoals.querySelector(".col-md-3.text-right")?.textContent || "";
                        if (!playerPhotos || !playerNumbers || !playerNames) {
                            // Skip if player data is not found
                            continue;
                        }
                        const detailsFolderPath = matchesFolderPath;
                        await fs.mkdir(detailsFolderPath, { recursive: true });
                        const matchId = item.gameLink.match(/matchId=(\d+)/)[1];
                        const fileName = `${matchId}.json`;
                        const detailsFilePath = path.join(detailsFolderPath, fileName);
                        const gameData = {
                            homeTeamLogo: homeTeamLogo ? homeTeamLogo.getAttribute("src") : null,
                            homeTeamName,
                            score,
                            awayTeamName,
                            awayTeamLogo: awayTeamLogo ? awayTeamLogo.getAttribute("src") : null,
                            homeTeamInfoGoals,
                            awayTeamInfoGoals,
                            players: []
                        };
                        let homeTeamLogoUrl = homeTeamLogo ? homeTeamLogo.getAttribute("src") : null;
                        let awayTeamLogoUrl = awayTeamLogo ? awayTeamLogo.getAttribute("src") : null;
                        const players = [];
                        for (let i = 0; i < playerPhotos.length; i++) {
                            const playerPhoto = playerPhotos[i];
                            const playerNumber = playerNumbers[i].textContent.trim();
                            const playerName = (playerNames[i]?.textContent || '').trim();
                            if (playerPhoto && playerNumber && playerName) {
                                const playerData = {
                                    playerPhoto: playerPhoto.getAttribute("src"),
                                    playerNumber,
                                    playerName
                                };
                                players.push(playerData);
                            }
                        }
                        gameData.players = players;
                        let homeTeamLogoPath = null;
                        let awayTeamLogoPath = null;
                        if (homeTeamLogoUrl) {
                            homeTeamLogoPath = path.join(__dirname, "teams_logos", `${path.basename(homeTeamLogoUrl)}.png`);
                            if (!homeTeamLogoUrl.startsWith("http") && !homeTeamLogoUrl.startsWith("https")) {
                                homeTeamLogoUrl = `${BASE_URL}${homeTeamLogoUrl}`;
                            }
                        }
                        if (awayTeamLogoUrl) {
                            awayTeamLogoPath = path.join(__dirname, "teams_logos", `${path.basename(awayTeamLogoUrl)}.png`);
                            if (!awayTeamLogoUrl.startsWith("http") && !awayTeamLogoUrl.startsWith("https")) {
                                awayTeamLogoUrl = `${BASE_URL}${awayTeamLogoUrl}`;
                            }
                        }
                        const promises = [];
                        if (homeTeamLogoPath) {
                            promises.push(downloadImage(homeTeamLogoUrl, homeTeamLogoPath));
                        }
                        if (awayTeamLogoPath) {
                            promises.push(downloadImage(awayTeamLogoUrl, awayTeamLogoPath));
                        }
                        await Promise.all(promises);
                        // Write the game data to a JSON file
                        await fs.writeFile(
                            detailsFilePath,
                            JSON.stringify(gameData, null, 2)
                        );
                    } catch (error) {
                        console.error(`Error while fetching data from ${item.gameLink}:`, error);
                    }
                }
            }
        }
    } catch (error) {
        console.error(`Error reading file ${filePath}:`, error);
    }
};

module.exports = saveDetails;