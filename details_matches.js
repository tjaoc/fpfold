const axios = require("axios");
const { parse } = require("node-html-parser");
const fs = require("fs").promises;
const path = require("path");
const { BASE_URL } = require("./config");

const downloadPlayerPhoto = async (imageUrl, imagePath) => {
    try {
        const response = await axios.get(BASE_URL + imageUrl, { responseType: "arraybuffer" });
        const playersFolderPath = path.join(__dirname, "players");
        await fs.mkdir(playersFolderPath, { recursive: true });
        const imageName = path.basename(imagePath);
        const newImagePath = path.join(playersFolderPath, `${imageName}.png`);
        await fs.writeFile(newImagePath, response.data);
    } catch (error) {
        console.error(`Error downloading image: ${imageUrl}`, error);
    }
};

const downloadTeamLogo = async (imageUrl, imagePath) => {
    try {
        const response = await axios.get(BASE_URL + imageUrl, { responseType: "arraybuffer" });
        const teamsLogoFolderPath = path.join(__dirname, "teams_logos");
        await fs.mkdir(teamsLogoFolderPath, { recursive: true });
        const imageName = path.basename(imagePath);
        const newImagePath = path.join(teamsLogoFolderPath, `${imageName}.png`);
        await fs.writeFile(newImagePath, response.data);
    } catch (error) {
        console.error(`Error downloading team logo: ${imageUrl}`, error);
    }
};

const saveDetails = async (folderRoot) => {
    const playersFolderPath = path.join(__dirname, "players");
    try {
        await fs.mkdir(playersFolderPath, { recursive: true });
    } catch (error) {
        console.error(`Error creating players folder: ${playersFolderPath}`, error);
    }

    const matchesFolderPath = path.join(__dirname, "matches");
    try {
        const files = await fs.readdir(matchesFolderPath, { withFileTypes: true });
        for (const file of files) {
            const filePath = path.join(matchesFolderPath, file.name);
            if (file.isFile() && file.name.endsWith(".json")) {
                const matchId = file.name.split(".")[0];
                const matchFolderPath = path.join(matchesFolderPath, matchId);
                await processDetails(filePath, folderRoot, matchFolderPath, matchId);
            } else if (file.isDirectory()) {
                await processSubdirectory(filePath, folderRoot, matchesFolderPath);
            }
        }
    } catch (error) {
        console.error(`Error reading matches folder: ${matchesFolderPath}`, error);
    }
};

const processSubdirectory = async (directoryPath, folderRoot, matchesFolderPath) => {
    try {
        const subFiles = await fs.readdir(directoryPath, { withFileTypes: true });
        for (const subFile of subFiles) {
            const subFilePath = path.join(directoryPath, subFile.name);
            if (subFile.isFile() && subFile.name.endsWith(".json")) {
                const matchId = subFile.name.split(".")[0];
                const matchFolderPath = path.join(matchesFolderPath, matchId);
                await processDetails(subFilePath, folderRoot, matchFolderPath, matchId);
            }
        }
    } catch (error) {
        console.error(`Error reading subdirectory: ${directoryPath}`, error);
    }
};

const processDetails = async (filePath, folderRoot, matchFolderPath, matchId) => {
    try {
        const fileData = await fs.readFile(filePath, "utf8");
        const jsonData = JSON.parse(fileData);
        if (Array.isArray(jsonData)) {
            for (const item of jsonData) {
                if (item.gameLink) {
                    try {
                        // Add a delay of 1 second before making the request
                        await new Promise(resolve => setTimeout(resolve, 1000));

                        const response = await axios.get(item.gameLink);
                        const html = response.data;
                        const root = parse(html);
                        const players = root.querySelectorAll(".player");
                        const playerData = []; // Declare playerData variable
                        players.forEach((player) => {
                            const photo = player.querySelector("img").getAttribute("src");
                            const number = player.querySelector("strong")?.textContent;
                            const name = player.textContent.replace(/\d+\s+/, "").trim();
                            playerData.push({
                                photo,
                                number,
                                name
                            });
                        });
                        const teamLogoData = [];
                        const teams = root.querySelectorAll(".section-title.game-resume");
                        teams.forEach((team) => {
                            const teamLogo = team.querySelector("img").getAttribute("src");
                            teamLogoData.push({
                                teamLogo
                            });
                        });

                        const teamsLogoFolderPath = path.join(folderRoot, "teams_logos");
                        await fs.mkdir(teamsLogoFolderPath, { recursive: true });
                        for (const team of teamLogoData) {
                            if (team.teamLogo) {
                                const imageName = path.basename(team.teamLogo);
                                const newImagePath = path.join(teamsLogoFolderPath, `${imageName}`);
                                await downloadTeamLogo(team.teamLogo, newImagePath);
                            }
                        }

                        if (playerData.length > 0 && teamLogoData.length > 0) {
                            const name = item.gameLink.split("matchId=")[1].split("&")[0];
                            const detailsFilePath = path.join(matchFolderPath, `${name}.json`);
                            await fs.writeFile(detailsFilePath, JSON.stringify(playerData, null, 2));

                            // Descargar las imágenes
                            const playersFolderPath = path.join(folderRoot, "players");
                            await fs.mkdir(playersFolderPath, { recursive: true });
                            for (const player of playerData) {
                                const imageName = path.basename(player.photo);
                                const newImagePath = path.join(playersFolderPath, `${imageName}`);
                                await downloadPlayerPhoto(player.photo, newImagePath);
                            }
                        }
                    } catch (error) {
                        console.error(`Error fetching data from ${item.gameLink}:`, error);
                    }
                }
            }
        }
    } catch (error) {
        console.error(`Error reading file: ${filePath}`, error);
    }
};
module.exports = saveDetails;