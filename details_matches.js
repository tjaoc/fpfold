const axios = require("axios");
const { parse } = require("node-html-parser");
const fs = require("fs").promises;
const path = require("path");
const BASE_URL = require('./config.js');

const downloadAndSaveImage = async (imageUrl, imagePath) => {
    try {
        const response = await axios.get(imageUrl, { responseType: "arraybuffer" });
        await fs.writeFile(imagePath, response.data);
    } catch (error) {
        console.error(`Error downloading and saving image from ${imageUrl}:`, error);
    }
};

const saveDetails = async (folderRoot) => {
    const matchesFolderPath = path.join(__dirname, "matches");
    const teamsLogosFolderPath = path.join(folderRoot, "..", "teams_logos");

    try {
        const files = await fs.readdir(matchesFolderPath, { withFileTypes: true });

        for (const file of files) {
            const filePath = path.join(matchesFolderPath, file.name);

            if (file.isFile() && file.name.endsWith(".json")) {
                await processDetails(filePath, folderRoot, teamsLogosFolderPath, matchesFolderPath);
            } else if (file.isDirectory()) {
                await processSubdirectory(filePath, folderRoot, teamsLogosFolderPath, matchesFolderPath);
            }
        }
    } catch (error) {
        console.error(`Error al leer la carpeta ${matchesFolderPath}:`, error);
    }
};



const processSubdirectory = async (directoryPath, folderRoot, teamsLogosFolderPath, matchesFolderPath) => {
    try {
        const subFiles = await fs.readdir(directoryPath, { withFileTypes: true });

        for (const subFile of subFiles) {
            const subFilePath = path.join(directoryPath, subFile.name);

            if (subFile.isFile() && subFile.name.endsWith(".json")) {
                const matchId = subFile.name.split(".")[0]; // Obtener el ID del partido del nombre del archivo
                const matchFolderPath = path.join(matchesFolderPath, matchId); // Ruta de la carpeta del partido

                await processDetails(subFilePath, folderRoot, teamsLogosFolderPath, matchFolderPath);
            }
        }
    } catch (error) {
        console.error(`Error reading subdirectory ${directoryPath}:`, error);
    }
};



const processDetails = async (filePath, folderRoot, teamsLogosFolderPath, matchesFolderPath) => {
    try {
        const fileData = await fs.readFile(filePath, "utf8");
        const jsonData = JSON.parse(fileData);

        if (Array.isArray(jsonData)) {
            for (const item of jsonData) {
                if (item.gameLink) {
                    try {
                        const baseUrl = BASE_URL;
                        const response = await axios.get(item.gameLink);
                        const html = response.data;
                        const root = parse(html);
                        const gameResume = root.querySelector(".game-resume");
                        const infoTimePlace = root.querySelector(".info-time-place");
                        const infoGoals = root.querySelector(".info-goals");

                        if (!gameResume || !infoTimePlace || !infoGoals) {
                            console.error(`Error fetching data from ${item.gameLink}: Required elements not found`);
                            continue;
                        }

                        const infoTimePlaceText = infoTimePlace.text.trim();

                        const homeTeamLogo = gameResume.querySelector(".col-md-1 img");
                        const homeTeamNameElement = gameResume.querySelector(".col-md-3");
                        const scoreElement = gameResume.querySelector(".col-md-4 strong");
                        const awayTeamNameElement = gameResume.querySelector(".col-md-3.text-right");
                        const awayTeamLogo = gameResume.querySelector(".col-md-1.text-right img");

                        if (!homeTeamLogo || !homeTeamNameElement || !scoreElement || !awayTeamNameElement || !awayTeamLogo) {
                            console.error(`Error fetching data from ${item.gameLink}: Required elements not found`);
                            continue;
                        }

                        const homeTeamLogoSrc = homeTeamLogo.getAttribute("src");
                        const homeTeamName = homeTeamNameElement.text.trim();
                        const score = scoreElement.text.trim();
                        const awayTeamName = awayTeamNameElement.text.trim();
                        const awayTeamLogoSrc = awayTeamLogo.getAttribute("src");

                        const homeTeamInfoGoals = infoGoals.querySelector(".col-md-3.text-left")?.text || "";
                        const awayTeamInfoGoals = infoGoals.querySelector(".col-md-3.text-right")?.text || "";

                        const detailsFolderPath = matchesFolderPath;
                        await fs.mkdir(detailsFolderPath, { recursive: true });
                        const imageFileName = path.basename(homeTeamLogoSrc);
                        const imageFilePath = path.join(teamsLogosFolderPath, imageFileName);

                        try {
                            await fs.access(teamsLogosFolderPath);
                        } catch (error) {
                            await fs.mkdir(teamsLogosFolderPath, { recursive: true });
                        }

                        const imageUrl = `${baseUrl}${homeTeamLogoSrc}`;
                        await downloadAndSaveImage(imageUrl, imageFilePath);

                        const matchId = item.gameLink.match(/matchId=(\d+)/)[1];
                        const fileName = `${matchId}.json`;
                        const detailsFilePath = path.join(detailsFolderPath, fileName);

                        const gameData = {
                            homeTeamLogoSrc,
                            homeTeamName,
                            score,
                            awayTeamName,
                            awayTeamLogoSrc,
                            infoTimePlace: infoTimePlaceText,
                            homeTeamInfoGoals,
                            awayTeamInfoGoals,
                        };

                        // Guardar el objeto gameData en el archivo JSON
                        await fs.writeFile(
                            detailsFilePath,
                            JSON.stringify(gameData, null, 2)
                        );
                        console.log(`Game resume saved to ${detailsFilePath}`);
                    } catch (error) {
                        console.error(
                            `Error while fetching data from ${item.gameLink}:`,
                            error
                        );
                    }
                }
            }
        }
    } catch (error) {
        console.error(`Error reading file ${filePath}:`, error);
    }
};


module.exports = saveDetails;
