const axios = require("axios");
const { parse } = require("node-html-parser");
const fs = require("fs").promises;
const path = require("path");
const { BASE_URL, FIXTURE_URL } = require('./config.js');

const saveResumes = async (matchesData, fixtureId) => {
    const folderPath = path.join(__dirname, "matches", fixtureId.toString());
    const fileName = `${fixtureId}.json`;
    const filePath = path.join(folderPath, fileName);
    const jsonData = matchesData.map(({ gameSchedule, score, ...rest }) => {
        const match = gameSchedule.trim().match(/^(\d+\s\w+)(?:\s+(\d+:\d+))?/);
        const date = match ? match[1].trim() : "";
        const hour = match ? (match[2] ? match[2].trim() : "") : "";
        const gameLink = score !== "- - -" ? rest.gameLink : null;
        const scoreParts = score.trim().split(/\s+/);
        const scorePartsFiltered = scoreParts.filter(part => part !== '-');
        const scoreFormatted = scorePartsFiltered.slice(0, 2).join(" - ");
        return {
            ...rest,
            date,
            hour,
            score: scoreFormatted || " - - -",
            ...(gameLink && { gameLink })
        };
    });

    try {
        await fs.mkdir(folderPath, { recursive: true });
        console.log("Carpeta 'matches' creada con éxito.");
    } catch (error) {
        console.error("Error al crear la carpeta 'matches':", error);
        return;
    }

    try {
        await fs.writeFile(filePath, JSON.stringify(jsonData, null, 2));
        console.log(`Archivo ${filePath} guardado con éxito.`);
    } catch (error) {
        console.error(`Error al guardar el archivo ${filePath}:`, error);
    }
};

const fetchResumes = async (fixtureId) => {
    try {
        const url = `${BASE_URL}${FIXTURE_URL}${fixtureId}`;
        const response = await axios.get(url, {
            headers: {
                Accept: "application/json"
            }
        });
        return response.data;
    } catch (error) {
        console.error("Error al realizar la solicitud HTTP:", error);
        return null;
    }
};

const processResumes = async () => {
    const cache = {}; // Caché de respuestas
    const fetchPromises = [];

    for (let i = 505659; i <= 505680; i++) {
        const fixtureId = i;

        // Comprobar si los datos están en caché
        if (cache[fixtureId]) {
            console.log(`Datos del fixtureId ${fixtureId} recibidos desde la caché.`);
            const matchesData = cache[fixtureId];
            await saveResumes(matchesData, fixtureId);
            continue;
        }

        const fetchPromise = fetchResumes(fixtureId)
            .then((body) => {
                if (body) {
                    const matchesData = [];
                    const root = parse(body);
                    const homeTeams = root.querySelectorAll("div.home-team");
                    const gameSchedules = root.querySelectorAll("span.game-schedule");
                    const gameStadiums = root.querySelectorAll("div.game-list-stadium");
                    const awayTeams = root.querySelectorAll("div.away-team");
                    const scores = root.querySelectorAll("div.score");
                    const gameLinkElements = root.querySelectorAll("a.game-link");

                    for (let j = 0; j < homeTeams.length; j++) {
                        const homeTeam = homeTeams[j].text;
                        const gameLinkElement = gameLinkElements[j];
                        const gameLinks = gameLinkElement ? gameLinkElement.getAttribute("href") : null;

                        if (homeTeam) {
                            const gameLink = gameLinks && gameLinks.startsWith('/Match/GetMatchInformation') ? `${BASE_URL}${gameLinks}` : "";
                            const gameSchedule = gameSchedules[j].text.trim().replace(/\r?\n|\r/g, "");
                            const stadium = gameStadiums[j].text.trim().replace(/\r?\n|\r/g, "");
                            const awayTeam = awayTeams[j].text;
                            const score = scores[j]?.text.trim().replace(/\r?\n|\r/g, "") || "- - -";

                            const matchData = {
                                gameLink,
                                homeTeam,
                                gameSchedule,
                                stadium,
                                awayTeam,
                                score,
                            };

                            matchesData.push(matchData);
                        }
                    }

                    cache[fixtureId] = matchesData;
                    return saveResumes(matchesData, fixtureId);
                }
            })
            .catch((error) => {
                console.error(`Error al procesar el fixtureId ${fixtureId}:`, error);
            });

        fetchPromises.push(fetchPromise);
    }

    await Promise.all(fetchPromises);
};

module.exports = processResumes;
