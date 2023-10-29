const axios = require("axios");
const { parse } = require("node-html-parser");
const fs = require("fs").promises;
const path = require("path");
const { BASE_URL } = require("./config");

const sanitizeUrl = (url) => {
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
        url = BASE_URL + url;
    }
    return url;
};

const sanitizeFileName = (fileName) => {
    const sanitizedFileName = fileName.replace(/[^\w\s.-]/gi, "");
    const maxFileNameLength = 255;
    const truncatedFileName = sanitizedFileName.substring(0, maxFileNameLength);
    return truncatedFileName;
};

const downloadPlayerPhoto = async (imageUrl, imagePath) => {
    try {
        const sanitizedUrl = sanitizeUrl(imageUrl);
        const response = await axios.get(sanitizedUrl, { responseType: "arraybuffer" });
        const playersFolderPath = path.join(__dirname, "players");
        await fs.mkdir(playersFolderPath, { recursive: true });
        const imageName = sanitizeFileName(imagePath ? path.basename(imagePath) : '');
        const newImagePath = path.join(playersFolderPath, `${imageName}.png`);
        await fs.writeFile(newImagePath, response.data);
    } catch (error) {
        console.error(`Error al descargar la imagen: ${imageUrl}`, error);
    }
};

const downloadTeamLogo = async (imageUrl, imagePath) => {
    try {
        const sanitizedUrl = sanitizeUrl(imageUrl);
        const response = await axios.get(sanitizedUrl, { responseType: "arraybuffer" });
        const teamsLogoFolderPath = path.join(__dirname, "teams_logos");
        await fs.mkdir(teamsLogoFolderPath, { recursive: true });
        const homeLogoName = sanitizeFileName(imagePath ? path.basename(imagePath) : '');
        const homeNewLogoPath = path.join(teamsLogoFolderPath, `${homeLogoName}.png`);
        const awayLogoName = sanitizeFileName(imagePath ? path.basename(imagePath) : '');
        const awayNewLogoPath = path.join(teamsLogoFolderPath, `${awayLogoName}.png`);
        await fs.writeFile(homeNewLogoPath, awayNewLogoPath, response.data);
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
        console.error(`Error al leer la carpeta de partidos: ${matchesFolderPath}`, error);
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
        console.error(`Error al leer el subdirectorio: ${directoryPath}`, error);
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
                        const sanitizedUrl = sanitizeUrl(item.gameLink);
                        const response = await axios.get(sanitizedUrl);
                        const html = response.data;
                        const root = parse(html);
                        const gameResumeData = [];
                        const players = root.querySelectorAll(".player");
                        for (const player of players) {
                            const photoElement = player.querySelector("img");
                            const numberElement = player.querySelector("strong");
                            const photo = photoElement ? sanitizeUrl(photoElement.getAttribute("src")) : "";
                            const number = numberElement ? numberElement.textContent : "";
                            const name = player.textContent.replace(/\d+\s+/, "").trim();
                            gameResumeData.push({ photo, number, name });
                        }
                        const teams = root.querySelectorAll(".section-title.game-resume");
                        for (const team of teams) {
                            const teamHomeLogo = sanitizeUrl(team.querySelector("div:nth-child(1) img").getAttribute("src"));
                            const teamHome = team.querySelector("div:nth-child(2) strong").textContent;
                            const score = team.querySelector("div:nth-child(3)").textContent.trim();
                            const teamAway = team.querySelector("div:nth-child(4) strong").textContent;
                            const teamAwayLogo = sanitizeUrl(team.querySelector("div:nth-child(5) img").getAttribute("src"));
                            gameResumeData.push({
                                teamHomeLogo,
                                teamHome,
                                score,
                                teamAway,
                                teamAwayLogo
                            });
                        }

                        if (gameResumeData.length > 0) {
                            const name = sanitizeFileName(item.gameLink.split("matchId=")[1].split("&")[0]);
                            const detailsFilePath = path.join(matchFolderPath, `${name}.json`);
                            await fs.writeFile(detailsFilePath, JSON.stringify(gameResumeData, null, 2));
                            const playersFolderPath = path.join(folderRoot, "players");
                            const teamsLogoFolderPath = path.join(folderRoot, "teams_logos");

                            for (const player of gameResumeData) {
                                const imageName = sanitizeFileName(path.basename(player.photo));
                                const newImagePath = path.join(playersFolderPath, `${imageName}`);
                                await downloadPlayerPhoto(player.photo, newImagePath);
                            }

                            for (const team of gameResumeData) {
                                if (team.teamHomeLogo && team.teamAwayLogo) {
                                    const homeLogoName = sanitizeFileName(path.basename(team.teamHomeLogo));
                                    const homeNewLogoPath = path.join(teamsLogoFolderPath, `${homeLogoName}`);
                                    await downloadTeamLogo(team.teamHomeLogo, homeNewLogoPath);

                                    const awayLogoName = sanitizeFileName(path.basename(team.teamAwayLogo));
                                    const awayNewLogoPath = path.join(teamsLogoFolderPath, `${awayLogoName}`);
                                    await downloadTeamLogo(team.teamAwayLogo, awayNewLogoPath);
                                }
                            }
                        }
                    } catch (error) {
                        console.error(`Error al obtener datos de ${item.gameLink}:`, error);
                    }
                }
            }
        }
    } catch (error) {
        console.error(`Error al leer el archivo: ${filePath}`, error);
    }
};

module.exports = saveDetails;