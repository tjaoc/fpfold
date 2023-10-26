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
        console.error(`Error al descargar la imagen: ${imageUrl}`, error);
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
        console.error(`Error al descargar el logo del equipo: ${imageUrl}`, error);
    }
};

const saveDetails = async (folderRoot) => {
    const playersFolderPath = path.join(__dirname, "players");
    try {
        await fs.mkdir(playersFolderPath, { recursive: true });
    } catch (error) {
        console.error(`Error al crear la carpeta de jugadores: ${playersFolderPath}`, error);
    }

    const matchesFolderPath = path.join(__dirname, "matches");
    try {
        const files = await fs.readdir(matchesFolderPath, { withFileTypes: true });
        await Promise.all(files.map(async (file) => {
            const filePath = path.join(matchesFolderPath, file.name);
            if (file.isFile() && file.name.endsWith(".json")) {
                const matchId = file.name.split(".")[0];
                const matchFolderPath = path.join(matchesFolderPath, matchId);
                await processDetails(filePath, folderRoot, matchFolderPath, matchId);
            } else if (file.isDirectory()) {
                await processSubdirectory(filePath, folderRoot, matchesFolderPath);
            }
        }));
    } catch (error) {
        console.error(`Error al leer la carpeta de partidos: ${matchesFolderPath}`, error);
    }
};

const processSubdirectory = async (directoryPath, folderRoot, matchesFolderPath) => {
    try {
        const subFiles = await fs.readdir(directoryPath, { withFileTypes: true });
        await Promise.all(subFiles.map(async (subFile) => {
            const subFilePath = path.join(directoryPath, subFile.name);
            if (subFile.isFile() && subFile.name.endsWith(".json")) {
                const matchId = subFile.name.split(".")[0];
                const matchFolderPath = path.join(matchesFolderPath, matchId);
                await processDetails(subFilePath, folderRoot, matchFolderPath, matchId);
            }
        }));
    } catch (error) {
        console.error(`Error al leer el subdirectorio: ${directoryPath}`, error);
    }
};

const processDetails = async (filePath, folderRoot, matchFolderPath, matchId) => {
    try {
        const fileData = await fs.readFile(filePath, "utf8");
        const jsonData = JSON.parse(fileData);
        if (Array.isArray(jsonData)) {
            await Promise.all(jsonData.map(async (item) => {
                if (item.gameLink) {
                    try {
                        const response = await axios.get(item.gameLink);
                        const html = response.data;
                        const root = parse(html);

                        const players = root.querySelectorAll(".player");
                        const playerData = players.map((player) => {
                            const photo = player.querySelector("img").getAttribute("src");
                            const number = player.querySelector("strong")?.textContent;
                            const name = player.textContent.replace(/\d+\s+/, "").trim();
                            return { photo, number, name };
                        });

                        const teams = root.querySelectorAll(".section-title.game-resume");
                        const teamLogoData = teams.map((team) => {
                            const teamLogo = team.querySelector("img").getAttribute("src");
                            return { teamLogo };
                        });

                        if (playerData.length > 0 && teamLogoData.length > 0) {
                            const name = item.gameLink.split("matchId=")[1].split("&")[0];
                            const detailsFilePath = path.join(matchFolderPath, `${name}.json`);
                            await fs.writeFile(detailsFilePath, JSON.stringify(playerData, null, 2));

                            const playersFolderPath = path.join(folderRoot, "players");
                            await fs.mkdir(playersFolderPath, { recursive: true });

                            await Promise.all(playerData.map(async (player) => {
                                const imageName = path.basename(player.photo);
                                const newImagePath = path.join(playersFolderPath, `${imageName}`);
                                await downloadPlayerPhoto(player.photo, newImagePath);
                            }));

                            const teamsLogoFolderPath = path.join(folderRoot, "teams_logos");
                            await fs.mkdir(teamsLogoFolderPath, { recursive: true });

                            await Promise.all(teamLogoData.map(async (team) => {
                                if (team.teamLogo) {
                                    const imageName = path.basename(team.teamLogo);
                                    const newImagePath = path.join(teamsLogoFolderPath, `${imageName}`);
                                    await downloadTeamLogo(team.teamLogo, newImagePath);
                                }
                            }));
                        }
                    } catch (error) {
                        console.error(`Error al obtener datos de ${item.gameLink}:`, error);
                    }
                }
            }));
        }
    } catch (error) {
        console.error(`Error al leer el archivo: ${filePath}`, error);
    }
};

module.exports = saveDetails;